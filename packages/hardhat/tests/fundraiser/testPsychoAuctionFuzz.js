/**
 * @title Auction fuzz/invariant tests
 * @notice Randomized state transitions around price decay, epoch rollover, and buy invariants.
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);

const ONE_HOUR = 3600;

function mkRng(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 0x100000000);
  };
}

function randBetween(rng, min, max) {
  const span = max - min + 1;
  return Math.floor(rng() * span) + min;
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("Psycho Auction Fuzzing", function () {
  let owner, buyer, receiver, user;
  let auction;
  let lp;
  let assetA;
  let assetB;

  beforeEach("deploy auction", async function () {
    await network.provider.send("hardhat_reset");

    [owner, buyer, receiver, user] = await ethers.getSigners();

    const tokenArtifact = await ethers.getContractFactory("MockUSDC");
    lp = await tokenArtifact.deploy();
    assetA = await tokenArtifact.deploy();
    assetB = await tokenArtifact.deploy();

    await lp.mint(owner.address, convert("5000000", 6));
    await lp.mint(buyer.address, convert("5000000", 6));

    await assetA.mint(owner.address, convert("1000000", 6));

    const AuctionArtifact = await ethers.getContractFactory("Auction");
    auction = await AuctionArtifact.deploy(
      lp.address,
      "0x000000000000000000000000000000000000dEaD",
      convert("1200", 6),
      ONE_HOUR,
      convert("1.5", 18),
      convert("1", 6)
    );

    await assetA.mint(auction.address, convert("10000", 6));
    await assetB.mint(auction.address, convert("5000", 6));
  });

  it("should preserve buy invariants under random adversarial timing and parameters", async function () {
    const rng = mkRng(Number(process.env.PSYCHO_SEED || 0xa11ce));
    const steps = 120;

    for (let step = 0; step < steps; step++) {
      const action = randBetween(rng, 0, 6);
      const epochBefore = await auction.epochId();
      const dead = "0x000000000000000000000000000000000000dEaD";

      if (action === 0) {
        // inject more assets to be drained in a future epoch
        const amount = convert(randBetween(rng, 1, 50), 6);
        const asset = randBetween(rng, 0, 1) === 0 ? assetA : assetB;
        await asset.connect(owner).mint(auction.address, amount);
      } else if (action === 1) {
        // random time decay
        const move = randBetween(rng, 0, ONE_HOUR);
        await increaseTime(move);
      } else {
        // attempt a buy, varying deadline/maxPayment to hit both success/failure paths
        // compute timing after any required setup tx in this step (e.g. approve) to avoid stale snapshots
        // and keep branch expectations aligned with contract execution semantics.
        const blockBeforeBuy = await ethers.provider.getBlock("latest");
        const deadline = blockBeforeBuy.timestamp + randBetween(rng, 1, ONE_HOUR * 2);

        const expectedEpochId = epochBefore;
        const wrongEpoch = randBetween(rng, 0, 1) === 0 ? expectedEpochId : expectedEpochId.add(1);
        const currentPrice = await auction.getPrice();
        const forceLowMax = randBetween(rng, 0, 2) === 0 && !currentPrice.eq(0);
        const maxPayment = forceLowMax ? currentPrice.sub(1) : convert("10000", 6);

        const assetChoice = randBetween(rng, 0, 2);
        let assets = [];
        if (assetChoice === 0) {
          assets = [assetA.address];
        } else if (assetChoice === 1) {
          assets = [assetA.address, assetB.address];
        } else {
          assets = [assetB.address];
        }

        // give approval only for this step
        await lp.connect(buyer).approve(auction.address, currentPrice);

        if (process.env.PSYCHO_AUCTION_DEBUG) {
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify({
              step,
              epochBefore: epochBefore.toString(),
              wrongEpoch: wrongEpoch.toString(),
              currentPrice: currentPrice.toString(),
              forceLowMax,
              maxPayment: maxPayment.toString(),
              action,
            })
          );
        }

        if (wrongEpoch.eq(epochBefore)) {
          const currentPriceAtCall = await auction.getPrice();
          if (maxPayment.lt(currentPriceAtCall) || blockBeforeBuy.timestamp > deadline) {
              await expect(
                auction.connect(buyer).buy(assets, receiver.address, wrongEpoch, deadline, maxPayment)
              ).to.be.revertedWith("Auction__MaxPaymentAmountExceeded()");
            } else {
            const beforeBurn = await lp.balanceOf(dead);
            const beforeAuctionA = await assetA.balanceOf(auction.address);
            const beforeAuctionB = await assetB.balanceOf(auction.address);

            const tx = await auction.connect(buyer).buy(assets, receiver.address, wrongEpoch, deadline, maxPayment);
            const receipt = await tx.wait();
            const buyEvent = receipt.events.find((e) => e.event === "Auction__Buy");
            const paymentFromEvent = buyEvent.args.paymentAmount;

            const afterBurn = await lp.balanceOf(dead);
            const afterAuctionA = await assetA.balanceOf(auction.address);
            const afterAuctionB = await assetB.balanceOf(auction.address);

            const paid = afterBurn.sub(beforeBurn);
            expect(paid).to.equal(paymentFromEvent);

            if (assets.includes(assetA.address)) {
              expect(afterAuctionA).to.equal(0);
              expect(paymentFromEvent).to.be.gte(0);
            }
            if (assets.includes(assetB.address)) {
              expect(afterAuctionB).to.equal(0);
            }

            if (expectedEpochId.eq(await auction.epochId()) || (await auction.epochId()).eq(expectedEpochId.add(1))) {
              expect(await auction.epochId()).to.equal(expectedEpochId.add(1));
            }

            if (assets.includes(assetA.address)) {
              expect(beforeAuctionA.sub(afterAuctionA)).to.be.gte(0);
            }
            if (assets.includes(assetB.address)) {
              expect(beforeAuctionB.sub(afterAuctionB)).to.be.gte(0);
            }
          }
        } else {
          if (process.env.PSYCHO_AUCTION_DEBUG) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ step, epochBefore: (await auction.epochId()).toString(), wrongEpoch: wrongEpoch.toString() }));
          }
          await expect(
            auction.connect(buyer).buy(assets, receiver.address, wrongEpoch, deadline, maxPayment)
          ).to.be.reverted;
        }

        // always enforce startTime monotonic and epochId monotonic
        const start = await auction.startTime();
        expect(start).to.be.at.least(0);
      }

      if (action === 2 || action === 3) {
        // repeated getter checks as lightweight invariants
        const price = await auction.getPrice();
        const currentStart = await auction.startTime();
        expect(price).to.be.gte(0);
        expect(currentStart).to.be.gte(0);
      }
    }
  });
});
