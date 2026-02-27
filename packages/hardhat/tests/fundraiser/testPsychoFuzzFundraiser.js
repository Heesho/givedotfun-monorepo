/**
 * @title Psycho Fundraiser Fuzzer
 * @notice Stateful randomized invariants and hostile-seeming call sequences.
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);

const AddressZero = "0x0000000000000000000000000000000000000000";
const ONE_DAY = 86400;
const ONE_HOUR = 3600;
const MIN_DONATION = ethers.BigNumber.from(10_000); // quote is 6 decimals

function mkRng(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 0x100000000);
  };
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

function randBetween(rng, min, max) {
  const span = max - min + 1;
  return Math.floor(rng() * span) + min;
}

describe("Psycho Fundraiser Fuzzing", function () {
  const INITIAL_EMISSION = convert("1000", 18);
  const MIN_EMISSION = convert("10", 18);
  const HALVING = 30;
  const EPOCH_DURATION = ONE_DAY;

  let owner;
  let treasury;
  let team;
  let protocol;
  let recipient;
  let users;
  let allSigners;

  let paymentToken;
  let coinToken;
  let fundraiser;
  let mockCore;

  // Local invariants model
  // epoch => account => donation amount
  const epochToDonations = new Map();
  const epochToClaimed = new Map();

  const ZR = ethers.BigNumber.from(0);

  function getEpochState(epoch) {
    const key = epoch.toString();
    if (!epochToDonations.has(key)) {
      epochToDonations.set(key, new Map());
    }
    if (!epochToClaimed.has(key)) {
      epochToClaimed.set(key, new Set());
    }
    return {
      donations: epochToDonations.get(key),
      claimed: epochToClaimed.get(key),
    };
  }

  function ensureActorState(actor, state) {
    if (!state.donations.has(actor.address)) {
      state.donations.set(actor.address, ZR);
    }
    return state.donations.get(actor.address);
  }

  function setDonation(epoch, actor, amount) {
    const state = getEpochState(epoch);
    const prev = ensureActorState(actor, state);
    state.donations.set(actor.address, prev.add(amount));
  }

  function getDonation(epoch, actor) {
    const state = getEpochState(epoch);
    return state.donations.get(actor.address) || ZR;
  }

  function markClaimed(epoch, actor) {
    const state = getEpochState(epoch);
    state.claimed.add(actor.address);
  }

  function isClaimed(epoch, actor) {
    const state = getEpochState(epoch);
    return state.claimed.has(actor.address);
  }

  function expectedRewardForEpoch(epoch, actor, epochEmission, totalDonation) {
    const userDonation = getDonation(epoch, actor);
    if (userDonation.eq(ZR) || totalDonation.eq(ZR)) return ZR;
    return userDonation.mul(epochEmission).div(totalDonation);
  }

  async function assertTrackedInvariants() {
    const epochKeys = Array.from(epochToDonations.keys()).sort((a, b) => Number(a) - Number(b));
    for (const epochKey of epochKeys) {
      const epoch = ethers.BigNumber.from(epochKey);
      const state = getEpochState(epoch);
      let localTotal = ZR;

      for (const actor of allSigners) {
        const onChainDonation = await fundraiser.epochAccountToDonation(epoch, actor.address);
        const expectedDonation = getDonation(epoch, actor);
        expect(onChainDonation).to.equal(expectedDonation, `epoch ${epoch} donation mismatch for ${actor.address}`);

        if (!expectedDonation.eq(ZR)) {
          localTotal = localTotal.add(expectedDonation);
          const onChainClaimed = await fundraiser.epochAccountToHasClaimed(epoch, actor.address);
          const expectedClaimed = isClaimed(epoch, actor);
          expect(onChainClaimed).to.equal(
            expectedClaimed,
            `epoch ${epoch} claimed flag mismatch for ${actor.address}`
          );
        }
      }

      const onChainTotal = await fundraiser.epochToTotalDonated(epoch);
      expect(onChainTotal).to.equal(localTotal, `epoch ${epoch} total mismatch`);
    }

    const fundraiserBalance = await paymentToken.balanceOf(fundraiser.address);
    expect(fundraiserBalance).to.equal(0);
  }

  beforeEach("deploy fundraiser", async function () {
    await network.provider.send("hardhat_reset");

    [owner, treasury, team, protocol, recipient, ...users] = await ethers.getSigners();
    allSigners = [owner, treasury, team, protocol, recipient, ...users.slice(0, 5)];

    const mockUsdcArtifact = await ethers.getContractFactory("MockUSDC");
    paymentToken = await mockUsdcArtifact.deploy();

    const mockCoreArtifact = await ethers.getContractFactory("MockCore");
    mockCore = await mockCoreArtifact.deploy(protocol.address);

    const coinArtifact = await ethers.getContractFactory("Coin");
    coinToken = await coinArtifact.deploy("Test Coin", "TCOIN", owner.address);

    const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
    fundraiser = await fundraiserArtifact.deploy(
      coinToken.address,
      paymentToken.address,
      mockCore.address,
      treasury.address,
      team.address,
      recipient.address,
      [INITIAL_EMISSION, MIN_EMISSION, HALVING, EPOCH_DURATION],
      ""
    );

    await coinToken.setMinter(fundraiser.address);

    for (const actor of allSigners) {
      await paymentToken.mint(actor.address, convert("50000", 6));
    }

    epochToDonations.clear();
    epochToClaimed.clear();
  });

  it("should uphold accounting and claim invariants under randomized hostiles", async function () {
    const seed = Number(process.env.PSYCHO_SEED || 0xdecafbad);
    const rng = mkRng(seed);
    const steps = 220;

    for (let step = 0; step < steps; step++) {
      const action = randBetween(rng, 0, 6);
      const epochBefore = await fundraiser.currentEpoch();
      const nowEpoch = Number(epochBefore);

      if (action === 0) {
        // randomized donation, possibly on behalf of a different account
        const payer = allSigners[randBetween(rng, 0, allSigners.length - 1)];
        const credited = allSigners[randBetween(rng, 0, allSigners.length - 1)];
        const amount = ethers.BigNumber.from(randBetween(rng, 1, 40)).mul(10_000);

        const balance = await paymentToken.balanceOf(payer.address);
        if (balance.lt(amount)) {
          await paymentToken.mint(payer.address, amount.mul(5));
        }

        await paymentToken.connect(payer).approve(fundraiser.address, amount);
        const tx = await fundraiser.connect(payer).fund(credited.address, amount, `chaos-${step}`);
        await tx.wait();

        setDonation(epochBefore, credited, amount);

        const donationOnChain = await fundraiser.epochAccountToDonation(epochBefore, credited.address);
        expect(donationOnChain).to.equal(getDonation(epochBefore, credited));
      } else if (action === 1) {
        // randomized claim attempt (valid + invalid)
        const chosenEpoch = randBetween(rng, Math.max(0, nowEpoch - 4), nowEpoch + 1);
        const candidateEpoch = ethers.BigNumber.from(chosenEpoch);
        const claimer = allSigners[randBetween(rng, 0, allSigners.length - 1)];
        const beneficiary = allSigners[randBetween(rng, 0, allSigners.length - 1)];
        const donation = getDonation(candidateEpoch, beneficiary);
        const alreadyClaimed = isClaimed(candidateEpoch, beneficiary);

        if (chosenEpoch >= nowEpoch) {
          await expect(fundraiser.connect(claimer).claim(beneficiary.address, candidateEpoch)).to.be.revertedWith(
            "Fundraiser__EpochNotEnded()"
          );
        } else if (donation.eq(ZR)) {
          await expect(fundraiser.connect(claimer).claim(beneficiary.address, candidateEpoch)).to.be.revertedWith(
            "Fundraiser__NoDonation()"
          );
        } else if (alreadyClaimed) {
          await expect(fundraiser.connect(claimer).claim(beneficiary.address, candidateEpoch)).to.be.revertedWith(
            "Fundraiser__AlreadyClaimed()"
          );
        } else {
          const beneficiaryBefore = await coinToken.balanceOf(beneficiary.address);
          const epochTotal = await fundraiser.epochToTotalDonated(candidateEpoch);
          const emission = await fundraiser.getEpochEmission(candidateEpoch);
          const expected = expectedRewardForEpoch(candidateEpoch, beneficiary, emission, epochTotal);

          const tx = await fundraiser.connect(claimer).claim(beneficiary.address, candidateEpoch);
          await tx.wait();

          const beneficiaryAfter = await coinToken.balanceOf(beneficiary.address);
          expect(beneficiaryAfter.sub(beneficiaryBefore)).to.equal(expected);
          markClaimed(candidateEpoch, beneficiary);

          const onChainClaimed = await fundraiser.epochAccountToHasClaimed(candidateEpoch, beneficiary.address);
          expect(onChainClaimed).to.equal(true);
        }
      } else if (action === 2) {
        // random time advance (can skip one or more epochs)
        const delta = randBetween(rng, 0, 3 * ONE_DAY);
        await increaseTime(delta + 1);
      } else if (action === 3) {
        // owner governance shuffle: recipient / team / treasury changes
        const adminAction = randBetween(rng, 0, 2);
        if (adminAction === 0) {
          const nextRecipient = allSigners[randBetween(rng, 0, allSigners.length - 1)].address;
          const useZero = randBetween(rng, 0, 4) === 0;
          await fundraiser.connect(owner).setRecipient(useZero ? AddressZero : nextRecipient);
        } else if (adminAction === 1) {
          const nextTeam = allSigners[randBetween(rng, 0, allSigners.length - 1)].address;
          const useZero = randBetween(rng, 0, 4) === 0;
          await fundraiser.connect(owner).setTeam(useZero ? AddressZero : nextTeam);
        } else {
          const nextTreasury = allSigners[randBetween(rng, 0, allSigners.length - 1)].address;
          if (nextTreasury === AddressZero) {
            return;
          }
          await fundraiser.connect(owner).setTreasury(nextTreasury);
        }
      } else if (action === 4) {
        // explicit unauthorized mutation attempts should fail
        const attacker = allSigners[randBetween(rng, 1, allSigners.length - 1)];
        const target = allSigners[randBetween(rng, 0, allSigners.length - 1)].address;
        await expect(fundraiser.connect(attacker).setRecipient(target)).to.be.reverted;
      } else if (action === 5) {
        // invalid donation attempts to exercise revert paths
        const payer = allSigners[randBetween(rng, 0, allSigners.length - 1)];
        const badAmount = ethers.BigNumber.from(randBetween(rng, 0, Number(MIN_DONATION.sub(1))));
        const account = allSigners[randBetween(rng, 0, allSigners.length - 1)];

        const beforeMap = new Map();
        for (const actor of allSigners) {
          beforeMap.set(actor.address, await fundraiser.epochAccountToDonation(nowEpoch, actor.address));
        }

        if (badAmount.eq(0)) {
          await expect(
            fundraiser.connect(payer).fund(account.address, badAmount, `bad-${step}`)
          ).to.be.revertedWith("Fundraiser__BelowMinDonation()");
        } else {
          await expect(fundraiser.connect(payer).fund(account.address, badAmount, `bad-${step}`)).to.be.revertedWith(
            "Fundraiser__BelowMinDonation()"
          );
        }

        for (const actor of allSigners) {
          const after = await fundraiser.epochAccountToDonation(nowEpoch, actor.address);
          expect(after).to.equal(beforeMap.get(actor.address));
        }
      } else {
        // assert consistency-only pass
        const sample = allSigners[randBetween(rng, 0, allSigners.length - 1)];
        const nextEpoch = await fundraiser.currentEpoch();
        const amount = await fundraiser.getPendingReward(nextEpoch.sub(1).gt(0) ? nextEpoch.sub(1) : ethers.BigNumber.from(0), sample.address);
        const currentDonation = await fundraiser.epochAccountToDonation(nextEpoch.sub(1).gt(0) ? nextEpoch.sub(1) : ethers.BigNumber.from(0), sample.address);
        if (!currentDonation.eq(ZR) && amount.gt(0)) {
          expect(await fundraiser.getPendingReward(nextEpoch.sub(1).gt(0) ? nextEpoch.sub(1) : ethers.BigNumber.from(0), sample.address)).to.equal(
            amount
          );
        }
      }

      if (step % 12 === 0 || step === steps - 1) {
        await assertTrackedInvariants();
      }
    }

    // final global invariant check across all tracked epochs and all known actors
    await assertTrackedInvariants();
  });

  it("should not let anyone claim twice even via re-entrant style repeated call patterns", async function () {
    const payer = allSigners[0];
    const beneficiary = allSigners[1];
    const amount = convert("500", 6);

    await paymentToken.connect(payer).approve(fundraiser.address, amount);
    await fundraiser.connect(payer).fund(beneficiary.address, amount, "once");

    await increaseTime(ONE_DAY + 1);
    const epoch = await fundraiser.currentEpoch();
    await fundraiser.connect(payer).claim(beneficiary.address, epoch.sub(1));

    await expect(fundraiser.connect(payer).claim(beneficiary.address, epoch.sub(1))).to.be.revertedWith(
      "Fundraiser__AlreadyClaimed()"
    );
  });
});

