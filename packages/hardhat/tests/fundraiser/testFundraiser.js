const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const AddressZero = "0x0000000000000000000000000000000000000000";

let owner, recipient, treasury, team, protocol, user0, user1, user2;
let paymentToken, coinToken, fundraiser, mockCore;

// Time helpers
async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

const ONE_DAY = 86400;
const THIRTY_DAYS = ONE_DAY * 30;
const INITIAL_EMISSION = ethers.utils.parseUnits("345600", 18);
const MIN_EMISSION = ethers.utils.parseUnits("864", 18);

describe("Fundraiser Tests", function () {
  before("Initial set up", async function () {
    await network.provider.send("hardhat_reset");
    console.log("Begin Initialization");

    [owner, recipient, treasury, team, protocol, user0, user1, user2] = await ethers.getSigners();

    // Deploy mock payment token (using MockUSDC.sol - 6 decimals)
    const mockUsdcArtifact = await ethers.getContractFactory("MockUSDC");
    paymentToken = await mockUsdcArtifact.deploy();
    console.log("- Payment Token (MockUSDC) Initialized");

    // Deploy mock Core (for protocolFeeAddress)
    const mockCoreArtifact = await ethers.getContractFactory("MockCore");
    mockCore = await mockCoreArtifact.deploy(protocol.address);
    console.log("- MockCore Initialized");

    // Deploy Coin token (owner is initial minter, will transfer to Fundraiser)
    const coinArtifact = await ethers.getContractFactory("Coin");
    coinToken = await coinArtifact.deploy("Test Coin", "TCOIN", owner.address);
    console.log("- Coin Token Initialized");

    // Deploy Fundraiser (recipient is now required in constructor)
    const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
    fundraiser = await fundraiserArtifact.deploy(
      coinToken.address,
      paymentToken.address,
      mockCore.address, // core
      treasury.address,
      team.address,
      recipient.address, // recipient (required)
      [INITIAL_EMISSION, MIN_EMISSION, 30, ONE_DAY], // Config: {initialEmission, minEmission, halvingPeriod}
      "" // uri
    );
    console.log("- Fundraiser Initialized (with recipient)");

    // Transfer minting rights to Fundraiser
    await coinToken.setMinter(fundraiser.address);
    console.log("- Minting rights transferred to Fundraiser");

    // Mint payment tokens to users
    await paymentToken.mint(user0.address, convert("5000", 6));
    await paymentToken.mint(user1.address, convert("5000", 6));
    await paymentToken.mint(user2.address, convert("5000", 6));
    console.log("- Payment tokens minted to users");

    console.log("Initialization Complete\n");
  });

  describe("Coin Token Tests", function () {
    it("Should have Fundraiser as minter", async function () {
      expect(await coinToken.minter()).to.equal(fundraiser.address);
    });

    it("Should prevent non-minter from minting", async function () {
      await expect(
        coinToken.connect(user0).mint(user0.address, convert("100"))
      ).to.be.reverted;
    });

    it("Should prevent non-minter from changing minter", async function () {
      await expect(
        coinToken.connect(user0).setMinter(user0.address)
      ).to.be.reverted;
    });

    it("Should have minterLocked set to true after setMinter", async function () {
      expect(await coinToken.minterLocked()).to.equal(true);
    });

    it("Should prevent setMinter when minterLocked is true", async function () {
      // Even if somehow fundraiser contract could call setMinter, it should be locked
      // We test by deploying a fresh Coin and calling setMinter twice
      const coinArtifact = await ethers.getContractFactory("Coin");
      const freshCoin = await coinArtifact.deploy("Fresh Coin", "FRESH", owner.address);

      // First setMinter should succeed
      await freshCoin.connect(owner).setMinter(user0.address);
      expect(await freshCoin.minter()).to.equal(user0.address);
      expect(await freshCoin.minterLocked()).to.equal(true);

      // Second setMinter should fail even from the new minter
      await expect(
        freshCoin.connect(user0).setMinter(user1.address)
      ).to.be.revertedWith("Coin__MinterLocked()");
    });

    it("Should allow minting before minterLocked", async function () {
      const coinArtifact = await ethers.getContractFactory("Coin");
      const freshCoin = await coinArtifact.deploy("Fresh Coin", "FRESH", owner.address);

      // minterLocked should be false initially
      expect(await freshCoin.minterLocked()).to.equal(false);

      // Initial minter (owner) can mint
      await freshCoin.connect(owner).mint(user0.address, convert("100"));
      expect(await freshCoin.balanceOf(user0.address)).to.equal(convert("100"));
    });

    it("Should allow minting after minterLocked", async function () {
      const coinArtifact = await ethers.getContractFactory("Coin");
      const freshCoin = await coinArtifact.deploy("Fresh Coin", "FRESH", owner.address);

      // Transfer minter to user0 and lock
      await freshCoin.connect(owner).setMinter(user0.address);
      expect(await freshCoin.minterLocked()).to.equal(true);

      // New minter (user0) can still mint
      await freshCoin.connect(user0).mint(user1.address, convert("200"));
      expect(await freshCoin.balanceOf(user1.address)).to.equal(convert("200"));
    });
  });

  describe("Fundraiser Configuration Tests", function () {
    it("Should have correct initial state", async function () {
      expect(await fundraiser.quote()).to.equal(paymentToken.address);
      expect(await fundraiser.coin()).to.equal(coinToken.address);
      expect(await fundraiser.treasury()).to.equal(treasury.address);
      expect(await fundraiser.team()).to.equal(team.address);
      expect(await fundraiser.core()).to.equal(mockCore.address);
    });

    it("Should have correct constants", async function () {
      expect(await fundraiser.initialEmission()).to.equal(INITIAL_EMISSION);
      expect(await fundraiser.minEmission()).to.equal(MIN_EMISSION);
      expect(await fundraiser.halvingPeriod()).to.equal(30); // 30 days
      expect(await fundraiser.RECIPIENT_BPS()).to.equal(5000); // 50%
      expect(await fundraiser.TEAM_BPS()).to.equal(400); // 4%
      expect(await fundraiser.PROTOCOL_BPS()).to.equal(100); // 1%
      // Treasury receives remainder (45%)
      expect(await fundraiser.DIVISOR()).to.equal(10000);
    });

    it("Should have recipient set", async function () {
      expect(await fundraiser.recipient()).to.equal(recipient.address);
    });

    it("Should allow owner to change recipient", async function () {
      const newRecipient = user2.address;
      await fundraiser.connect(owner).setRecipient(newRecipient);
      expect(await fundraiser.recipient()).to.equal(newRecipient);
      // Reset for other tests
      await fundraiser.connect(owner).setRecipient(recipient.address);
      expect(await fundraiser.recipient()).to.equal(recipient.address);
    });

    it("Should allow owner to update treasury address", async function () {
      const newTreasury = user2.address;
      await fundraiser.connect(owner).setTreasury(newTreasury);
      expect(await fundraiser.treasury()).to.equal(newTreasury);
      // Reset for other tests
      await fundraiser.connect(owner).setTreasury(treasury.address);
    });

    it("Should allow owner to update team address", async function () {
      const newTeam = user2.address;
      await fundraiser.connect(owner).setTeam(newTeam);
      expect(await fundraiser.team()).to.equal(newTeam);
      // Reset for other tests
      await fundraiser.connect(owner).setTeam(team.address);
    });

    it("Should prevent non-owner from updating addresses", async function () {
      await expect(
        fundraiser.connect(user0).setTreasury(user0.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent non-owner from setting recipient", async function () {
      await expect(
        fundraiser.connect(user0).setRecipient(user0.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should prevent setting zero address for treasury", async function () {
      await expect(
        fundraiser.connect(owner).setTreasury(AddressZero)
      ).to.be.revertedWith("Fundraiser__ZeroAddress()");
    });

    it("Should allow setting team address to zero", async function () {
      await fundraiser.connect(owner).setTeam(AddressZero);
      expect(await fundraiser.team()).to.equal(AddressZero);
      // Reset for other tests
      await fundraiser.connect(owner).setTeam(team.address);
    });

    it("Should allow setting recipient to zero address (redirects to treasury)", async function () {
      await fundraiser.connect(owner).setRecipient(AddressZero);
      expect(await fundraiser.recipient()).to.equal(AddressZero);
      // Reset for other tests
      await fundraiser.connect(owner).setRecipient(recipient.address);
    });
  });

  describe("Donation Tests", function () {
    it("Should revert donation without approval", async function () {
      console.log("\n*** Allowance Check ***");
      // Clear any leftover approval from previous tests
      await paymentToken.connect(user0).approve(fundraiser.address, 0);
      await expect(
        fundraiser.connect(user0).fund(user0.address, convert("100", 6), "")
      ).to.be.reverted;
      console.log("- Donation without approval correctly reverted");
    });

    it("Should allow deployment with zero recipient address", async function () {
      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      const zeroRecipientFundraiser = await fundraiserArtifact.deploy(
        coinToken.address,
        paymentToken.address,
        mockCore.address,
        treasury.address,
        team.address,
        AddressZero, // zero recipient — donations go to treasury
        [INITIAL_EMISSION, MIN_EMISSION, 30, ONE_DAY], // Config
        "" // uri
      );
      expect(await zeroRecipientFundraiser.recipient()).to.equal(AddressZero);
    });

    it("Should revert deployment with halving period too low", async function () {
      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      await expect(
        fundraiserArtifact.deploy(
          coinToken.address,
          paymentToken.address,
          mockCore.address,
          treasury.address,
          team.address,
          recipient.address,
          [INITIAL_EMISSION, MIN_EMISSION, 6, ONE_DAY], // Config: halvingPeriod too low (min is 7)
          "" // uri
        )
      ).to.be.revertedWith("Fundraiser__HalvingPeriodOutOfRange()");
    });

    it("Should revert deployment with halving period too high", async function () {
      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      await expect(
        fundraiserArtifact.deploy(
          coinToken.address,
          paymentToken.address,
          mockCore.address,
          treasury.address,
          team.address,
          recipient.address,
          [INITIAL_EMISSION, MIN_EMISSION, 366, ONE_DAY], // Config: halvingPeriod too high (max is 365)
          "" // uri
        )
      ).to.be.revertedWith("Fundraiser__HalvingPeriodOutOfRange()");
    });

    it("Should correctly split donations (50/45/4/1)", async function () {
      console.log("\n*** Split Check ***");

      // Record initial balances
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      const treasuryBefore = await paymentToken.balanceOf(treasury.address);
      const teamBefore = await paymentToken.balanceOf(team.address);
      const protocolBefore = await paymentToken.balanceOf(protocol.address);

      // Approve and donate 1000 tokens
      const donationAmount = convert("1000", 6);
      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user0).fund(user0.address, donationAmount, "");

      // Check balances after
      const recipientAfter = await paymentToken.balanceOf(recipient.address);
      const treasuryAfter = await paymentToken.balanceOf(treasury.address);
      const teamAfter = await paymentToken.balanceOf(team.address);
      const protocolAfter = await paymentToken.balanceOf(protocol.address);

      const recipientReceived = recipientAfter.sub(recipientBefore);
      const treasuryReceived = treasuryAfter.sub(treasuryBefore);
      const teamReceived = teamAfter.sub(teamBefore);
      const protocolReceived = protocolAfter.sub(protocolBefore);

      console.log("Donation Amount:", divDec(donationAmount, 6));
      console.log("Recipient Received:", divDec(recipientReceived, 6), "(expected: 500)");
      console.log("Treasury Received:", divDec(treasuryReceived, 6), "(expected: 450)");
      console.log("Team Received:", divDec(teamReceived, 6), "(expected: 40)");
      console.log("Protocol Received:", divDec(protocolReceived, 6), "(expected: 10)");

      // Verify splits: 50% recipient, 45% treasury (remainder), 4% team, 1% protocol
      expect(recipientReceived).to.equal(convert("500", 6)); // 50%
      expect(treasuryReceived).to.equal(convert("450", 6)); // 45%
      expect(teamReceived).to.equal(convert("40", 6)); // 4%
      expect(protocolReceived).to.equal(convert("10", 6)); // 1%

      console.log("- Split verification passed!");
    });

    it("Should emit Fundraiser__Funded event", async function () {
      const donationAmount = convert("100", 6);
      await paymentToken.connect(user1).approve(fundraiser.address, donationAmount);

      const currentDay = await fundraiser.currentEpoch();

      await expect(fundraiser.connect(user1).fund(user1.address, donationAmount, ""))
        .to.emit(fundraiser, "Fundraiser__Funded")
        .withArgs(user1.address, user1.address, donationAmount, currentDay, "");
    });

    it("Should track daily donations correctly", async function () {
      const day = await fundraiser.currentEpoch();
      const user0Donation = await fundraiser.epochAccountToDonation(day, user0.address);
      const dayTotal = await fundraiser.epochToTotalDonated(day);

      expect(user0Donation).to.equal(convert("1000", 6)); // 1000 from split check
      expect(dayTotal).to.be.gt(0);
    });

    it("Should prevent zero amount donation", async function () {
      await expect(
        fundraiser.connect(user0).fund(user0.address, 0, "")
      ).to.be.revertedWith("Fundraiser__BelowMinDonation()");
    });

    it("Should prevent donation to zero address account", async function () {
      await paymentToken.connect(user0).approve(fundraiser.address, convert("100", 6));
      await expect(
        fundraiser.connect(user0).fund(AddressZero, convert("100", 6), "")
      ).to.be.revertedWith("Fundraiser__ZeroAddress()");
    });

    it("Should redirect team fees to treasury when team address is zero", async function () {
      // Set team address to zero
      await fundraiser.connect(owner).setTeam(AddressZero);

      // Record initial balances
      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      const treasuryBefore = await paymentToken.balanceOf(treasury.address);
      const protocolBefore = await paymentToken.balanceOf(protocol.address);

      // Donate 1000 tokens
      const donationAmount = convert("1000", 6);
      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user0).fund(user0.address, donationAmount, "");

      // Check balances after
      const recipientAfter = await paymentToken.balanceOf(recipient.address);
      const treasuryAfter = await paymentToken.balanceOf(treasury.address);
      const protocolAfter = await paymentToken.balanceOf(protocol.address);

      const recipientReceived = recipientAfter.sub(recipientBefore);
      const treasuryReceived = treasuryAfter.sub(treasuryBefore);
      const protocolReceived = protocolAfter.sub(protocolBefore);

      // Recipient gets 50%, protocol gets 1%, treasury gets 44% + 4% (team fee) = 48%
      // Total: 1000 - 500 (recipient) - 10 (protocol) = 490 treasury
      expect(recipientReceived).to.equal(convert("500", 6)); // 50%
      expect(protocolReceived).to.equal(convert("10", 6)); // 1%
      expect(treasuryReceived).to.equal(convert("490", 6)); // 44% + 5% (remainder)

      // Reset team address for other tests
      await fundraiser.connect(owner).setTeam(team.address);
    });

    it("Should redirect recipient fees to treasury when recipient is zero address", async function () {
      // Set recipient to zero address
      await fundraiser.connect(owner).setRecipient(AddressZero);

      // Record initial balances
      const treasuryBefore = await paymentToken.balanceOf(treasury.address);
      const teamBefore = await paymentToken.balanceOf(team.address);
      const protocolBefore = await paymentToken.balanceOf(protocol.address);

      // Donate 1000 tokens
      const donationAmount = convert("1000", 6);
      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user0).fund(user0.address, donationAmount, "");

      // Check balances after
      const treasuryAfter = await paymentToken.balanceOf(treasury.address);
      const teamAfter = await paymentToken.balanceOf(team.address);
      const protocolAfter = await paymentToken.balanceOf(protocol.address);

      const treasuryReceived = treasuryAfter.sub(treasuryBefore);
      const teamReceived = teamAfter.sub(teamBefore);
      const protocolReceived = protocolAfter.sub(protocolBefore);

      // Treasury gets 50% (recipient share) + 45% = 95%, team 4%, protocol 1%
      expect(protocolReceived).to.equal(convert("10", 6)); // 1%
      expect(teamReceived).to.equal(convert("40", 6)); // 4%
      expect(treasuryReceived).to.equal(convert("950", 6)); // 95%

      // Reset recipient for other tests
      await fundraiser.connect(owner).setRecipient(recipient.address);
    });

    it("Should allow anyone to donate on behalf of another account", async function () {
      // user2 donates on behalf of user0
      const user0DonationBefore = await fundraiser.epochAccountToDonation(await fundraiser.currentEpoch(), user0.address);

      await paymentToken.connect(user2).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user2).fund(user0.address, convert("100", 6), "");

      const user0DonationAfter = await fundraiser.epochAccountToDonation(await fundraiser.currentEpoch(), user0.address);
      expect(user0DonationAfter.sub(user0DonationBefore)).to.equal(convert("100", 6));
    });
  });

  describe("Claiming Tests", function () {
    it("Should prevent claiming before day ends", async function () {
      const currentDay = await fundraiser.currentEpoch();
      await expect(
        fundraiser.connect(user0).claim(user0.address, currentDay)
      ).to.be.revertedWith("Fundraiser__EpochNotEnded()");
    });

    it("Should distribute Coin proportionally (25%/75%)", async function () {
      console.log("\n*** Proportional Claiming ***");

      // Start fresh on a new day
      await increaseTime(ONE_DAY + 1);

      const newDay = await fundraiser.currentEpoch();
      console.log("New day:", newDay.toString());

      // User A donates 100 tokens
      await paymentToken.connect(user0).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user0).fund(user0.address, convert("100", 6), "");

      // User B donates 300 tokens
      await paymentToken.connect(user1).approve(fundraiser.address, convert("300", 6));
      await fundraiser.connect(user1).fund(user1.address, convert("300", 6), "");

      // Advance to next day
      await increaseTime(ONE_DAY + 1);

      // Get emission for that day
      const dayEmission = await fundraiser.getEpochEmission(newDay);
      console.log("Day Emission:", divDec(dayEmission));

      // Calculate expected rewards
      // User A: 100/400 = 25% of emission
      // User B: 300/400 = 75% of emission
      const expectedUserA = dayEmission.mul(100).div(400);
      const expectedUserB = dayEmission.mul(300).div(400);

      console.log("Expected User A (25%):", divDec(expectedUserA));
      console.log("Expected User B (75%):", divDec(expectedUserB));

      // Check pending rewards
      const pendingA = await fundraiser.getPendingReward(newDay, user0.address);
      const pendingB = await fundraiser.getPendingReward(newDay, user1.address);

      expect(pendingA).to.equal(expectedUserA);
      expect(pendingB).to.equal(expectedUserB);

      // Claim rewards
      const balanceABefore = await coinToken.balanceOf(user0.address);
      const balanceBBefore = await coinToken.balanceOf(user1.address);

      await fundraiser.connect(user0).claim(user0.address, newDay);
      await fundraiser.connect(user1).claim(user1.address, newDay);

      const balanceAAfter = await coinToken.balanceOf(user0.address);
      const balanceBAfter = await coinToken.balanceOf(user1.address);

      const receivedA = balanceAAfter.sub(balanceABefore);
      const receivedB = balanceBAfter.sub(balanceBBefore);

      console.log("User A received:", divDec(receivedA));
      console.log("User B received:", divDec(receivedB));

      expect(receivedA).to.equal(expectedUserA);
      expect(receivedB).to.equal(expectedUserB);

      // Verify User B got 75% (3x User A)
      expect(receivedB).to.equal(receivedA.mul(3));
      console.log("- User B correctly received 3x User A's reward (75% vs 25%)");
    });

    it("Should prevent double claiming", async function () {
      const previousDay = (await fundraiser.currentEpoch()).sub(1);
      await expect(
        fundraiser.connect(user0).claim(user0.address, previousDay)
      ).to.be.revertedWith("Fundraiser__AlreadyClaimed()");
    });

    it("Should prevent claiming with no donation", async function () {
      const previousDay = (await fundraiser.currentEpoch()).sub(1);
      await expect(
        fundraiser.connect(user2).claim(user2.address, previousDay)
      ).to.be.revertedWith("Fundraiser__NoDonation()");
    });

    it("Should emit Fundraiser__Claimed event", async function () {
      // Setup a new day with donation
      await increaseTime(ONE_DAY + 1);
      const newDay = await fundraiser.currentEpoch();

      await paymentToken.connect(user2).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user2).fund(user2.address, convert("100", 6), "");

      // Advance to claim
      await increaseTime(ONE_DAY + 1);

      const expectedReward = await fundraiser.getPendingReward(newDay, user2.address);

      await expect(fundraiser.connect(user2).claim(user2.address, newDay))
        .to.emit(fundraiser, "Fundraiser__Claimed")
        .withArgs(user2.address, expectedReward, newDay);
    });

    it("Should return 0 for pending reward if day not ended", async function () {
      const currentDay = await fundraiser.currentEpoch();
      const pending = await fundraiser.getPendingReward(currentDay, user0.address);
      expect(pending).to.equal(0);
    });

    it("Should return 0 for pending reward if already claimed", async function () {
      // user0 already claimed for the day we tested proportional claiming
      const claimedDay = (await fundraiser.currentEpoch()).sub(2); // 2 days ago
      const pending = await fundraiser.getPendingReward(claimedDay, user0.address);
      expect(pending).to.equal(0);
    });

    it("Should allow anyone to claim on behalf of another account", async function () {
      // Setup a new day with donation from user0
      await increaseTime(ONE_DAY + 1);
      const newDay = await fundraiser.currentEpoch();

      await paymentToken.connect(user0).approve(fundraiser.address, convert("200", 6));
      await fundraiser.connect(user0).fund(user0.address, convert("200", 6), "");

      // Advance to claim
      await increaseTime(ONE_DAY + 1);

      const balanceBefore = await coinToken.balanceOf(user0.address);

      // user1 claims on behalf of user0
      await fundraiser.connect(user1).claim(user0.address, newDay);

      const balanceAfter = await coinToken.balanceOf(user0.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Emission Halving Tests", function () {
    it("Should return correct emission for day 0", async function () {
      const emission = await fundraiser.getEpochEmission(0);
      expect(emission).to.equal(INITIAL_EMISSION);
    });

    it("Should return same emission within first 30 days", async function () {
      const emission0 = await fundraiser.getEpochEmission(0);
      const emission15 = await fundraiser.getEpochEmission(15);
      const emission29 = await fundraiser.getEpochEmission(29);

      expect(emission0).to.equal(emission15);
      expect(emission0).to.equal(emission29);
    });

    it("Should halve emission after 30 days", async function () {
      const emission0 = await fundraiser.getEpochEmission(0);
      const emission30 = await fundraiser.getEpochEmission(30);

      expect(emission30).to.equal(emission0.div(2));
    });

    it("Should halve emission multiple times", async function () {
      const emission0 = await fundraiser.getEpochEmission(0);
      const emission60 = await fundraiser.getEpochEmission(60);
      const emission90 = await fundraiser.getEpochEmission(90);

      expect(emission60).to.equal(emission0.div(4)); // 2 halvings
      expect(emission90).to.equal(emission0.div(8)); // 3 halvings
    });

    it("Should respect minimum emission floor", async function () {
      // After many halvings, should hit floor
      const emission720 = await fundraiser.getEpochEmission(720); // 24 halvings
      const emission1000 = await fundraiser.getEpochEmission(1000);

      expect(emission720).to.be.gte(MIN_EMISSION);
      expect(emission1000).to.equal(MIN_EMISSION);
    });
  });

  describe("View Function Tests", function () {
    it("currentDay should track correctly", async function () {
      const day = await fundraiser.currentEpoch();

      await increaseTime(ONE_DAY);
      const nextDay = await fundraiser.currentEpoch();

      expect(nextDay).to.equal(day.add(1));
    });

    it("getDayTotal should return total donations for a day", async function () {
      const day = await fundraiser.currentEpoch();

      await paymentToken.connect(user0).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user0).fund(user0.address, convert("100", 6), "");

      const total = await fundraiser.epochToTotalDonated(day);
      expect(total).to.be.gt(0);
    });

    it("getUserDonation should return user donation for a day", async function () {
      const day = await fundraiser.currentEpoch();
      const donation = await fundraiser.epochAccountToDonation(day, user0.address);
      expect(donation).to.equal(convert("100", 6));
    });
  });

  describe("Custom Epoch Duration Tests", function () {
    let shortFundraiser, shortCoin;
    const ONE_HOUR = 3600;

    before(async function () {
      // Deploy a Fundraiser with 1 hour epoch duration
      const coinArtifact = await ethers.getContractFactory("Coin");
      shortCoin = await coinArtifact.deploy("Short Epoch Coin", "SCOIN", owner.address);

      const mockCoreArtifact = await ethers.getContractFactory("MockCore");
      const shortMockCore = await mockCoreArtifact.deploy(protocol.address);

      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      shortFundraiser = await fundraiserArtifact.deploy(
        shortCoin.address,
        paymentToken.address,
        shortMockCore.address,
        treasury.address,
        team.address,
        recipient.address,
        [INITIAL_EMISSION, MIN_EMISSION, 30, ONE_HOUR], // Config: 1 hour epochs
        ""
      );

      await shortCoin.setMinter(shortFundraiser.address);

      // Fund users
      await paymentToken.mint(user0.address, convert("5000", 6));
    });

    it("Should have correct epoch duration", async function () {
      expect(await shortFundraiser.epochDuration()).to.equal(ONE_HOUR);
    });

    it("currentDay should advance after one epoch (1 hour)", async function () {
      const day0 = await shortFundraiser.currentEpoch();
      expect(day0).to.equal(0);

      await increaseTime(ONE_HOUR);
      const day1 = await shortFundraiser.currentEpoch();
      expect(day1).to.equal(1);
    });

    it("Should allow claiming after epoch ends", async function () {
      // Donate in current epoch
      const epoch = await shortFundraiser.currentEpoch();
      await paymentToken.connect(user0).approve(shortFundraiser.address, convert("100", 6));
      await shortFundraiser.connect(user0).fund(user0.address, convert("100", 6), "");

      // Advance one epoch
      await increaseTime(ONE_HOUR);

      // Should be claimable now
      const balBefore = await shortCoin.balanceOf(user0.address);
      await shortFundraiser.claim(user0.address, epoch);
      const balAfter = await shortCoin.balanceOf(user0.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("Halving should work with epoch-based periods", async function () {
      // halvingPeriod=30, so after 30 epochs emission should halve
      const emission0 = await shortFundraiser.getEpochEmission(0);
      const emission30 = await shortFundraiser.getEpochEmission(30);
      expect(emission30).to.equal(emission0.div(2));
    });

    it("Should revert deployment with epoch duration too short", async function () {
      const coinArtifact = await ethers.getContractFactory("Coin");
      const tmpCoin = await coinArtifact.deploy("Tmp", "TMP", owner.address);

      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      await expect(
        fundraiserArtifact.deploy(
          tmpCoin.address,
          paymentToken.address,
          mockCore.address,
          treasury.address,
          team.address,
          recipient.address,
          [INITIAL_EMISSION, MIN_EMISSION, 30, 3599], // Config: less than 1 hour
          ""
        )
      ).to.be.revertedWith("Fundraiser__EpochDurationOutOfRange()");
    });

    it("Should revert deployment with epoch duration too long", async function () {
      const coinArtifact = await ethers.getContractFactory("Coin");
      const tmpCoin = await coinArtifact.deploy("Tmp2", "TMP2", owner.address);

      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      await expect(
        fundraiserArtifact.deploy(
          tmpCoin.address,
          paymentToken.address,
          mockCore.address,
          treasury.address,
          team.address,
          recipient.address,
          [INITIAL_EMISSION, MIN_EMISSION, 30, 7 * 86400 + 1], // Config: more than 7 days
          ""
        )
      ).to.be.revertedWith("Fundraiser__EpochDurationOutOfRange()");
    });
  });

  describe("RecipientSet Event Tests", function () {
    it("Should emit RecipientSet event when changing recipient", async function () {
      await expect(fundraiser.connect(owner).setRecipient(user2.address))
        .to.emit(fundraiser, "Fundraiser__RecipientSet")
        .withArgs(user2.address);

      // Cleanup
      await fundraiser.connect(owner).setRecipient(recipient.address);
    });
  });

  describe("Funded Event Tests", function () {
    it("Should include correct args in Funded event", async function () {
      const amount = convert("100", 6);
      await paymentToken.connect(user0).approve(fundraiser.address, amount);

      const epoch = await fundraiser.currentEpoch();

      await expect(fundraiser.connect(user0).fund(user0.address, amount, "test-uri"))
        .to.emit(fundraiser, "Fundraiser__Funded")
        .withArgs(user0.address, user0.address, amount, epoch, "test-uri");
    });
  });

  describe("MIN_DONATION Boundary Tests", function () {
    it("Should revert donation below MIN_DONATION (10000)", async function () {
      await paymentToken.connect(user0).approve(fundraiser.address, 9999);
      await expect(
        fundraiser.connect(user0).fund(user0.address, 9999, "")
      ).to.be.revertedWith("Fundraiser__BelowMinDonation()");
    });

    it("Should accept donation at exactly MIN_DONATION (10000)", async function () {
      await paymentToken.connect(user0).approve(fundraiser.address, 10000);
      await expect(
        fundraiser.connect(user0).fund(user0.address, 10000, "")
      ).to.not.be.reverted;
    });
  });

  describe("Epoch Boundary Precision Tests", function () {
    let precisionFundraiser, precisionCoin;
    const TWO_HOURS = 7200;

    before(async function () {
      const coinArtifact = await ethers.getContractFactory("Coin");
      precisionCoin = await coinArtifact.deploy("Precision Coin", "PCOIN", owner.address);

      const mockCoreArtifact = await ethers.getContractFactory("MockCore");
      const precMockCore = await mockCoreArtifact.deploy(protocol.address);

      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      precisionFundraiser = await fundraiserArtifact.deploy(
        precisionCoin.address,
        paymentToken.address,
        precMockCore.address,
        treasury.address,
        team.address,
        recipient.address,
        [INITIAL_EMISSION, MIN_EMISSION, 30, TWO_HOURS], // 2-hour epochs
        ""
      );

      await precisionCoin.setMinter(precisionFundraiser.address);
      await paymentToken.mint(user0.address, convert("5000", 6));
    });

    it("Should start at epoch 0", async function () {
      expect(await precisionFundraiser.currentEpoch()).to.equal(0);
    });

    it("Should stay in epoch 0 before epochDuration elapses", async function () {
      // Advance 1 hour 59 minutes (just under 2 hours)
      await increaseTime(TWO_HOURS - 60);
      expect(await precisionFundraiser.currentEpoch()).to.equal(0);
    });

    it("Should advance to epoch 1 at exactly epochDuration", async function () {
      // Advance remaining 60 seconds to hit 2 hours
      await increaseTime(60);
      expect(await precisionFundraiser.currentEpoch()).to.equal(1);
    });

    it("Should allow claiming epoch 0 after it ends", async function () {
      // Go back to fresh state — donate in epoch 0 was not done, so deploy fresh
      const coinArtifact = await ethers.getContractFactory("Coin");
      const tmpCoin = await coinArtifact.deploy("Epoch Claim Coin", "ECCOIN", owner.address);

      const mockCoreArtifact = await ethers.getContractFactory("MockCore");
      const tmpCore = await mockCoreArtifact.deploy(protocol.address);

      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      const tmpFundraiser = await fundraiserArtifact.deploy(
        tmpCoin.address,
        paymentToken.address,
        tmpCore.address,
        treasury.address,
        team.address,
        recipient.address,
        [INITIAL_EMISSION, MIN_EMISSION, 30, TWO_HOURS],
        ""
      );
      await tmpCoin.setMinter(tmpFundraiser.address);

      // Donate in epoch 0
      await paymentToken.connect(user0).approve(tmpFundraiser.address, convert("100", 6));
      await tmpFundraiser.connect(user0).fund(user0.address, convert("100", 6), "");

      // Still in epoch 0 — cannot claim
      await expect(
        tmpFundraiser.claim(user0.address, 0)
      ).to.be.revertedWith("Fundraiser__EpochNotEnded()");

      // Advance past epoch boundary
      await increaseTime(TWO_HOURS);

      // Now can claim epoch 0
      const balBefore = await tmpCoin.balanceOf(user0.address);
      await tmpFundraiser.claim(user0.address, 0);
      const balAfter = await tmpCoin.balanceOf(user0.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("Should track multiple rapid epochs correctly", async function () {
      const coinArtifact = await ethers.getContractFactory("Coin");
      const tmpCoin = await coinArtifact.deploy("Rapid Coin", "RCOIN", owner.address);

      const mockCoreArtifact = await ethers.getContractFactory("MockCore");
      const tmpCore = await mockCoreArtifact.deploy(protocol.address);

      const ONE_HOUR = 3600;
      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      const tmpFundraiser = await fundraiserArtifact.deploy(
        tmpCoin.address,
        paymentToken.address,
        tmpCore.address,
        treasury.address,
        team.address,
        recipient.address,
        [INITIAL_EMISSION, MIN_EMISSION, 30, ONE_HOUR], // 1-hour epochs
        ""
      );
      await tmpCoin.setMinter(tmpFundraiser.address);

      // Donate across 3 epochs
      for (let i = 0; i < 3; i++) {
        const epoch = await tmpFundraiser.currentEpoch();
        await paymentToken.connect(user0).approve(tmpFundraiser.address, convert("50", 6));
        await tmpFundraiser.connect(user0).fund(user0.address, convert("50", 6), "");

        const donation = await tmpFundraiser.epochAccountToDonation(epoch, user0.address);
        expect(donation).to.equal(convert("50", 6));

        await increaseTime(ONE_HOUR);
      }

      // Should be at epoch 3 now
      expect(await tmpFundraiser.currentEpoch()).to.equal(3);

      // Claim all 3 epochs
      for (let i = 0; i < 3; i++) {
        const balBefore = await tmpCoin.balanceOf(user0.address);
        await tmpFundraiser.claim(user0.address, i);
        const balAfter = await tmpCoin.balanceOf(user0.address);
        expect(balAfter).to.be.gt(balBefore);
      }
    });
  });
});
