/**
 * @title Adversarial quote token behavior tests
 * @notice These tests lock in protocol assumptions around ERC20 semantics.
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const convert = (amount, decimals = 18) => ethers.utils.parseUnits(amount.toString(), decimals);

describe("Psycho Adversarial Token Semantics", function () {
  let owner, treasury, team, protocol, recipient, user0;
  let badReturnToken;
  let feeToken;
  let coinForBadReturn;
  let coinForFee;
  let core;
  let fundraiserWithBadReturn;
  let fundraiserWithFeeToken;

  beforeEach("deploy base contracts", async function () {
    await network.provider.send("hardhat_reset");

    [owner, treasury, team, protocol, recipient, user0] = await ethers.getSigners();

    const mockCoreArtifact = await ethers.getContractFactory("MockCore");
    core = await mockCoreArtifact.deploy(protocol.address);

    const coinArtifact = await ethers.getContractFactory("Coin");
    coinForBadReturn = await coinArtifact.deploy("Adversarial Coin A", "ACOIN_A", owner.address);
    coinForFee = await coinArtifact.deploy("Adversarial Coin B", "ACOIN_B", owner.address);

    const badTokenArtifact = await ethers.getContractFactory("MockFalseReturnToken");
    badReturnToken = await badTokenArtifact.deploy("Mock Bad Return", "MBRET", 6);

    const feeTokenArtifact = await ethers.getContractFactory("MockFeeOnTransferToken");
    feeToken = await feeTokenArtifact.deploy("Mock Fee Token", "MFEE", 6, 500, protocol.address);

    await badReturnToken.mint(owner.address, convert("100000", 6));
    await badReturnToken.mint(user0.address, convert("100000", 6));
    await feeToken.mint(user0.address, convert("100000", 6));
    await badReturnToken.mint(recipient.address, convert("100000", 6));

    const fundraiserArtifact = await ethers.getContractFactory("Fundraiser");

    fundraiserWithBadReturn = await fundraiserArtifact.deploy(
      coinForBadReturn.address,
      badReturnToken.address,
      core.address,
      treasury.address,
      team.address,
      recipient.address,
      [convert("1000", 18), convert("10", 18), 30, 86400],
      ""
    );
    fundraiserWithFeeToken = await fundraiserArtifact.deploy(
      coinForFee.address,
      feeToken.address,
      core.address,
      treasury.address,
      team.address,
      recipient.address,
      [convert("1000", 18), convert("10", 18), 30, 86400],
      ""
    );

    await coinForBadReturn.setMinter(fundraiserWithBadReturn.address);
    await coinForFee.setMinter(fundraiserWithFeeToken.address);
  });

  it("should reject non-standard quote token that returns false (ERC20 transferFrom)", async function () {
    await badReturnToken.connect(owner).setAlwaysFalse(true);

    const donation = convert("100", 6);
    const epoch = await fundraiserWithBadReturn.currentEpoch();

    await expect(fundraiserWithBadReturn.connect(owner).fund(owner.address, donation, "bad-return")).to.be.reverted;
    expect(await fundraiserWithBadReturn.epochToTotalDonated(epoch)).to.equal(0);
    expect(await badReturnToken.balanceOf(fundraiserWithBadReturn.address)).to.equal(0);

    await badReturnToken.connect(owner).setAlwaysFalse(false);
  });

  it("should revert deterministically when quote fee-on-transfer steals funds", async function () {
    const donation = convert("100", 6);
    const epoch = await fundraiserWithFeeToken.currentEpoch();

    await feeToken.connect(user0).approve(fundraiserWithFeeToken.address, donation);

    await expect(fundraiserWithFeeToken.connect(user0).fund(user0.address, donation, "fee-breaks"))
      .to.be.reverted;

    expect(await fundraiserWithFeeToken.epochToTotalDonated(epoch)).to.equal(0);
    expect(await feeToken.balanceOf(fundraiserWithFeeToken.address)).to.equal(0);

    // sanity: the protocol assumption is to use non-rebasing/non-fee-transfer quote tokens only.
  });

  it("Multicall should fail before touching state if quote token is non-standard", async function () {
    const usdcArtifact = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcArtifact.deploy();

    const uniswapFactoryArtifact = await ethers.getContractFactory("MockUniswapV2Factory");
    const uniswapFactory = await uniswapFactoryArtifact.deploy();
    const uniswapRouterArtifact = await ethers.getContractFactory("MockUniswapV2Router");
    const uniswapRouter = await uniswapRouterArtifact.deploy(uniswapFactory.address);

    const coinFactoryArtifact = await ethers.getContractFactory("CoinFactory");
    const coinFactory = await coinFactoryArtifact.deploy();
    const auctionFactory = await (await ethers.getContractFactory("AuctionFactory")).deploy();
    const fundraiserFactory = await (await ethers.getContractFactory("FundraiserFactory")).deploy();

    const baseCore = await (await ethers.getContractFactory("Core")).deploy(
      usdc.address,
      uniswapFactory.address,
      uniswapRouter.address,
      coinFactory.address,
      auctionFactory.address,
      fundraiserFactory.address,
      protocol.address,
      convert("100", 6)
    );

    const multicall = await (await ethers.getContractFactory("Multicall")).deploy(baseCore.address, usdc.address);

    // bootstrap base fundraiser for this test path
    await usdc.mint(user0.address, convert("500", 6));
    await badReturnToken.mint(user0.address, convert("500", 6));

    const launchParams = {
      launcher: user0.address,
      quoteToken: badReturnToken.address,
      recipient: recipient.address,
      tokenName: "Bad Return Fund",
      tokenSymbol: "BRF",
      uri: "https://example.com/bad-return",
      usdcAmount: convert("100", 6),
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

    await badReturnToken.connect(user0).setAlwaysFalse(true);

    await usdc.connect(user0).approve(baseCore.address, launchParams.usdcAmount);
    const receipt = await (await baseCore.connect(user0).launch(launchParams)).wait();
    const launchEvent = receipt.events.find((e) => e.event === "Core__Launched");
    const launchedFundraiser = launchEvent.args.fundraiser;

    // bad-return token should block multicall donation path as early as the first pull.
    await badReturnToken.connect(user0).approve(multicall.address, convert("100", 6));
    await expect(multicall.connect(user0).fund(launchedFundraiser, user0.address, convert("1", 6), ""))
      .to.be.reverted;

    await badReturnToken.connect(user0).setAlwaysFalse(false);
  });
});
