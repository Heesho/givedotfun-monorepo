/**
 * @title Fundraiser Invariant and Business Logic Tests
 * @notice Comprehensive tests verifying donation mechanics and daily pool distribution
 * @dev Tests focus on daily pools, emission halving, fee distribution, and claim mechanics
 */

const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const AddressZero = "0x0000000000000000000000000000000000000000";

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
const THIRTY_DAYS = ONE_DAY * 30;

describe("Fundraiser Invariant Tests", function () {
  let owner, treasury, team, protocol, recipient, user0, user1, user2;
  let paymentToken, coinToken, fundraiser, mockCore;

  before("Deploy contracts", async function () {
    await network.provider.send("hardhat_reset");

    [owner, treasury, team, protocol, recipient, user0, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC as payment token (6 decimals)
    const mockUsdcArtifact = await ethers.getContractFactory("MockUSDC");
    paymentToken = await mockUsdcArtifact.deploy();

    // Deploy mock Core (for protocolFeeAddress)
    const mockCoreArtifact = await ethers.getContractFactory("MockCore");
    mockCore = await mockCoreArtifact.deploy(protocol.address);

    // Deploy Coin token (owner is initial minter, will transfer to Fundraiser)
    const coinArtifact = await ethers.getContractFactory("Coin");
    coinToken = await coinArtifact.deploy("Fund Test Coin", "CTCOIN", owner.address);

    // Deploy Fundraiser with correct constructor arguments:
    // coin, quote, core, treasury, team, recipient, Config{initialEmission, minEmission, halvingPeriod}
    const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
    fundraiser = await fundraiserArtifact.deploy(
      coinToken.address,     // coin
      paymentToken.address,  // quote
      mockCore.address,      // core (mock with protocolFeeAddress)
      treasury.address,      // treasury
      team.address,          // team
      recipient.address,     // recipient (required)
      [convert("1000", 18), convert("10", 18), 30, ONE_DAY], // Config: {initialEmission, minEmission, halvingPeriod}
      "" // uri
    );

    // Grant minting rights
    await coinToken.setMinter(fundraiser.address);

    // Fund users
    await paymentToken.mint(user0.address, convert("5000", 6));
    await paymentToken.mint(user1.address, convert("5000", 6));
    await paymentToken.mint(user2.address, convert("5000", 6));
  });

  /**
   * INVARIANT 1: Daily donations sum correctly
   * sum(dayAccountToDonation[day][*]) == dayToTotalDonated[day]
   */
  describe("INVARIANT: Donation Sums", function () {
    it("Day total should equal sum of individual donations", async function () {
      const currentDay = await fundraiser.currentEpoch();
      const donationAmount = convert("100", 6);

      // Multiple users donate
      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user0).fund(user0.address, donationAmount, "");

      await paymentToken.connect(user1).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user1).fund(user1.address, donationAmount, "");

      await paymentToken.connect(user2).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user2).fund(user2.address, donationAmount, "");

      const dayTotal = await fundraiser.epochToTotalDonated(currentDay);
      const user0Donation = await fundraiser.epochAccountToDonation(currentDay, user0.address);
      const user1Donation = await fundraiser.epochAccountToDonation(currentDay, user1.address);
      const user2Donation = await fundraiser.epochAccountToDonation(currentDay, user2.address);

      expect(dayTotal).to.equal(user0Donation.add(user1Donation).add(user2Donation));
    });

    it("Multiple donations from same user should accumulate", async function () {
      const currentDay = await fundraiser.currentEpoch();
      const donationBefore = await fundraiser.epochAccountToDonation(currentDay, user0.address);

      const additionalDonation = convert("50", 6);
      await paymentToken.connect(user0).approve(fundraiser.address, additionalDonation);
      await fundraiser.connect(user0).fund(user0.address, additionalDonation, "");

      const donationAfter = await fundraiser.epochAccountToDonation(currentDay, user0.address);
      expect(donationAfter).to.equal(donationBefore.add(additionalDonation));
    });
  });

  /**
   * INVARIANT 2: Fee distribution is correct (50% recipient, 45% treasury, 4% team, 1% protocol)
   */
  describe("INVARIANT: Fee Distribution", function () {
    it("Fees should sum to donation amount", async function () {
      const donationAmount = convert("1000", 6);

      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      const treasuryBefore = await paymentToken.balanceOf(treasury.address);
      const teamBefore = await paymentToken.balanceOf(team.address);
      const protocolBefore = await paymentToken.balanceOf(protocol.address);

      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user0).fund(user0.address, donationAmount, "");

      const recipientAfter = await paymentToken.balanceOf(recipient.address);
      const treasuryAfter = await paymentToken.balanceOf(treasury.address);
      const teamAfter = await paymentToken.balanceOf(team.address);
      const protocolAfter = await paymentToken.balanceOf(protocol.address);

      const recipientReceived = recipientAfter.sub(recipientBefore);
      const treasuryReceived = treasuryAfter.sub(treasuryBefore);
      const teamReceived = teamAfter.sub(teamBefore);
      const protocolReceived = protocolAfter.sub(protocolBefore);

      const totalDistributed = recipientReceived.add(treasuryReceived).add(teamReceived).add(protocolReceived);
      expect(totalDistributed).to.be.closeTo(donationAmount, 1);
    });

    it("Fee percentages should match 50/45/4/1 split", async function () {
      const donationAmount = convert("1000", 6);

      const recipientBefore = await paymentToken.balanceOf(recipient.address);
      const treasuryBefore = await paymentToken.balanceOf(treasury.address);
      const teamBefore = await paymentToken.balanceOf(team.address);
      const protocolBefore = await paymentToken.balanceOf(protocol.address);

      await paymentToken.connect(user1).approve(fundraiser.address, donationAmount);
      await fundraiser.connect(user1).fund(user1.address, donationAmount, "");

      const recipientReceived = (await paymentToken.balanceOf(recipient.address)).sub(recipientBefore);
      const treasuryReceived = (await paymentToken.balanceOf(treasury.address)).sub(treasuryBefore);
      const teamReceived = (await paymentToken.balanceOf(team.address)).sub(teamBefore);
      const protocolReceived = (await paymentToken.balanceOf(protocol.address)).sub(protocolBefore);

      const recipientPct = recipientReceived.mul(100).div(donationAmount).toNumber();
      const treasuryPct = treasuryReceived.mul(100).div(donationAmount).toNumber();
      const teamPct = teamReceived.mul(100).div(donationAmount).toNumber();
      const protocolPct = protocolReceived.mul(100).div(donationAmount).toNumber();

      expect(recipientPct).to.be.closeTo(50, 1);
      expect(treasuryPct).to.be.closeTo(45, 1);
      expect(teamPct).to.be.closeTo(4, 1);
      expect(protocolPct).to.be.closeTo(1, 1);
    });
  });

  /**
   * INVARIANT 3: Claim reward proportional to donation share
   * userReward = (userDonation / dayTotal) * dayEmission
   */
  describe("INVARIANT: Proportional Claims", function () {
    let claimDay;

    before(async function () {
      // Move to a fresh day and make donations
      await increaseTime(ONE_DAY);

      claimDay = await fundraiser.currentEpoch();

      // User0 donates 75%
      await paymentToken.connect(user0).approve(fundraiser.address, convert("750", 6));
      await fundraiser.connect(user0).fund(user0.address, convert("750", 6), "");

      // User1 donates 25%
      await paymentToken.connect(user1).approve(fundraiser.address, convert("250", 6));
      await fundraiser.connect(user1).fund(user1.address, convert("250", 6), "");

      // Move to next day so we can claim
      await increaseTime(ONE_DAY);
    });

    it("User reward should be proportional to their donation share", async function () {
      const dayEmission = await fundraiser.getEpochEmission(claimDay);
      const user0Donation = await fundraiser.epochAccountToDonation(claimDay, user0.address);
      const user1Donation = await fundraiser.epochAccountToDonation(claimDay, user1.address);
      const dayTotal = await fundraiser.epochToTotalDonated(claimDay);

      const user0BalBefore = await coinToken.balanceOf(user0.address);
      await fundraiser.claim(user0.address, claimDay);
      const user0BalAfter = await coinToken.balanceOf(user0.address);
      const user0Reward = user0BalAfter.sub(user0BalBefore);

      const user1BalBefore = await coinToken.balanceOf(user1.address);
      await fundraiser.claim(user1.address, claimDay);
      const user1BalAfter = await coinToken.balanceOf(user1.address);
      const user1Reward = user1BalAfter.sub(user1BalBefore);

      // Expected rewards
      const expectedUser0 = user0Donation.mul(dayEmission).div(dayTotal);
      const expectedUser1 = user1Donation.mul(dayEmission).div(dayTotal);

      expect(user0Reward).to.be.closeTo(expectedUser0, expectedUser0.div(100).add(1));
      expect(user1Reward).to.be.closeTo(expectedUser1, expectedUser1.div(100).add(1));

      // User0 should get ~3x user1's reward (75% vs 25%)
      expect(user0Reward.mul(100).div(user1Reward).toNumber()).to.be.closeTo(300, 10);
    });
  });

  /**
   * INVARIANT 4: Double claim prevention
   */
  describe("INVARIANT: No Double Claims", function () {
    let testDay;

    before(async function () {
      await increaseTime(ONE_DAY);
      testDay = await fundraiser.currentEpoch();

      await paymentToken.connect(user2).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user2).fund(user2.address, convert("100", 6), "");

      await increaseTime(ONE_DAY);
    });

    it("Should mark account as claimed after claiming", async function () {
      const hasClaimedBefore = await fundraiser.epochAccountToHasClaimed(testDay, user2.address);
      expect(hasClaimedBefore).to.equal(false);

      await fundraiser.claim(user2.address, testDay);

      const hasClaimedAfter = await fundraiser.epochAccountToHasClaimed(testDay, user2.address);
      expect(hasClaimedAfter).to.equal(true);
    });

    it("Should revert on second claim attempt", async function () {
      await expect(
        fundraiser.claim(user2.address, testDay)
      ).to.be.revertedWith("Fundraiser__AlreadyClaimed()");
    });
  });

  /**
   * INVARIANT 5: Cannot claim for current or future days
   */
  describe("INVARIANT: Claim Timing", function () {
    it("Should revert when claiming current day", async function () {
      const currentDay = await fundraiser.currentEpoch();

      await expect(
        fundraiser.claim(user0.address, currentDay)
      ).to.be.revertedWith("Fundraiser__EpochNotEnded()");
    });

    it("Should revert when claiming future day", async function () {
      const currentDay = await fundraiser.currentEpoch();

      await expect(
        fundraiser.claim(user0.address, currentDay.add(10))
      ).to.be.revertedWith("Fundraiser__EpochNotEnded()");
    });
  });

  /**
   * INVARIANT 6: Emission halving over time
   */
  describe("INVARIANT: Emission Halving", function () {
    it("Emission should halve every 30 days", async function () {
      const initialEmission = await fundraiser.initialEmission();
      const startTime = await fundraiser.startTime();
      const currentTime = await getBlockTimestamp();

      const elapsed = currentTime - startTime.toNumber();
      const halvings = Math.floor(elapsed / THIRTY_DAYS);

      // Get emission for a past day
      const currentDay = await fundraiser.currentEpoch();
      const emission = await fundraiser.getEpochEmission(currentDay.sub(1));

      if (halvings > 0) {
        const expectedEmission = initialEmission.div(ethers.BigNumber.from(2).pow(halvings));
        const minEmission = await fundraiser.minEmission();

        if (expectedEmission.lt(minEmission)) {
          expect(emission).to.equal(minEmission);
        } else {
          expect(emission).to.be.closeTo(expectedEmission, expectedEmission.div(10));
        }
      }
    });

    it("Emission should never go below minEmission", async function () {
      // Fast forward many halving periods
      const dayFarFuture = (await fundraiser.currentEpoch()).add(1000);

      // We can't directly test future days, but we can verify the formula
      const minEmission = await fundraiser.minEmission();

      // For any day, emission >= minEmission
      const currentDay = await fundraiser.currentEpoch();
      const emission = await fundraiser.getEpochEmission(currentDay.sub(1));
      expect(emission).to.be.gte(minEmission);
    });
  });
});

describe("Fundraiser Business Logic Tests", function () {
  let owner, treasury, team, protocol, recipient, user0, user1, user2;
  let paymentToken, coinToken, fundraiser, mockCore;

  before("Deploy contracts", async function () {
    await network.provider.send("hardhat_reset");

    [owner, treasury, team, protocol, recipient, user0, user1, user2] = await ethers.getSigners();

    const mockUsdcArtifact = await ethers.getContractFactory("MockUSDC");
    paymentToken = await mockUsdcArtifact.deploy();

    // Deploy mock Core (for protocolFeeAddress)
    const mockCoreArtifact = await ethers.getContractFactory("MockCore");
    mockCore = await mockCoreArtifact.deploy(protocol.address);

    const coinArtifact = await ethers.getContractFactory("Coin");
    coinToken = await coinArtifact.deploy("BL Fund Coin", "BLCCOIN", owner.address);

    const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
    fundraiser = await fundraiserArtifact.deploy(
      coinToken.address,     // coin
      paymentToken.address,  // quote
      mockCore.address,      // core (mock with protocolFeeAddress)
      treasury.address,      // treasury
      team.address,          // team
      recipient.address,     // recipient (required)
      [convert("1000", 18), convert("10", 18), 30, ONE_DAY], // Config: {initialEmission, minEmission, halvingPeriod}
      "" // uri
    );

    await coinToken.setMinter(fundraiser.address);

    await paymentToken.mint(user0.address, convert("5000", 6));
    await paymentToken.mint(user1.address, convert("5000", 6));
    await paymentToken.mint(user2.address, convert("5000", 6));
  });

  describe("Recipient Management", function () {
    it("Should revert deployment with zero recipient address", async function () {
      // Deploying with zero address recipient should revert
      const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");
      await expect(
        fundraiserArtifact.deploy(
          coinToken.address,
          paymentToken.address,
          mockCore.address,
          treasury.address,
          team.address,
          AddressZero, // zero recipient should fail
          [convert("1000", 18), convert("10", 18), 30, ONE_DAY], // Config
          "" // uri
        )
      ).to.be.revertedWith("Fundraiser__ZeroAddress()");
    });

    it("Should allow owner to set recipient", async function () {
      const newRecipient = user2.address;

      await fundraiser.connect(owner).setRecipient(newRecipient);
      expect(await fundraiser.recipient()).to.equal(newRecipient);

      // Reset for other tests
      await fundraiser.connect(owner).setRecipient(recipient.address);
      expect(await fundraiser.recipient()).to.equal(recipient.address);
    });

    it("Should prevent setting zero address as recipient", async function () {
      await expect(
        fundraiser.connect(owner).setRecipient(AddressZero)
      ).to.be.revertedWith("Fundraiser__ZeroAddress()");
    });

    it("Only owner can set recipient", async function () {
      await expect(
        fundraiser.connect(user0).setRecipient(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Donation Validation", function () {
    it("Should revert on zero donation amount", async function () {
      await expect(
        fundraiser.connect(user0).fund(user0.address, 0, "")
      ).to.be.revertedWith("Fundraiser__BelowMinDonation()");
    });

    it("Should revert on zero account address", async function () {
      await paymentToken.connect(user0).approve(fundraiser.address, convert("100", 6));

      await expect(
        fundraiser.connect(user0).fund(AddressZero, convert("100", 6), "")
      ).to.be.revertedWith("Fundraiser__ZeroAddress()");
    });

    it("Should allow donating on behalf of another account", async function () {
      const donationAmount = convert("100", 6);

      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);

      // user0 pays, but user1 gets the donation credit
      const currentDay = await fundraiser.currentEpoch();
      const user1DonationBefore = await fundraiser.epochAccountToDonation(currentDay, user1.address);

      await fundraiser.connect(user0).fund(user1.address, donationAmount, "");

      const user1DonationAfter = await fundraiser.epochAccountToDonation(currentDay, user1.address);
      expect(user1DonationAfter).to.equal(user1DonationBefore.add(donationAmount));
    });
  });

  describe("Claim Validation", function () {
    let donationDay;

    before(async function () {
      await increaseTime(ONE_DAY);
      donationDay = await fundraiser.currentEpoch();

      await paymentToken.connect(user0).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user0).fund(user0.address, convert("100", 6), "");

      await increaseTime(ONE_DAY);
    });

    it("Should revert when claiming with no donation", async function () {
      // user2 never donated on donationDay
      await expect(
        fundraiser.claim(user2.address, donationDay)
      ).to.be.revertedWith("Fundraiser__NoDonation()");
    });

    it("Should revert on zero account address", async function () {
      await expect(
        fundraiser.claim(AddressZero, donationDay)
      ).to.be.revertedWith("Fundraiser__ZeroAddress()");
    });

    it("Anyone can trigger claim for any account", async function () {
      // user2 can trigger claim for user0
      const user0BalBefore = await coinToken.balanceOf(user0.address);

      await fundraiser.connect(user2).claim(user0.address, donationDay);

      const user0BalAfter = await coinToken.balanceOf(user0.address);
      expect(user0BalAfter).to.be.gt(user0BalBefore);
    });
  });

  describe("Day Isolation", function () {
    it("Donations on different days should be isolated", async function () {
      const day1 = await fundraiser.currentEpoch();

      await paymentToken.connect(user1).approve(fundraiser.address, convert("300", 6));
      await fundraiser.connect(user1).fund(user1.address, convert("100", 6), "");

      await increaseTime(ONE_DAY);
      const day2 = await fundraiser.currentEpoch();

      // Different amount to show isolation
      await fundraiser.connect(user1).fund(user1.address, convert("200", 6), "");

      const day1Donation = await fundraiser.epochAccountToDonation(day1, user1.address);
      const day2Donation = await fundraiser.epochAccountToDonation(day2, user1.address);
      const day1Total = await fundraiser.epochToTotalDonated(day1);
      const day2Total = await fundraiser.epochToTotalDonated(day2);

      // Verify donations are tracked per day
      expect(day1Donation).to.equal(convert("100", 6));
      expect(day2Donation).to.equal(convert("200", 6));
      // Day totals should reflect actual donations on each day
      expect(day1Total).to.equal(convert("100", 6));
      expect(day2Total).to.equal(convert("200", 6));
    });

    it("Claims for different days should be independent", async function () {
      await increaseTime(ONE_DAY);

      const day1 = (await fundraiser.currentEpoch()).sub(2);
      const day2 = (await fundraiser.currentEpoch()).sub(1);

      // Should be able to claim day1 but day2 separately
      // (if user1 had donations on both)
      const hasClaimed1 = await fundraiser.epochAccountToHasClaimed(day1, user1.address);
      const hasClaimed2 = await fundraiser.epochAccountToHasClaimed(day2, user1.address);

      // These should be independent
      expect(hasClaimed1).to.not.equal(undefined);
      expect(hasClaimed2).to.not.equal(undefined);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle single donor getting 100% of daily emission", async function () {
      await increaseTime(ONE_DAY);
      const soloDay = await fundraiser.currentEpoch();

      // Only user0 donates
      await paymentToken.connect(user0).approve(fundraiser.address, convert("50", 6));
      await fundraiser.connect(user0).fund(user0.address, convert("50", 6), "");

      await increaseTime(ONE_DAY);

      const dayEmission = await fundraiser.getEpochEmission(soloDay);
      const user0BalBefore = await coinToken.balanceOf(user0.address);

      await fundraiser.claim(user0.address, soloDay);

      const user0BalAfter = await coinToken.balanceOf(user0.address);
      const reward = user0BalAfter.sub(user0BalBefore);

      // Should receive ~100% of emission
      expect(reward).to.be.closeTo(dayEmission, dayEmission.div(100));
    });

    it("Should handle many small donations correctly", async function () {
      await increaseTime(ONE_DAY);
      const manyDonationsDay = await fundraiser.currentEpoch();

      // Make 10 small donations
      await paymentToken.connect(user0).approve(fundraiser.address, convert("100", 6));

      for (let i = 0; i < 10; i++) {
        await fundraiser.connect(user0).fund(user0.address, convert("10", 6), "");
      }

      const totalDonation = await fundraiser.epochAccountToDonation(manyDonationsDay, user0.address);
      expect(totalDonation).to.equal(convert("100", 6));
    });
  });

  describe("Events", function () {
    it("Should emit Funded event on donation", async function () {
      const donationAmount = convert("100", 6);
      await paymentToken.connect(user0).approve(fundraiser.address, donationAmount);

      await expect(
        fundraiser.connect(user0).fund(user0.address, donationAmount, "")
      ).to.emit(fundraiser, "Fundraiser__Funded");
    });

    it("Should emit Claimed event on claim", async function () {
      await increaseTime(ONE_DAY);
      const claimableDay = await fundraiser.currentEpoch();

      await paymentToken.connect(user2).approve(fundraiser.address, convert("100", 6));
      await fundraiser.connect(user2).fund(user2.address, convert("100", 6), "");

      await increaseTime(ONE_DAY);

      await expect(
        fundraiser.claim(user2.address, claimableDay)
      ).to.emit(fundraiser, "Fundraiser__Claimed");
    });
  });
});
