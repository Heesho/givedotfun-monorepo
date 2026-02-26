const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const AddressZero = "0x0000000000000000000000000000000000000000";
const AddressDead = "0x000000000000000000000000000000000000dEaD";

// Time helpers
async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function getBlockTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

const ONE_HOUR = 3600;
const ONE_DAY = 86400;
const YEAR = 365 * ONE_DAY;

let owner, buyer, receiver, user0, user1;
let lpToken, assetToken, assetToken2;
let auction;

// Default auction parameters (initPrice uses same scale as paymentToken — 6 decimals for MockUSDC)
const DEFAULT_INIT_PRICE = convert("1000", 6); // 1000 USDC worth of LP tokens
const DEFAULT_EPOCH_PERIOD = ONE_DAY;
const DEFAULT_PRICE_MULTIPLIER = convert("1.5", 18); // 1.5x
const DEFAULT_MIN_INIT_PRICE = convert("1", 6); // 1e6 (ABS_MIN_INIT_PRICE)
const ABS_MIN_INIT_PRICE = ethers.BigNumber.from("1000000"); // 1e6
const ABS_MAX_INIT_PRICE = ethers.BigNumber.from(2).pow(192).sub(1); // type(uint192).max
const PRECISION = convert("1", 18);

describe("Auction Tests", function () {
  before("Initial set up", async function () {
    await network.provider.send("hardhat_reset");
    console.log("Begin Initialization");

    [owner, buyer, receiver, user0, user1] = await ethers.getSigners();

    // Deploy mock LP token (payment token) - using MockUSDC for simplicity
    const mockUsdcArtifact = await ethers.getContractFactory("MockUSDC");
    lpToken = await mockUsdcArtifact.deploy();
    console.log("- LP Token (MockUSDC) Initialized");

    // Deploy mock asset tokens (tokens that accumulate in the auction)
    assetToken = await mockUsdcArtifact.deploy();
    console.log("- Asset Token 1 Initialized");

    assetToken2 = await mockUsdcArtifact.deploy();
    console.log("- Asset Token 2 Initialized");

    // Mint LP tokens to buyers (generous supply)
    await lpToken.mint(buyer.address, convert("100000000", 6));
    await lpToken.mint(user0.address, convert("100000000", 6));
    console.log("- LP tokens minted to buyers");

    console.log("Initialization Complete\n");
  });

  describe("Constructor Validation Tests", function () {
    it("Should deploy with valid parameters", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      auction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        DEFAULT_EPOCH_PERIOD,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );
      expect(auction.address).to.not.equal(AddressZero);
      console.log("Auction deployed at:", auction.address);
    });

    it("Should have correct initial state", async function () {
      console.log("******************************************************");
      expect(await auction.epochId()).to.equal(0);
      expect(await auction.initPrice()).to.equal(DEFAULT_INIT_PRICE);
      expect(await auction.paymentToken()).to.equal(lpToken.address);
      expect(await auction.paymentReceiver()).to.equal(AddressDead);
      expect(await auction.epochPeriod()).to.equal(DEFAULT_EPOCH_PERIOD);
      expect(await auction.priceMultiplier()).to.equal(DEFAULT_PRICE_MULTIPLIER);
      expect(await auction.minInitPrice()).to.equal(DEFAULT_MIN_INIT_PRICE);

      const startTime = await auction.startTime();
      expect(startTime).to.be.gt(0);
      console.log("Initial state verified");
      console.log("  epochId:", (await auction.epochId()).toString());
      console.log("  initPrice:", divDec(await auction.initPrice(), 6));
      console.log("  startTime:", startTime.toString());
    });

    it("Should revert with zero paymentToken address", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      await expect(
        auctionArtifact.deploy(
          AddressZero,
          AddressDead,
          DEFAULT_INIT_PRICE,
          DEFAULT_EPOCH_PERIOD,
          DEFAULT_PRICE_MULTIPLIER,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__ZeroAddress()");
      console.log("Correctly reverted with zero paymentToken");
    });

    it("Should revert with zero paymentReceiver address", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressZero,
          DEFAULT_INIT_PRICE,
          DEFAULT_EPOCH_PERIOD,
          DEFAULT_PRICE_MULTIPLIER,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__ZeroAddress()");
      console.log("Correctly reverted with zero paymentReceiver");
    });

    it("Should revert with initPrice below minInitPrice", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const lowInitPrice = ethers.BigNumber.from("500000"); // 0.5e6, below minInitPrice of 1e6
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          lowInitPrice,
          DEFAULT_EPOCH_PERIOD,
          DEFAULT_PRICE_MULTIPLIER,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__InitPriceOutOfRange()");
      console.log("Correctly reverted with initPrice below minInitPrice");
    });

    it("Should revert with initPrice above ABS_MAX_INIT_PRICE", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const tooHighInitPrice = ABS_MAX_INIT_PRICE.add(1);
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          tooHighInitPrice,
          DEFAULT_EPOCH_PERIOD,
          DEFAULT_PRICE_MULTIPLIER,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__InitPriceOutOfRange()");
      console.log("Correctly reverted with initPrice above ABS_MAX_INIT_PRICE");
    });

    it("Should revert with epochPeriod too short (< 1 hour)", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const shortPeriod = ONE_HOUR - 1; // 3599 seconds
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          DEFAULT_INIT_PRICE,
          shortPeriod,
          DEFAULT_PRICE_MULTIPLIER,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__EpochPeriodOutOfRange()");
      console.log("Correctly reverted with epochPeriod < 1 hour");
    });

    it("Should revert with epochPeriod too long (> 365 days)", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const longPeriod = YEAR + 1;
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          DEFAULT_INIT_PRICE,
          longPeriod,
          DEFAULT_PRICE_MULTIPLIER,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__EpochPeriodOutOfRange()");
      console.log("Correctly reverted with epochPeriod > 365 days");
    });

    it("Should revert with priceMultiplier too low (< 1.1e18)", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const lowMultiplier = convert("1.09", 18); // below 1.1e18
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          DEFAULT_INIT_PRICE,
          DEFAULT_EPOCH_PERIOD,
          lowMultiplier,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__PriceMultiplierOutOfRange()");
      console.log("Correctly reverted with priceMultiplier < 1.1e18");
    });

    it("Should revert with priceMultiplier too high (> 3e18)", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const highMultiplier = convert("3.01", 18); // above 3e18
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          DEFAULT_INIT_PRICE,
          DEFAULT_EPOCH_PERIOD,
          highMultiplier,
          DEFAULT_MIN_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__PriceMultiplierOutOfRange()");
      console.log("Correctly reverted with priceMultiplier > 3e18");
    });

    it("Should revert with minInitPrice below ABS_MIN_INIT_PRICE", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const tooLowMin = ABS_MIN_INIT_PRICE.sub(1); // below 1e6
      await expect(
        auctionArtifact.deploy(
          lpToken.address,
          AddressDead,
          DEFAULT_INIT_PRICE,
          DEFAULT_EPOCH_PERIOD,
          DEFAULT_PRICE_MULTIPLIER,
          tooLowMin
        )
      ).to.be.revertedWith("Auction__MinInitPriceOutOfRange()");
      console.log("Correctly reverted with minInitPrice below ABS_MIN_INIT_PRICE");
    });

    it("Should deploy with boundary parameters (exact minimums and maximums)", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");

      // Min epoch period (1 hour), min price multiplier (1.1x), min init price (1e6)
      const auctionMin = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        ABS_MIN_INIT_PRICE, // initPrice = minInitPrice = 1e6
        ONE_HOUR, // min epoch period
        convert("1.1", 18), // min price multiplier
        ABS_MIN_INIT_PRICE // min init price
      );
      expect(auctionMin.address).to.not.equal(AddressZero);
      console.log("Deployed with minimum boundary parameters");

      // Max epoch period (365 days), max price multiplier (3x)
      const auctionMax = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        YEAR, // max epoch period
        convert("3", 18), // max price multiplier
        DEFAULT_MIN_INIT_PRICE
      );
      expect(auctionMax.address).to.not.equal(AddressZero);
      console.log("Deployed with maximum boundary parameters");
    });
  });

  describe("Price Decay Tests", function () {
    before(async function () {
      // Deploy a fresh auction for price tests
      const auctionArtifact = await ethers.getContractFactory("Auction");
      auction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        DEFAULT_EPOCH_PERIOD,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );
    });

    it("Should return initPrice at time 0", async function () {
      console.log("******************************************************");
      const price = await auction.getPrice();
      expect(price).to.equal(DEFAULT_INIT_PRICE);
      console.log("Price at t=0:", divDec(price, 6));
    });

    it("Should return ~half price at half epoch", async function () {
      console.log("******************************************************");
      const halfEpoch = DEFAULT_EPOCH_PERIOD / 2;
      await increaseTime(halfEpoch);

      const price = await auction.getPrice();
      const expectedHalf = DEFAULT_INIT_PRICE.div(2);
      const tolerance = DEFAULT_INIT_PRICE.div(100); // 1% tolerance

      console.log("Price at half epoch:", divDec(price, 6));
      console.log("Expected ~half:", divDec(expectedHalf, 6));

      expect(price).to.be.closeTo(expectedHalf, tolerance);
    });

    it("Should return 0 after epoch period ends", async function () {
      console.log("******************************************************");
      const halfEpoch = DEFAULT_EPOCH_PERIOD / 2;
      await increaseTime(halfEpoch + 1);

      const price = await auction.getPrice();
      expect(price).to.equal(0);
      console.log("Price after epoch ends:", price.toString());
    });

    it("Should return 0 well after epoch period ends", async function () {
      console.log("******************************************************");
      await increaseTime(ONE_DAY * 5);

      const price = await auction.getPrice();
      expect(price).to.equal(0);
      console.log("Price well after epoch:", price.toString());
    });
  });

  describe("Buy Tests", function () {
    beforeEach(async function () {
      // Deploy a fresh auction for each buy test
      const auctionArtifact = await ethers.getContractFactory("Auction");
      auction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        DEFAULT_EPOCH_PERIOD,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );

      // Send some asset tokens to the auction (simulating accumulated fees)
      await assetToken.mint(auction.address, convert("500", 6));
      await assetToken2.mint(auction.address, convert("200", 6));
    });

    it("Should successfully buy accumulated assets", async function () {
      console.log("******************************************************");
      // Approve generously since price decays between getPrice() and buy()
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      console.log("Buy successful");
    });

    it("Should transfer LP tokens to paymentReceiver (burn address)", async function () {
      console.log("******************************************************");
      const burnBalanceBefore = await lpToken.balanceOf(AddressDead);

      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      const tx = await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      // Get actual payment from event
      const receipt = await tx.wait();
      const buyEvent = receipt.events.find((e) => e.event === "Auction__Buy");
      const actualPayment = buyEvent.args.paymentAmount;

      const burnBalanceAfter = await lpToken.balanceOf(AddressDead);
      const burned = burnBalanceAfter.sub(burnBalanceBefore);

      expect(burned).to.equal(actualPayment);
      expect(burned).to.be.gt(0);
      console.log("LP tokens burned:", divDec(burned, 6));
    });

    it("Should transfer all accumulated assets to buyer", async function () {
      console.log("******************************************************");
      const assetBalanceBefore = await assetToken.balanceOf(receiver.address);
      const asset2BalanceBefore = await assetToken2.balanceOf(receiver.address);

      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      await auction.connect(buyer).buy(
        [assetToken.address, assetToken2.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      const assetBalanceAfter = await assetToken.balanceOf(receiver.address);
      const asset2BalanceAfter = await assetToken2.balanceOf(receiver.address);

      expect(assetBalanceAfter.sub(assetBalanceBefore)).to.equal(convert("500", 6));
      expect(asset2BalanceAfter.sub(asset2BalanceBefore)).to.equal(convert("200", 6));

      // Auction should have zero balance of these assets
      expect(await assetToken.balanceOf(auction.address)).to.equal(0);
      expect(await assetToken2.balanceOf(auction.address)).to.equal(0);

      console.log("Assets transferred: 500 + 200");
    });

    it("Should increment epochId after buy", async function () {
      console.log("******************************************************");
      expect(await auction.epochId()).to.equal(0);

      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      expect(await auction.epochId()).to.equal(1);
      console.log("epochId incremented to 1");
    });

    it("Should update startTime after buy", async function () {
      console.log("******************************************************");
      const startTimeBefore = await auction.startTime();

      // Advance some time so startTime clearly changes
      await increaseTime(ONE_HOUR);

      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      const startTimeAfter = await auction.startTime();
      expect(startTimeAfter).to.be.gt(startTimeBefore);
      console.log("startTime updated from", startTimeBefore.toString(), "to", startTimeAfter.toString());
    });

    it("Should calculate correct newInitPrice (paymentAmount * priceMultiplier / 1e18)", async function () {
      console.log("******************************************************");
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      const tx = await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      // Get actual payment from event to compute expected newInitPrice
      const receipt = await tx.wait();
      const buyEvent = receipt.events.find((e) => e.event === "Auction__Buy");
      const actualPayment = buyEvent.args.paymentAmount;

      // newInitPrice = paymentAmount * priceMultiplier / PRECISION
      const expectedNewInitPrice = actualPayment.mul(DEFAULT_PRICE_MULTIPLIER).div(PRECISION);
      const actualNewInitPrice = await auction.initPrice();

      // The expected price should be within the valid range
      if (expectedNewInitPrice.lt(DEFAULT_MIN_INIT_PRICE)) {
        expect(actualNewInitPrice).to.equal(DEFAULT_MIN_INIT_PRICE);
      } else if (expectedNewInitPrice.gt(ABS_MAX_INIT_PRICE)) {
        expect(actualNewInitPrice).to.equal(ABS_MAX_INIT_PRICE);
      } else {
        expect(actualNewInitPrice).to.equal(expectedNewInitPrice);
      }

      console.log("Payment amount:", divDec(actualPayment, 6));
      console.log("New init price:", divDec(actualNewInitPrice, 6));
      console.log("Expected:", divDec(expectedNewInitPrice, 6));
    });

    it("Should clamp newInitPrice to minInitPrice when price is low", async function () {
      console.log("******************************************************");
      // Wait until price decays to zero
      await increaseTime(DEFAULT_EPOCH_PERIOD + 1);

      const currentPrice = await auction.getPrice();
      expect(currentPrice).to.equal(0);

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        0
      );

      // paymentAmount = 0, so newInitPrice = 0 * multiplier / precision = 0
      // But should be clamped to minInitPrice
      const newInitPrice = await auction.initPrice();
      expect(newInitPrice).to.equal(DEFAULT_MIN_INIT_PRICE);
      console.log("newInitPrice clamped to minInitPrice:", newInitPrice.toString());
    });

    it("Should emit Auction__Buy event", async function () {
      console.log("******************************************************");
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      // Just verify the event is emitted with correct buyer and receiver
      // The paymentAmount varies due to block timing, so we check it via receipt
      const tx = await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      const receipt = await tx.wait();
      const buyEvent = receipt.events.find((e) => e.event === "Auction__Buy");

      expect(buyEvent).to.not.be.undefined;
      expect(buyEvent.args.buyer).to.equal(buyer.address);
      expect(buyEvent.args.assetsReceiver).to.equal(receiver.address);
      expect(buyEvent.args.paymentAmount).to.be.gt(0);
      console.log("Auction__Buy event emitted correctly");
      console.log("  paymentAmount:", divDec(buyEvent.args.paymentAmount, 6));
    });

    it("Should allow buy at zero price (after full epoch decay)", async function () {
      console.log("******************************************************");
      // Wait for full price decay
      await increaseTime(DEFAULT_EPOCH_PERIOD + 1);

      const currentPrice = await auction.getPrice();
      expect(currentPrice).to.equal(0);

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      // Buy at price 0 (no LP tokens needed)
      const buyerLpBefore = await lpToken.balanceOf(buyer.address);
      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        0
      );
      const buyerLpAfter = await lpToken.balanceOf(buyer.address);

      // No LP tokens should have been spent
      expect(buyerLpAfter).to.equal(buyerLpBefore);
      console.log("Buy at zero price successful, no LP tokens spent");
    });

    it("Should handle buy with single asset", async function () {
      console.log("******************************************************");
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      const receiverBalBefore = await assetToken.balanceOf(receiver.address);

      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      const receiverBalAfter = await assetToken.balanceOf(receiver.address);
      expect(receiverBalAfter.sub(receiverBalBefore)).to.equal(convert("500", 6));
      console.log("Single asset buy successful");
    });
  });

  describe("Buy Validation Tests", function () {
    before(async function () {
      // Deploy a fresh auction
      const auctionArtifact = await ethers.getContractFactory("Auction");
      auction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        DEFAULT_EPOCH_PERIOD,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );

      // Send some assets to auction
      await assetToken.mint(auction.address, convert("500", 6));
    });

    it("Should revert with empty assets array", async function () {
      console.log("******************************************************");
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);

      await expect(
        auction.connect(buyer).buy(
          [], // empty assets
          receiver.address,
          0,
          deadline,
          DEFAULT_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__EmptyAssets()");
      console.log("Correctly reverted with empty assets array");
    });

    it("Should revert when deadline has passed", async function () {
      console.log("******************************************************");
      const pastDeadline = (await getBlockTimestamp()) - 1; // already passed
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);

      await expect(
        auction.connect(buyer).buy(
          [assetToken.address],
          receiver.address,
          0,
          pastDeadline,
          DEFAULT_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__DeadlinePassed()");
      console.log("Correctly reverted with passed deadline");
    });

    it("Should revert when epochId doesn't match", async function () {
      console.log("******************************************************");
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);

      await expect(
        auction.connect(buyer).buy(
          [assetToken.address],
          receiver.address,
          1, // wrong epochId (should be 0)
          deadline,
          DEFAULT_INIT_PRICE
        )
      ).to.be.revertedWith("Auction__EpochIdMismatch()");
      console.log("Correctly reverted with epochId mismatch");
    });

    it("Should revert when payment exceeds maxPaymentTokenAmount", async function () {
      console.log("******************************************************");
      // Use a maxPaymentTokenAmount of 0 — any non-zero price will exceed it
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);

      await expect(
        auction.connect(buyer).buy(
          [assetToken.address],
          receiver.address,
          0,
          deadline,
          0 // maxPaymentTokenAmount = 0, but price > 0
        )
      ).to.be.revertedWith("Auction__MaxPaymentAmountExceeded()");
      console.log("Correctly reverted with maxPaymentTokenAmount exceeded");
    });
  });

  describe("Epoch Transition Tests", function () {
    before(async function () {
      // Deploy a fresh auction with shorter epoch for faster testing
      const auctionArtifact = await ethers.getContractFactory("Auction");
      auction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        ONE_HOUR, // 1 hour epoch for faster transitions
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );

      // Send assets
      await assetToken.mint(auction.address, convert("500", 6));
    });

    it("Should start new epoch after buy", async function () {
      console.log("******************************************************");
      expect(await auction.epochId()).to.equal(0);

      await lpToken.connect(buyer).approve(auction.address, DEFAULT_INIT_PRICE);
      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      expect(await auction.epochId()).to.equal(1);
      console.log("New epoch started, epochId:", (await auction.epochId()).toString());
    });

    it("Price should start from newInitPrice in new epoch", async function () {
      console.log("******************************************************");
      // The previous buy set a new initPrice
      const currentInitPrice = await auction.initPrice();
      const currentPrice = await auction.getPrice();

      // Price should be close to initPrice (we just started the epoch)
      console.log("New epoch initPrice:", divDec(currentInitPrice, 6));
      console.log("Current price:", divDec(currentPrice, 6));

      // Allow some tolerance since a block has been mined since the epoch started
      expect(currentPrice).to.be.lte(currentInitPrice);
      expect(currentPrice).to.be.gt(0);
    });

    it("Multiple buys across epochs should work correctly", async function () {
      console.log("******************************************************");

      for (let i = 0; i < 3; i++) {
        const epochBefore = await auction.epochId();
        console.log(`\nEpoch ${epochBefore.toString()}:`);

        // Send assets to auction
        await assetToken.mint(auction.address, convert("100", 6));

        // Get current price and approve generously
        const initPrice = await auction.initPrice();
        console.log("  initPrice:", divDec(initPrice, 6));

        const deadline = (await getBlockTimestamp()) + ONE_HOUR * 2;
        await lpToken.connect(buyer).approve(auction.address, initPrice);

        await auction.connect(buyer).buy(
          [assetToken.address],
          receiver.address,
          epochBefore,
          deadline,
          initPrice // use initPrice as max (actual price will be <= initPrice)
        );

        const epochAfter = await auction.epochId();
        expect(epochAfter).to.equal(epochBefore.add(1));
        console.log("  Epoch advanced to:", epochAfter.toString());

        const newInitPrice = await auction.initPrice();
        console.log("  New initPrice:", divDec(newInitPrice, 6));
      }
    });

    it("Should use correct epochId for sequential buys", async function () {
      console.log("******************************************************");
      const currentEpoch = await auction.epochId();

      // Send assets
      await assetToken.mint(auction.address, convert("100", 6));

      const initPrice = await auction.initPrice();
      const deadline = (await getBlockTimestamp()) + ONE_HOUR * 2;
      await lpToken.connect(buyer).approve(auction.address, initPrice);

      // Using wrong epochId should fail
      await expect(
        auction.connect(buyer).buy(
          [assetToken.address],
          receiver.address,
          currentEpoch.sub(1), // previous epoch
          deadline,
          initPrice
        )
      ).to.be.revertedWith("Auction__EpochIdMismatch()");

      // Using correct epochId should succeed
      await auction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        currentEpoch, // correct epoch
        deadline,
        initPrice
      );

      console.log("Sequential buy with correct epochId succeeded");
    });
  });

  describe("Price Multiplier and Clamping Tests", function () {
    it("Should apply price multiplier correctly after buy", async function () {
      console.log("******************************************************");
      // Deploy auction with a known price multiplier of 2x
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const testAuction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        convert("1000", 6), // initPrice = 1000 (6 decimals)
        ONE_DAY,
        convert("2", 18), // 2x multiplier
        DEFAULT_MIN_INIT_PRICE
      );

      await assetToken.mint(testAuction.address, convert("100", 6));

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(testAuction.address, convert("1000", 6));

      const tx = await testAuction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        convert("1000", 6)
      );

      // Get actual payment from event
      const receipt = await tx.wait();
      const buyEvent = receipt.events.find((e) => e.event === "Auction__Buy");
      const actualPayment = buyEvent.args.paymentAmount;

      // newInitPrice = actualPayment * 2e18 / 1e18 = actualPayment * 2
      const expectedNewInit = actualPayment.mul(convert("2", 18)).div(PRECISION);
      const actualNewInit = await testAuction.initPrice();
      expect(actualNewInit).to.equal(expectedNewInit);
      console.log("Price multiplier applied: 2x");
      console.log("  Payment:", divDec(actualPayment, 6));
      console.log("  New initPrice:", divDec(actualNewInit, 6));
    });

    it("Should not exceed initPrice * multiplier for newInitPrice", async function () {
      console.log("******************************************************");
      // Deploy with large initPrice and 3x multiplier
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const testAuction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        convert("50000000", 6), // 50M (6 decimals)
        ONE_DAY,
        convert("3", 18), // 3x multiplier
        DEFAULT_MIN_INIT_PRICE
      );

      await assetToken.mint(testAuction.address, convert("100", 6));

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(testAuction.address, convert("50000000", 6));

      const tx = await testAuction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        convert("50000000", 6)
      );

      const receipt = await tx.wait();
      const buyEvent = receipt.events.find((e) => e.event === "Auction__Buy");
      const actualPayment = buyEvent.args.paymentAmount;

      const expectedNewInit = actualPayment.mul(convert("3", 18)).div(PRECISION);
      const actualNewInit = await testAuction.initPrice();

      // Should be exactly the multiplied price (still below ABS_MAX)
      expect(actualNewInit).to.equal(expectedNewInit);
      expect(actualNewInit).to.be.lt(ABS_MAX_INIT_PRICE);
      console.log("Verified price multiplier 3x, result below ABS_MAX");
      console.log("  New initPrice:", divDec(actualNewInit, 6));
    });

    it("Should clamp to minInitPrice when decayed price makes newInitPrice too low", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const highMinPrice = convert("100", 6); // minInitPrice = 100 USDC
      const testAuction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        convert("1000", 6), // initPrice = 1000
        ONE_HOUR,
        convert("1.1", 18), // 1.1x multiplier
        highMinPrice // high minInitPrice
      );

      await assetToken.mint(testAuction.address, convert("100", 6));

      // Wait for 95% decay: price ~ 1000 * 0.05 = 50
      // newInitPrice = 50 * 1.1 = 55, which is < minInitPrice of 100 => clamped
      await increaseTime(Math.floor(ONE_HOUR * 0.95));

      const price = await testAuction.getPrice();
      console.log("Decayed price:", divDec(price, 6));

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(testAuction.address, price);

      await testAuction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        price
      );

      const actualNewInit = await testAuction.initPrice();
      expect(actualNewInit).to.equal(highMinPrice);
      console.log("newInitPrice clamped to minInitPrice:", divDec(actualNewInit, 6));
    });
  });

  describe("Edge Case Tests", function () {
    it("Should handle buy when auction has zero balance of an asset", async function () {
      console.log("******************************************************");
      // Deploy fresh auction with NO assets in it
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const testAuction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        DEFAULT_EPOCH_PERIOD,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );

      // Wait for full price decay so no payment needed
      await increaseTime(DEFAULT_EPOCH_PERIOD + 1);

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;

      // Buy with zero balance assets - safeTransfer(0) should work
      await testAuction.connect(buyer).buy(
        [assetToken.address],
        receiver.address,
        0,
        deadline,
        0
      );

      expect(await testAuction.epochId()).to.equal(1);
      console.log("Buy with zero asset balance succeeded");
    });

    it("Should allow different buyer and assetsReceiver", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const testAuction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        ONE_HOUR,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );

      await assetToken.mint(testAuction.address, convert("100", 6));

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(testAuction.address, DEFAULT_INIT_PRICE);

      const receiverBalBefore = await assetToken.balanceOf(user1.address);

      // buyer buys, but user1 receives the assets
      await testAuction.connect(buyer).buy(
        [assetToken.address],
        user1.address, // different from buyer
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      const receiverBalAfter = await assetToken.balanceOf(user1.address);
      expect(receiverBalAfter.sub(receiverBalBefore)).to.equal(convert("100", 6));
      console.log("Different buyer and receiver worked correctly");
    });

    it("Should handle multiple assets in a single buy", async function () {
      console.log("******************************************************");
      const auctionArtifact = await ethers.getContractFactory("Auction");
      const testAuction = await auctionArtifact.deploy(
        lpToken.address,
        AddressDead,
        DEFAULT_INIT_PRICE,
        ONE_HOUR,
        DEFAULT_PRICE_MULTIPLIER,
        DEFAULT_MIN_INIT_PRICE
      );

      // Fund auction with multiple assets
      await assetToken.mint(testAuction.address, convert("300", 6));
      await assetToken2.mint(testAuction.address, convert("700", 6));

      const deadline = (await getBlockTimestamp()) + ONE_HOUR;
      await lpToken.connect(buyer).approve(testAuction.address, DEFAULT_INIT_PRICE);

      const asset1Before = await assetToken.balanceOf(receiver.address);
      const asset2Before = await assetToken2.balanceOf(receiver.address);

      await testAuction.connect(buyer).buy(
        [assetToken.address, assetToken2.address],
        receiver.address,
        0,
        deadline,
        DEFAULT_INIT_PRICE
      );

      const asset1After = await assetToken.balanceOf(receiver.address);
      const asset2After = await assetToken2.balanceOf(receiver.address);

      expect(asset1After.sub(asset1Before)).to.equal(convert("300", 6));
      expect(asset2After.sub(asset2Before)).to.equal(convert("700", 6));
      console.log("Multiple assets transferred in single buy");
    });

    it("Should return correct constant values", async function () {
      console.log("******************************************************");
      expect(await auction.MIN_EPOCH_PERIOD()).to.equal(ONE_HOUR);
      expect(await auction.MAX_EPOCH_PERIOD()).to.equal(YEAR);
      expect(await auction.MIN_PRICE_MULTIPLIER()).to.equal(convert("1.1", 18));
      expect(await auction.MAX_PRICE_MULTIPLIER()).to.equal(convert("3", 18));
      expect(await auction.ABS_MIN_INIT_PRICE()).to.equal(ABS_MIN_INIT_PRICE);
      expect(await auction.ABS_MAX_INIT_PRICE()).to.equal(ABS_MAX_INIT_PRICE);
      expect(await auction.PRECISION()).to.equal(PRECISION);
      console.log("All constants verified");
    });
  });
});
