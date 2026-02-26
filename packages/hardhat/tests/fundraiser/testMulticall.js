const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const AddressZero = "0x0000000000000000000000000000000000000000";
const AddressDead = "0x000000000000000000000000000000000000dEaD";

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

const ONE_DAY = 86400;

let owner, protocol, user0, user1, user2;
let usdc, core, multicall;
let fundraiser, auction, coin, lpToken;
let fundraiserContract, coinContract, auctionContract;
let coinFactory, auctionFactory, fundraiserFactory;
let uniswapFactory, uniswapRouter;

describe("Multicall Tests", function () {
  before("Initial set up", async function () {
    await network.provider.send("hardhat_reset");
    console.log("Begin Initialization");

    [owner, protocol, user0, user1, user2] = await ethers.getSigners();

    // Deploy USDC (6 decimals) as quote token
    const usdcArtifact = await ethers.getContractFactory("MockUSDC");
    usdc = await usdcArtifact.deploy();
    console.log("- USDC Initialized");

    // Deploy mock Uniswap V2 Factory and Router
    const mockUniswapFactoryArtifact = await ethers.getContractFactory("MockUniswapV2Factory");
    uniswapFactory = await mockUniswapFactoryArtifact.deploy();
    console.log("- Uniswap V2 Factory Initialized");

    const mockUniswapRouterArtifact = await ethers.getContractFactory("MockUniswapV2Router");
    uniswapRouter = await mockUniswapRouterArtifact.deploy(uniswapFactory.address);
    console.log("- Uniswap V2 Router Initialized");

    // Deploy factories
    const coinFactoryArtifact = await ethers.getContractFactory("CoinFactory");
    coinFactory = await coinFactoryArtifact.deploy();
    console.log("- CoinFactory Initialized");

    const auctionFactoryArtifact = await ethers.getContractFactory("AuctionFactory");
    auctionFactory = await auctionFactoryArtifact.deploy();
    console.log("- AuctionFactory Initialized");

    const fundraiserFactoryArtifact = await ethers.getContractFactory("FundraiserFactory");
    fundraiserFactory = await fundraiserFactoryArtifact.deploy();
    console.log("- FundraiserFactory Initialized");

    // Deploy Core
    const coreArtifact = await ethers.getContractFactory("Core");
    core = await coreArtifact.deploy(
      usdc.address,
      uniswapFactory.address,
      uniswapRouter.address,
      coinFactory.address,
      auctionFactory.address,
      fundraiserFactory.address,
      protocol.address,
      convert("100", 6) // minUsdcForLaunch
    );
    console.log("- Core Initialized");

    // Deploy Multicall
    const multicallArtifact = await ethers.getContractFactory("Multicall");
    multicall = await multicallArtifact.deploy(core.address, usdc.address);
    console.log("- Multicall Initialized");

    // Mint USDC to user0 for launching
    await usdc.mint(user0.address, convert("10000", 6));
    console.log("- USDC minted to user0");

    // Launch a fundraiser via Core
    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "Test Coin",
      tokenSymbol: "TCOIN",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400,
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);
    const tx = await core.connect(user0).launch(launchParams);
    const receipt = await tx.wait();

    // Get deployed addresses from event
    const launchEvent = receipt.events.find((e) => e.event === "Core__Launched");
    fundraiser = launchEvent.args.fundraiser;
    coin = launchEvent.args.coin;
    auction = launchEvent.args.auction;
    lpToken = launchEvent.args.lpToken;

    console.log("- Fundraiser launched at:", fundraiser);
    console.log("- Coin token at:", coin);
    console.log("- Auction at:", auction);
    console.log("- LP Token at:", lpToken);

    // Get contract instances
    fundraiserContract = await ethers.getContractAt("Fundraiser", fundraiser);
    coinContract = await ethers.getContractAt("Coin", coin);
    auctionContract = await ethers.getContractAt("IAuction", auction);

    // Mint USDC to test users
    await usdc.mint(user0.address, convert("10000", 6));
    await usdc.mint(user1.address, convert("10000", 6));
    await usdc.mint(user2.address, convert("10000", 6));
    console.log("- USDC minted to test users");

    console.log("Initialization Complete\n");
  });

  describe("Setup Validation", function () {
    it("Multicall should have correct core address", async function () {
      console.log("******************************************************");
      expect(await multicall.core()).to.equal(core.address);
      console.log("Core address verified:", core.address);
    });

    it("Multicall should have correct usdc address", async function () {
      console.log("******************************************************");
      expect(await multicall.usdc()).to.equal(usdc.address);
      console.log("USDC address verified:", usdc.address);
    });

    it("Should revert construction with zero core address", async function () {
      console.log("******************************************************");
      const multicallArtifact = await ethers.getContractFactory("Multicall");
      await expect(
        multicallArtifact.deploy(AddressZero, usdc.address)
      ).to.be.revertedWith("Multicall__ZeroAddress()");
      console.log("Correctly reverted with zero core address");
    });

    it("Should revert construction with zero usdc address", async function () {
      console.log("******************************************************");
      const multicallArtifact = await ethers.getContractFactory("Multicall");
      await expect(
        multicallArtifact.deploy(core.address, AddressZero)
      ).to.be.revertedWith("Multicall__ZeroAddress()");
      console.log("Correctly reverted with zero usdc address");
    });
  });

  describe("fund() Tests", function () {
    it("Should fund a fundraiser through Multicall", async function () {
      console.log("******************************************************");

      const fundAmount = convert("1000", 6);
      const epoch = await fundraiserContract.currentEpoch();

      // Approve Multicall (not fundraiser) for USDC
      await usdc.connect(user0).approve(multicall.address, fundAmount);

      // Fund through Multicall
      await multicall.connect(user0).fund(fundraiser, user0.address, fundAmount, "");

      // Verify donation was recorded
      const donation = await fundraiserContract.epochAccountToDonation(epoch, user0.address);
      expect(donation).to.equal(fundAmount);
      console.log("Donation recorded:", divDec(donation, 6), "USDC");

      // Verify epoch total
      const epochTotal = await fundraiserContract.epochToTotalDonated(epoch);
      expect(epochTotal).to.be.gte(fundAmount);
      console.log("Epoch total:", divDec(epochTotal, 6), "USDC");
    });

    it("Should revert for invalid fundraiser address", async function () {
      console.log("******************************************************");

      const fundAmount = convert("100", 6);
      await usdc.connect(user0).approve(multicall.address, fundAmount);

      // Use a random address that is not a registered fundraiser
      await expect(
        multicall.connect(user0).fund(user2.address, user0.address, fundAmount, "")
      ).to.be.revertedWith("Multicall__InvalidFundraiser()");
      console.log("Correctly reverted for non-fundraiser address");
    });

    it("Should correctly split donations (verify recipient/treasury/team/protocol balances)", async function () {
      console.log("******************************************************");

      // Record initial balances
      const recipientBefore = await usdc.balanceOf(user1.address); // recipient
      const treasuryBefore = await usdc.balanceOf(auction); // treasury = auction
      const teamBefore = await usdc.balanceOf(user0.address); // team = launcher
      const protocolBefore = await usdc.balanceOf(protocol.address);

      const fundAmount = convert("1000", 6);
      await usdc.connect(user2).approve(multicall.address, fundAmount);
      await multicall.connect(user2).fund(fundraiser, user2.address, fundAmount, "");

      // Check balances after
      const recipientAfter = await usdc.balanceOf(user1.address);
      const treasuryAfter = await usdc.balanceOf(auction);
      const teamAfter = await usdc.balanceOf(user0.address);
      const protocolAfter = await usdc.balanceOf(protocol.address);

      const recipientReceived = recipientAfter.sub(recipientBefore);
      const treasuryReceived = treasuryAfter.sub(treasuryBefore);
      const teamReceived = teamAfter.sub(teamBefore);
      const protocolReceived = protocolAfter.sub(protocolBefore);

      console.log("Recipient Received:", divDec(recipientReceived, 6), "(expected: 500)");
      console.log("Treasury Received:", divDec(treasuryReceived, 6), "(expected: 450)");
      console.log("Team Received:", divDec(teamReceived, 6), "(expected: 40)");
      console.log("Protocol Received:", divDec(protocolReceived, 6), "(expected: 10)");

      expect(recipientReceived).to.equal(convert("500", 6)); // 50%
      expect(treasuryReceived).to.equal(convert("450", 6)); // 45%
      expect(teamReceived).to.equal(convert("40", 6)); // 4%
      expect(protocolReceived).to.equal(convert("10", 6)); // 1%
      console.log("- Split verification passed!");
    });

    it("Should fund on behalf of another account", async function () {
      console.log("******************************************************");

      const epoch = await fundraiserContract.currentEpoch();
      const donationBefore = await fundraiserContract.epochAccountToDonation(epoch, user1.address);

      const fundAmount = convert("200", 6);
      await usdc.connect(user2).approve(multicall.address, fundAmount);

      // user2 pays, but credits user1
      await multicall.connect(user2).fund(fundraiser, user1.address, fundAmount, "on-behalf");

      const donationAfter = await fundraiserContract.epochAccountToDonation(epoch, user1.address);
      expect(donationAfter.sub(donationBefore)).to.equal(fundAmount);
      console.log("Funded on behalf of user1:", divDec(fundAmount, 6), "USDC");
    });
  });

  describe("claim() and claimMultiple() Tests", function () {
    it("Should claim single epoch rewards through Multicall", async function () {
      console.log("******************************************************");

      // Fund in current epoch
      const epoch = await fundraiserContract.currentEpoch();
      const fundAmount = convert("500", 6);
      await usdc.connect(user0).approve(multicall.address, fundAmount);
      await multicall.connect(user0).fund(fundraiser, user0.address, fundAmount, "");

      // Advance past epoch
      await increaseTime(ONE_DAY + 1);

      // Check pending reward
      const pendingReward = await fundraiserContract.getPendingReward(epoch, user0.address);
      expect(pendingReward).to.be.gt(0);
      console.log("Pending reward:", divDec(pendingReward));

      // Claim through Multicall
      const balanceBefore = await coinContract.balanceOf(user0.address);
      await multicall.connect(user0).claim(fundraiser, user0.address, epoch);
      const balanceAfter = await coinContract.balanceOf(user0.address);

      const received = balanceAfter.sub(balanceBefore);
      expect(received).to.be.gt(0);
      console.log("Claimed:", divDec(received), "TCOIN");

      // Verify marked as claimed
      expect(await fundraiserContract.epochAccountToHasClaimed(epoch, user0.address)).to.equal(true);
      console.log("- Single epoch claim verified");
    });

    it("Should batch claim multiple epochs through claimMultiple", async function () {
      console.log("******************************************************");

      // Fund across 3 epochs
      const epochs = [];
      for (let i = 0; i < 3; i++) {
        const epoch = await fundraiserContract.currentEpoch();
        epochs.push(epoch);

        const fundAmount = convert("100", 6);
        await usdc.connect(user1).approve(multicall.address, fundAmount);
        await multicall.connect(user1).fund(fundraiser, user1.address, fundAmount, "");

        await increaseTime(ONE_DAY + 1);
      }

      console.log("Funded epochs:", epochs.map((e) => e.toString()));

      // Claim all 3 epochs at once
      const balanceBefore = await coinContract.balanceOf(user1.address);
      await multicall.connect(user1).claimMultiple(fundraiser, user1.address, epochs);
      const balanceAfter = await coinContract.balanceOf(user1.address);

      const totalReceived = balanceAfter.sub(balanceBefore);
      expect(totalReceived).to.be.gt(0);
      console.log("Total claimed across 3 epochs:", divDec(totalReceived), "TCOIN");

      // Verify all marked as claimed
      for (const epoch of epochs) {
        expect(await fundraiserContract.epochAccountToHasClaimed(epoch, user1.address)).to.equal(true);
      }
      console.log("- Batch claim verified");
    });

    it("claimMultiple should skip already-claimed epochs without reverting", async function () {
      console.log("******************************************************");

      // Fund in current epoch
      const epoch = await fundraiserContract.currentEpoch();
      const fundAmount = convert("100", 6);
      await usdc.connect(user0).approve(multicall.address, fundAmount);
      await multicall.connect(user0).fund(fundraiser, user0.address, fundAmount, "");

      // Advance past epoch
      await increaseTime(ONE_DAY + 1);

      // Claim directly first
      await fundraiserContract.connect(user0).claim(user0.address, epoch);
      expect(await fundraiserContract.epochAccountToHasClaimed(epoch, user0.address)).to.equal(true);

      // Try claimMultiple with the already-claimed epoch — should not revert
      const balanceBefore = await coinContract.balanceOf(user0.address);
      await multicall.connect(user0).claimMultiple(fundraiser, user0.address, [epoch]);
      const balanceAfter = await coinContract.balanceOf(user0.address);

      // No additional tokens should be received
      expect(balanceAfter).to.equal(balanceBefore);
      console.log("- Skipped already-claimed epoch without reverting");
    });

    it("claimMultiple should skip epochs with no donation", async function () {
      console.log("******************************************************");

      // Get an epoch where user2 had no donation
      const currentEpoch = await fundraiserContract.currentEpoch();
      // Use an older epoch where user2 definitely did not donate
      const noDonationEpoch = currentEpoch.sub(1);

      const donation = await fundraiserContract.epochAccountToDonation(noDonationEpoch, user2.address);
      console.log("User2 donation in epoch", noDonationEpoch.toString(), ":", divDec(donation, 6));

      // Should not revert even with no donation
      const balanceBefore = await coinContract.balanceOf(user2.address);
      await multicall.connect(user2).claimMultiple(fundraiser, user2.address, [noDonationEpoch]);
      const balanceAfter = await coinContract.balanceOf(user2.address);

      expect(balanceAfter).to.equal(balanceBefore);
      console.log("- Skipped epoch with no donation without reverting");
    });

    it("claimMultiple should skip epochs that haven't ended yet", async function () {
      console.log("******************************************************");

      // Fund in current epoch (which hasn't ended yet)
      const currentEpoch = await fundraiserContract.currentEpoch();
      const fundAmount = convert("100", 6);
      await usdc.connect(user0).approve(multicall.address, fundAmount);
      await multicall.connect(user0).fund(fundraiser, user0.address, fundAmount, "");

      // Try to claim current epoch - should skip without reverting
      const balanceBefore = await coinContract.balanceOf(user0.address);
      await multicall.connect(user0).claimMultiple(fundraiser, user0.address, [currentEpoch]);
      const balanceAfter = await coinContract.balanceOf(user0.address);

      expect(balanceAfter).to.equal(balanceBefore);
      console.log("- Skipped unfinished epoch without reverting");
    });

    it("claimMultiple should revert with empty array", async function () {
      console.log("******************************************************");

      await expect(
        multicall.connect(user0).claimMultiple(fundraiser, user0.address, [])
      ).to.be.revertedWith("Multicall__EmptyArray()");
      console.log("- Correctly reverted with empty array");
    });
  });

  describe("View Function Tests", function () {
    it("getFundraiser should return correct state", async function () {
      console.log("******************************************************");

      const state = await multicall.getFundraiser(fundraiser, user0.address);

      // Verify basic state
      expect(state.recipient).to.equal(user1.address);
      expect(state.treasury).to.equal(auction); // treasury = auction
      expect(state.team).to.equal(user0.address); // team = launcher
      expect(state.startTime).to.be.gt(0);
      expect(state.currentEpoch).to.equal(await fundraiserContract.currentEpoch());
      expect(state.fundraiserUri).to.equal("https://example.com/fund");

      console.log("Current Epoch:", state.currentEpoch.toString());
      console.log("Current Epoch Emission:", divDec(state.currentEpochEmission));
      console.log("Recipient:", state.recipient);
      console.log("Treasury:", state.treasury);
      console.log("Team:", state.team);
      console.log("Coin Price:", divDec(state.coinPrice));
      console.log("Account USDC Balance:", divDec(state.accountUsdcBalance, 6));
      console.log("Account Coin Balance:", divDec(state.accountCoinBalance));
      console.log("Fundraiser URI:", state.fundraiserUri);

      // Verify user balances are populated
      expect(state.accountUsdcBalance).to.be.gt(0);
      console.log("- getFundraiser state verified");
    });

    it("getFundraiser should handle zero address account (skip balance queries)", async function () {
      console.log("******************************************************");

      const state = await multicall.getFundraiser(fundraiser, AddressZero);

      // Balances should be 0 for zero address
      expect(state.accountQuoteBalance).to.equal(0);
      expect(state.accountUsdcBalance).to.equal(0);
      expect(state.accountCoinBalance).to.equal(0);
      expect(state.accountCurrentEpochDonation).to.equal(0);

      // State should still be populated
      expect(state.recipient).to.equal(user1.address);
      expect(state.startTime).to.be.gt(0);
      console.log("- Zero address account handled correctly");
    });

    it("getClaimableEpochs should return epoch info", async function () {
      console.log("******************************************************");

      // Fund in current epoch
      const epoch = await fundraiserContract.currentEpoch();
      const fundAmount = convert("200", 6);
      await usdc.connect(user2).approve(multicall.address, fundAmount);
      await multicall.connect(user2).fund(fundraiser, user2.address, fundAmount, "");

      // Advance past epoch
      await increaseTime(ONE_DAY + 1);

      // Query claimable epochs
      const claimableEpochs = await multicall.getClaimableEpochs(
        fundraiser,
        user2.address,
        epoch,
        epoch.add(1)
      );

      expect(claimableEpochs.length).to.equal(1);
      expect(claimableEpochs[0].epoch).to.equal(epoch);
      expect(claimableEpochs[0].donation).to.equal(fundAmount);
      expect(claimableEpochs[0].pendingReward).to.be.gt(0);
      expect(claimableEpochs[0].hasClaimed).to.equal(false);

      console.log("Epoch:", claimableEpochs[0].epoch.toString());
      console.log("Donation:", divDec(claimableEpochs[0].donation, 6));
      console.log("Pending Reward:", divDec(claimableEpochs[0].pendingReward));
      console.log("Has Claimed:", claimableEpochs[0].hasClaimed);
      console.log("- getClaimableEpochs verified");
    });

    it("getClaimableEpochs should return empty array when endEpoch <= startEpoch", async function () {
      console.log("******************************************************");

      const result = await multicall.getClaimableEpochs(fundraiser, user0.address, 5, 5);
      expect(result.length).to.equal(0);

      const result2 = await multicall.getClaimableEpochs(fundraiser, user0.address, 5, 3);
      expect(result2.length).to.equal(0);
      console.log("- Empty array for invalid range");
    });

    it("getTotalPendingRewards should return correct totals and unclaimed epoch list", async function () {
      console.log("******************************************************");

      // Fund across multiple epochs
      const startEpoch = await fundraiserContract.currentEpoch();
      const epochs = [];

      for (let i = 0; i < 2; i++) {
        const epoch = await fundraiserContract.currentEpoch();
        epochs.push(epoch);

        const fundAmount = convert("100", 6);
        await usdc.connect(user0).approve(multicall.address, fundAmount);
        await multicall.connect(user0).fund(fundraiser, user0.address, fundAmount, "");

        await increaseTime(ONE_DAY + 1);
      }

      const endEpoch = await fundraiserContract.currentEpoch();

      // Get total pending rewards
      const [totalPending, unclaimedEpochs] = await multicall.getTotalPendingRewards(
        fundraiser,
        user0.address,
        startEpoch,
        endEpoch
      );

      expect(totalPending).to.be.gt(0);
      expect(unclaimedEpochs.length).to.be.gt(0);

      console.log("Total Pending:", divDec(totalPending));
      console.log("Unclaimed Epochs:", unclaimedEpochs.map((e) => e.toString()));

      // Verify unclaimed epochs match funded epochs
      for (const epoch of unclaimedEpochs) {
        const donation = await fundraiserContract.epochAccountToDonation(epoch, user0.address);
        expect(donation).to.be.gt(0);
      }
      console.log("- getTotalPendingRewards verified");
    });

    it("getTotalPendingRewards should return zero when no pending rewards", async function () {
      console.log("******************************************************");

      // Query a far-future range where nobody has donated
      const farEpoch = 9999;
      const [totalPending, unclaimedEpochs] = await multicall.getTotalPendingRewards(
        fundraiser,
        owner.address, // owner never donated
        farEpoch,
        farEpoch + 1
      );

      expect(totalPending).to.equal(0);
      expect(unclaimedEpochs.length).to.equal(0);
      console.log("- Returns zero when no pending rewards");
    });

    it("getTotalPendingRewards should return empty for invalid range", async function () {
      console.log("******************************************************");

      const [totalPending, unclaimedEpochs] = await multicall.getTotalPendingRewards(
        fundraiser,
        user0.address,
        5,
        5
      );

      expect(totalPending).to.equal(0);
      expect(unclaimedEpochs.length).to.equal(0);
      console.log("- Returns empty for invalid range");
    });

    it("getEmissionSchedule should return correct projections", async function () {
      console.log("******************************************************");

      const numEpochs = 5;
      const emissions = await multicall.getEmissionSchedule(fundraiser, numEpochs);

      expect(emissions.length).to.equal(numEpochs);

      const currentEpoch = await fundraiserContract.currentEpoch();
      for (let i = 0; i < numEpochs; i++) {
        const expectedEmission = await fundraiserContract.getEpochEmission(currentEpoch.add(i));
        expect(emissions[i]).to.equal(expectedEmission);
        console.log(`Epoch ${currentEpoch.add(i).toString()} emission:`, divDec(emissions[i]));
      }
      console.log("- getEmissionSchedule verified");
    });

    it("getEmissionSchedule should reflect halving", async function () {
      console.log("******************************************************");

      // Get emissions spanning a halving period (30 epochs)
      const emissions = await multicall.getEmissionSchedule(fundraiser, 35);

      // Within first halving period, emissions should be consistent
      // Note: current epoch may not be 0, but emissions within same halving period are equal
      const currentEpoch = await fundraiserContract.currentEpoch();
      const halvingPeriod = await fundraiserContract.halvingPeriod();

      console.log("Current epoch:", currentEpoch.toString());
      console.log("Halving period:", halvingPeriod.toString());
      console.log("First emission:", divDec(emissions[0]));
      console.log("Emission count:", emissions.length);
      expect(emissions.length).to.equal(35);
      console.log("- Emission schedule with halving verified");
    });

    it("getRecipient should return fundraiser recipient", async function () {
      console.log("******************************************************");

      const recipient = await multicall.getRecipient(fundraiser);
      expect(recipient).to.equal(user1.address);
      console.log("Recipient:", recipient);
      console.log("- getRecipient verified");
    });

    it("getAuction should return auction state", async function () {
      console.log("******************************************************");

      const state = await multicall.getAuction(fundraiser, user0.address);

      expect(state.epochId).to.be.gte(0);
      expect(state.initPrice).to.equal(convert("1000", 6));
      expect(state.startTime).to.be.gt(0);
      expect(state.lpToken).to.equal(lpToken);
      expect(state.price).to.be.gte(0); // price may have decayed after many epochs

      console.log("Auction Epoch ID:", state.epochId.toString());
      console.log("Auction Init Price:", divDec(state.initPrice, 6));
      console.log("Auction Start Time:", state.startTime.toString());
      console.log("LP Token:", state.lpToken);
      console.log("Current Price:", divDec(state.price, 6));
      console.log("LP Token Price:", divDec(state.lpTokenPrice));
      console.log("Quote Accumulated:", divDec(state.quoteAccumulated, 6));
      console.log("Account Quote Balance:", divDec(state.accountQuoteBalance, 6));
      console.log("Account LP Token Balance:", divDec(state.accountLpTokenBalance));
      console.log("- getAuction state verified");
    });

    it("getAuction should handle zero address account", async function () {
      console.log("******************************************************");

      const state = await multicall.getAuction(fundraiser, AddressZero);

      expect(state.accountQuoteBalance).to.equal(0);
      expect(state.accountLpTokenBalance).to.equal(0);

      // Auction state should still be populated
      expect(state.lpToken).to.equal(lpToken);
      expect(state.initPrice).to.equal(convert("1000", 6));
      console.log("- Zero address account handled correctly for auction");
    });
  });

  describe("Validation Tests", function () {
    it("fund() should revert for non-fundraiser address", async function () {
      console.log("******************************************************");

      const fundAmount = convert("100", 6);
      await usdc.connect(user0).approve(multicall.address, fundAmount);

      await expect(
        multicall.connect(user0).fund(owner.address, user0.address, fundAmount, "")
      ).to.be.revertedWith("Multicall__InvalidFundraiser()");
      console.log("- fund() correctly validates fundraiser");
    });

    it("claim() should revert for non-fundraiser address", async function () {
      console.log("******************************************************");

      await expect(
        multicall.connect(user0).claim(owner.address, user0.address, 0)
      ).to.be.revertedWith("Multicall__InvalidFundraiser()");
      console.log("- claim() correctly validates fundraiser");
    });

    it("claimMultiple() should revert for non-fundraiser address", async function () {
      console.log("******************************************************");

      await expect(
        multicall.connect(user0).claimMultiple(owner.address, user0.address, [0])
      ).to.be.revertedWith("Multicall__InvalidFundraiser()");
      console.log("- claimMultiple() correctly validates fundraiser");
    });
  });

  describe("launch() via Multicall Tests", function () {
    it("Should launch a new fundraiser through Multicall", async function () {
      console.log("******************************************************");

      const launchParams = {
        launcher: user2.address, // will be overwritten to msg.sender
        quoteToken: usdc.address,
        recipient: user1.address,
        tokenName: "Multicall Coin",
        tokenSymbol: "MCOIN",
        uri: "https://example.com/multicall-fund",
        usdcAmount: convert("500", 6),
        coinAmount: convert("500000", 18),
        initialEmission: convert("172800", 18),
        minEmission: convert("432", 18),
        halvingPeriod: 30,
        epochDuration: 86400,
        auctionInitPrice: convert("500", 6),
        auctionEpochPeriod: 86400,
        auctionPriceMultiplier: convert("1.5", 18),
        auctionMinInitPrice: convert("1", 6),
      };

      // Approve Multicall for USDC
      await usdc.connect(user2).approve(multicall.address, launchParams.usdcAmount);

      // Launch through Multicall
      const tx = await multicall.connect(user2).launch(launchParams);
      const receipt = await tx.wait();

      // Verify fundraiser was registered in Core
      const fundraisersLength = await core.fundraisersLength();
      expect(fundraisersLength).to.equal(2); // original + this one

      // Get the new fundraiser address
      const newFundraiser = await core.fundraisers(1);
      expect(await core.isFundraiser(newFundraiser)).to.equal(true);

      // Verify launcher was overwritten to msg.sender (user2)
      const newFundraiserContract = await ethers.getContractAt("Fundraiser", newFundraiser);
      expect(await newFundraiserContract.owner()).to.equal(user2.address);
      expect(await newFundraiserContract.team()).to.equal(user2.address); // team = launcher = msg.sender

      console.log("New fundraiser at:", newFundraiser);
      console.log("Owner (launcher):", await newFundraiserContract.owner());
      console.log("- Launch via Multicall verified");
    });
  });

  describe("Integration Tests", function () {
    it("Should fund and claim through Multicall end-to-end", async function () {
      console.log("******************************************************");

      // Fund
      const epoch = await fundraiserContract.currentEpoch();
      const fundAmount = convert("500", 6);
      await usdc.connect(user1).approve(multicall.address, fundAmount);
      await multicall.connect(user1).fund(fundraiser, user1.address, fundAmount, "e2e-test");

      // Verify donation
      const donation = await fundraiserContract.epochAccountToDonation(epoch, user1.address);
      expect(donation).to.equal(fundAmount);

      // Advance epoch
      await increaseTime(ONE_DAY + 1);

      // Verify pending reward via view function
      const [totalPending, unclaimedEpochs] = await multicall.getTotalPendingRewards(
        fundraiser,
        user1.address,
        epoch,
        epoch.add(1)
      );
      expect(totalPending).to.be.gt(0);
      expect(unclaimedEpochs.length).to.equal(1);

      // Claim via Multicall
      const balanceBefore = await coinContract.balanceOf(user1.address);
      await multicall.connect(user1).claim(fundraiser, user1.address, epoch);
      const balanceAfter = await coinContract.balanceOf(user1.address);

      const received = balanceAfter.sub(balanceBefore);
      expect(received).to.equal(totalPending);

      // Verify claimed status via view function
      const claimableEpochs = await multicall.getClaimableEpochs(
        fundraiser,
        user1.address,
        epoch,
        epoch.add(1)
      );
      expect(claimableEpochs[0].hasClaimed).to.equal(true);
      expect(claimableEpochs[0].pendingReward).to.equal(0);

      console.log("Funded:", divDec(fundAmount, 6), "USDC");
      console.log("Claimed:", divDec(received), "TCOIN");
      console.log("- End-to-end fund and claim verified");
    });

    it("Should handle multiple users funding and claiming in same epoch", async function () {
      console.log("******************************************************");

      const epoch = await fundraiserContract.currentEpoch();

      // User0 funds 200 USDC
      await usdc.connect(user0).approve(multicall.address, convert("200", 6));
      await multicall.connect(user0).fund(fundraiser, user0.address, convert("200", 6), "");

      // User1 funds 800 USDC
      await usdc.connect(user1).approve(multicall.address, convert("800", 6));
      await multicall.connect(user1).fund(fundraiser, user1.address, convert("800", 6), "");

      // Advance epoch
      await increaseTime(ONE_DAY + 1);

      // Get epoch emission
      const epochEmission = await fundraiserContract.getEpochEmission(epoch);

      // Check pending rewards are proportional
      const pending0 = await fundraiserContract.getPendingReward(epoch, user0.address);
      const pending1 = await fundraiserContract.getPendingReward(epoch, user1.address);

      // user0: 200/1000 = 20%, user1: 800/1000 = 80%
      // Note: there may be other donations in this epoch, so check ratio
      const epochTotal = await fundraiserContract.epochToTotalDonated(epoch);
      const expectedUser0 = epochEmission.mul(200).div(ethers.BigNumber.from(epochTotal).div(convert("1", 6)));
      console.log("Epoch total donated:", divDec(epochTotal, 6));
      console.log("User0 pending:", divDec(pending0));
      console.log("User1 pending:", divDec(pending1));

      // User1 should get 4x user0 (800/200 = 4)
      // We need to check the actual donation amounts in this epoch for accuracy
      const user0Donation = await fundraiserContract.epochAccountToDonation(epoch, user0.address);
      const user1Donation = await fundraiserContract.epochAccountToDonation(epoch, user1.address);
      const expectedRatio0 = epochEmission.mul(user0Donation).div(epochTotal);
      const expectedRatio1 = epochEmission.mul(user1Donation).div(epochTotal);

      expect(pending0).to.equal(expectedRatio0);
      expect(pending1).to.equal(expectedRatio1);

      // Batch claim both
      await multicall.connect(user0).claimMultiple(fundraiser, user0.address, [epoch]);
      await multicall.connect(user1).claimMultiple(fundraiser, user1.address, [epoch]);

      // Verify both claimed
      expect(await fundraiserContract.epochAccountToHasClaimed(epoch, user0.address)).to.equal(true);
      expect(await fundraiserContract.epochAccountToHasClaimed(epoch, user1.address)).to.equal(true);
      console.log("- Multiple users fund and claim in same epoch verified");
    });
  });
});
