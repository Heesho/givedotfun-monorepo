const convert = (amount, decimals) => ethers.utils.parseUnits(amount, decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const AddressZero = "0x0000000000000000000000000000000000000000";
const AddressDead = "0x000000000000000000000000000000000000dEaD";

let owner, protocol, user0, user1, user2;
let usdc, core;
let fundraiser, auction, coin, lpToken;
let coinFactory, auctionFactory, fundraiserFactory;
let uniswapFactory, uniswapRouter;

describe("Core Launch Tests", function () {
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

    // Mint USDC to user0 for launching
    await usdc.mint(user0.address, convert("1000", 6));
    console.log("- USDC minted to user0");

    console.log("Initialization Complete\n");
  });

  it("Core state is correct", async function () {
    console.log("******************************************************");
    expect(await core.protocolFeeAddress()).to.equal(protocol.address);
    expect(await core.usdcToken()).to.equal(usdc.address);
    expect(await core.minUsdcForLaunch()).to.equal(convert("100", 6));
    console.log("Core state verified");
  });

  it("Launch a new fundraiser", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address, // recipient receives 50% of donations
      tokenName: "Test Coin",
      tokenSymbol: "TCOIN",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18), // 345,600 per day
      minEmission: convert("864", 18), // 864 per day
      halvingPeriod: 30, // 30 epochs
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400, // 1 day
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    // Approve USDC
    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    // Launch
    const tx = await core.connect(user0).launch(launchParams);
    const receipt = await tx.wait();

    // Get deployed addresses from event
    const launchEvent = receipt.events.find((e) => e.event === "Core__Launched");
    fundraiser = launchEvent.args.fundraiser;
    coin = launchEvent.args.coin;
    auction = launchEvent.args.auction;
    lpToken = launchEvent.args.lpToken;

    console.log("Fundraiser deployed at:", fundraiser);
    console.log("Coin token deployed at:", coin);
    console.log("Auction deployed at:", auction);
    console.log("LP Token at:", lpToken);

    // Verify registry
    expect(await core.isFundraiser(fundraiser)).to.equal(true);
    expect(await core.fundraiserToAuction(fundraiser)).to.equal(auction);
    expect(await core.fundraisers(0)).to.equal(fundraiser);
    expect(await core.fundraisersLength()).to.equal(1);
    expect(await core.fundraiserToIndex(fundraiser)).to.equal(0);
    expect(await core.fundraiserToLP(fundraiser)).to.equal(lpToken);
  });

  it("Fundraiser ownership transferred to launcher", async function () {
    console.log("******************************************************");
    const fundraiserContract = await ethers.getContractAt("Fundraiser", fundraiser);
    expect(await fundraiserContract.owner()).to.equal(user0.address);
    console.log("Fundraiser owner:", await fundraiserContract.owner());
  });

  it("Coin minting rights transferred to Fundraiser", async function () {
    console.log("******************************************************");
    const coinContract = await ethers.getContractAt("Coin", coin);
    expect(await coinContract.minter()).to.equal(fundraiser);
    console.log("Coin minter:", await coinContract.minter());
  });

  it("LP tokens burned", async function () {
    console.log("******************************************************");
    const lpContract = await ethers.getContractAt("IERC20", lpToken);
    const deadBalance = await lpContract.balanceOf(AddressDead);
    console.log("LP tokens burned (in dead address):", divDec(deadBalance));
    expect(deadBalance).to.be.gt(0);
  });

  it("Fundraiser parameters correct", async function () {
    console.log("******************************************************");
    const fundraiserContract = await ethers.getContractAt("Fundraiser", fundraiser);

    expect(await fundraiserContract.coin()).to.equal(coin);
    expect(await fundraiserContract.quote()).to.equal(usdc.address);
    expect(await fundraiserContract.treasury()).to.equal(auction); // treasury = auction
    expect(await fundraiserContract.team()).to.equal(user0.address); // team = launcher
    expect(await fundraiserContract.core()).to.equal(core.address);
    expect(await fundraiserContract.initialEmission()).to.equal(convert("345600", 18));
    expect(await fundraiserContract.minEmission()).to.equal(convert("864", 18));

    console.log("Fundraiser parameters verified");
  });

  it("Cannot launch with insufficient USDC", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "Test Coin 2",
      tokenSymbol: "TCOIN2",
      uri: "https://example.com/fund",
      usdcAmount: convert("50", 6), // Less than minUsdcForLaunch (100)
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Core__InsufficientUsdc()"
    );
    console.log("Launch correctly reverted with insufficient USDC");
  });

  it("Cannot launch with zero launcher address", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: AddressZero,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "Test Coin 2",
      tokenSymbol: "TCOIN2",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Core__ZeroAddress()"
    );
    console.log("Launch correctly reverted with zero launcher address");
  });

  it("Cannot launch with zero quote token", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user0.address,
      quoteToken: AddressZero,
      recipient: user1.address,
      tokenName: "Test Coin 2",
      tokenSymbol: "TCOIN2",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Core__ZeroAddress()"
    );
    console.log("Launch correctly reverted with zero quote token");
  });

  it("Cannot launch with empty token name", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "",
      tokenSymbol: "TCOIN2",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Core__EmptyTokenName()"
    );
    console.log("Launch correctly reverted with empty token name");
  });

  it("Cannot launch with empty token symbol", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "Test Coin 2",
      tokenSymbol: "",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Core__EmptyTokenSymbol()"
    );
    console.log("Launch correctly reverted with empty token symbol");
  });

  it("Cannot launch with zero coin amount", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "Test Coin 2",
      tokenSymbol: "TCOIN2",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: 0,
      initialEmission: convert("345600", 18),
      minEmission: convert("864", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Core__ZeroCoinAmount()"
    );
    console.log("Launch correctly reverted with zero coin amount");
  });

  it("Cannot launch with invalid emission parameters", async function () {
    console.log("******************************************************");

    // minEmission > initialEmission
    const launchParams = {
      launcher: user0.address,
      quoteToken: usdc.address,
      recipient: user1.address,
      tokenName: "Test Coin 2",
      tokenSymbol: "TCOIN2",
      uri: "https://example.com/fund",
      usdcAmount: convert("500", 6),
      coinAmount: convert("1000000", 18),
      initialEmission: convert("100", 18),
      minEmission: convert("200", 18), // greater than initial
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("1000", 6),
      auctionEpochPeriod: 86400,
      auctionPriceMultiplier: convert("1.5", 18),
      auctionMinInitPrice: convert("1", 6),
    };

    await usdc.connect(user0).approve(core.address, launchParams.usdcAmount);

    await expect(core.connect(user0).launch(launchParams)).to.be.revertedWith(
      "Fundraiser__EmissionOutOfRange()"
    );
    console.log("Launch correctly reverted with invalid emission");
  });

  it("Protocol owner can change protocol fee address", async function () {
    console.log("******************************************************");

    // Only core owner can change protocol fee address
    await expect(
      core.connect(user0).setProtocolFeeAddress(user0.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // Core owner can change
    await core.connect(owner).setProtocolFeeAddress(user2.address);
    expect(await core.protocolFeeAddress()).to.equal(user2.address);
    console.log("Protocol fee address changed to:", await core.protocolFeeAddress());

    // Change back
    await core.connect(owner).setProtocolFeeAddress(protocol.address);
  });

  it("Protocol owner can change min USDC for launch", async function () {
    console.log("******************************************************");

    await expect(
      core.connect(user0).setMinUsdcForLaunch(convert("200", 6))
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await core.connect(owner).setMinUsdcForLaunch(convert("200", 6));
    expect(await core.minUsdcForLaunch()).to.equal(convert("200", 6));
    console.log("Min USDC for launch:", divDec(await core.minUsdcForLaunch()));

    // Change back
    await core.connect(owner).setMinUsdcForLaunch(convert("100", 6));
  });

  it("Can launch multiple fundraisers", async function () {
    console.log("******************************************************");

    const launchParams = {
      launcher: user1.address,
      quoteToken: usdc.address,
      recipient: user2.address,
      tokenName: "Second Coin",
      tokenSymbol: "SCOIN",
      uri: "https://example.com/fund2",
      usdcAmount: convert("500", 6),
      coinAmount: convert("2000000", 18),
      initialEmission: convert("172800", 18), // different emission
      minEmission: convert("432", 18),
      halvingPeriod: 30,
      epochDuration: 86400, // 1 day
      auctionInitPrice: convert("2000", 6),
      auctionEpochPeriod: 86400 * 2,
      auctionPriceMultiplier: convert("2", 18),
      auctionMinInitPrice: convert("10", 6),
    };

    // Mint and approve USDC for user1
    await usdc.mint(user1.address, convert("1000", 6));
    await usdc.connect(user1).approve(core.address, launchParams.usdcAmount);

    const tx = await core.connect(user1).launch(launchParams);
    await tx.wait();

  });
});
