const { ethers } = require("hardhat");
const hre = require("hardhat");

// Constants
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
const convert = (amount, decimals) => ethers.utils.parseUnits(amount, decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;

// Get the next pending nonce fresh from the node each time
async function getNextNonce() {
  const [wallet] = await ethers.getSigners();
  return await wallet.getTransactionCount("pending");
}

// =============================================================================
// CONFIGURATION - UPDATE THESE FOR YOUR DEPLOYMENT
// =============================================================================

// Base Mainnet addresses
const USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Real USDC on Base

// Mock Token addresses (for staging/testing on mainnet)
const MOCK_USDC = "0xe90495BE187d434e23A9B1FeC0B6Ce039700870e"; // Mock USDC for testing

// Toggle between mock and mainnet tokens
const USDC_ADDRESS = MOCK_USDC; // Switch to USDC_MAINNET for production

const UNISWAP_V2_FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";
const UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";

// Protocol settings
const PROTOCOL_FEE_ADDRESS = "0xbA366c82815983fF130C23CED78bD95E1F2c18EA"; // TODO: Set protocol fee recipient
const MULTISIG_ADDRESS = "0xeE0CB49D2805DA6bC0A979ddAd87bb793fbB765E";
const MIN_USDC_FOR_LAUNCH = convert("1", 6); // 1 USDC minimum

// Deployed Contract Addresses (reset for fresh deploy)
const COIN_FACTORY = "0x53eeafA38487e14056BCd8285Ed8b01F7E516543";
const AUCTION_FACTORY = "0x32044F51c537963D1f432EA47d729B8969EaF8C9";
const FUNDRAISER_FACTORY = "0x1BA2F843da7C023a8AA1B94fdc25D414FF34ea43";
const CORE = "0xA0d79A8D35B6aCBFCa41241A3aaaA00a71C9B139";
const MULTICALL = "0x438CA5F624a4e814c7d577972213DC2827f7CE1D";

// Contract Variables
let usdc, coinFactory, auctionFactory, fundraiserFactory, core, multicall;

// =============================================================================
// GET CONTRACTS
// =============================================================================

async function getContracts() {
  usdc = await ethers.getContractAt(
    "contracts/mocks/MockUSDC.sol:MockUSDC",
    USDC_ADDRESS,
  );

  if (COIN_FACTORY) {
    coinFactory = await ethers.getContractAt(
      "contracts/CoinFactory.sol:CoinFactory",
      COIN_FACTORY,
    );
  }

  if (AUCTION_FACTORY) {
    auctionFactory = await ethers.getContractAt(
      "contracts/AuctionFactory.sol:AuctionFactory",
      AUCTION_FACTORY,
    );
  }

  if (FUNDRAISER_FACTORY) {
    fundraiserFactory = await ethers.getContractAt(
      "contracts/FundraiserFactory.sol:FundraiserFactory",
      FUNDRAISER_FACTORY,
    );
  }

  if (CORE) {
    core = await ethers.getContractAt("contracts/Core.sol:Core", CORE);
  }

  if (MULTICALL) {
    multicall = await ethers.getContractAt(
      "contracts/Multicall.sol:Multicall",
      MULTICALL,
    );
  }

  console.log("Contracts Retrieved");
}

// =============================================================================
// DEPLOY FUNCTIONS
// =============================================================================

async function deployCoinFactory() {
  console.log("Starting CoinFactory Deployment");
  const artifact = await ethers.getContractFactory("CoinFactory");
  const contract = await artifact.deploy({
    gasPrice: ethers.gasPrice,
    nonce: await getNextNonce(),
  });
  coinFactory = await contract.deployed();
  await sleep(5000);
  console.log("CoinFactory Deployed at:", coinFactory.address);
}

async function deployAuctionFactory() {
  console.log("Starting AuctionFactory Deployment");
  const artifact = await ethers.getContractFactory("AuctionFactory");
  const contract = await artifact.deploy({
    gasPrice: ethers.gasPrice,
    nonce: await getNextNonce(),
  });
  auctionFactory = await contract.deployed();
  await sleep(5000);
  console.log("AuctionFactory Deployed at:", auctionFactory.address);
}

async function deployFundraiserFactory() {
  console.log("Starting FundraiserFactory Deployment");
  const artifact = await ethers.getContractFactory("FundraiserFactory");
  const contract = await artifact.deploy({
    gasPrice: ethers.gasPrice,
    nonce: await getNextNonce(),
  });
  fundraiserFactory = await contract.deployed();
  await sleep(5000);
  console.log("FundraiserFactory Deployed at:", fundraiserFactory.address);
}

async function deployCore() {
  console.log("Starting Core Deployment");

  if (!PROTOCOL_FEE_ADDRESS) {
    throw new Error("PROTOCOL_FEE_ADDRESS must be set before deployment");
  }
  if (!USDC_ADDRESS) {
    throw new Error("USDC_ADDRESS must be set before deployment");
  }

  const artifact = await ethers.getContractFactory("Core");
  const contract = await artifact.deploy(
    USDC_ADDRESS,
    UNISWAP_V2_FACTORY,
    UNISWAP_V2_ROUTER,
    coinFactory.address,
    auctionFactory.address,
    fundraiserFactory.address,
    PROTOCOL_FEE_ADDRESS,
    MIN_USDC_FOR_LAUNCH,
    { gasPrice: ethers.gasPrice, nonce: await getNextNonce() },
  );
  core = await contract.deployed();
  await sleep(5000);
  console.log("Core Deployed at:", core.address);
}

async function deployMulticall() {
  console.log("Starting Multicall Deployment");
  const artifact = await ethers.getContractFactory("Multicall");
  const contract = await artifact.deploy(core.address, USDC_ADDRESS, {
    gasPrice: ethers.gasPrice,
  });
  multicall = await contract.deployed();
  await sleep(5000);
  console.log("Multicall Deployed at:", multicall.address);
}

// =============================================================================
// VERIFY FUNCTIONS
// =============================================================================

async function verifyCoinFactory() {
  console.log("Starting CoinFactory Verification");
  await hre.run("verify:verify", {
    address: coinFactory?.address || COIN_FACTORY,
    contract: "contracts/CoinFactory.sol:CoinFactory",
    constructorArguments: [],
  });
  console.log("CoinFactory Verified");
}

async function verifyAuctionFactory() {
  console.log("Starting AuctionFactory Verification");
  await hre.run("verify:verify", {
    address: auctionFactory?.address || AUCTION_FACTORY,
    contract: "contracts/AuctionFactory.sol:AuctionFactory",
    constructorArguments: [],
  });
  console.log("AuctionFactory Verified");
}

async function verifyFundraiserFactory() {
  console.log("Starting FundraiserFactory Verification");
  await hre.run("verify:verify", {
    address: fundraiserFactory?.address || FUNDRAISER_FACTORY,
    contract: "contracts/FundraiserFactory.sol:FundraiserFactory",
    constructorArguments: [],
  });
  console.log("FundraiserFactory Verified");
}

async function verifyCore() {
  console.log("Starting Core Verification");
  await hre.run("verify:verify", {
    address: core?.address || CORE,
    contract: "contracts/Core.sol:Core",
    constructorArguments: [
      USDC_ADDRESS,
      UNISWAP_V2_FACTORY,
      UNISWAP_V2_ROUTER,
      coinFactory?.address || COIN_FACTORY,
      auctionFactory?.address || AUCTION_FACTORY,
      fundraiserFactory?.address || FUNDRAISER_FACTORY,
      PROTOCOL_FEE_ADDRESS,
      MIN_USDC_FOR_LAUNCH,
    ],
  });
  console.log("Core Verified");
}

async function verifyMulticall() {
  console.log("Starting Multicall Verification");
  await hre.run("verify:verify", {
    address: multicall?.address || MULTICALL,
    contract: "contracts/Multicall.sol:Multicall",
    constructorArguments: [core?.address || CORE, USDC_ADDRESS],
  });
  console.log("Multicall Verified");
}

// --- Fundraiser-specific verification ---

async function verifyFundraiserCoinByAddress(fundraiserAddress) {
  const fundraiser = await ethers.getContractAt(
    "contracts/Fundraiser.sol:Fundraiser",
    fundraiserAddress,
  );
  const coinAddress = await fundraiser.coin();
  const coin = await ethers.getContractAt(
    "contracts/Coin.sol:Coin",
    coinAddress,
  );

  const name = await coin.name();
  const symbol = await coin.symbol();
  const coreAddress = core?.address || CORE;

  console.log("Starting Coin Verification for:", coinAddress);
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Initial Minter (Core):", coreAddress);

  await hre.run("verify:verify", {
    address: coinAddress,
    contract: "contracts/Coin.sol:Coin",
    constructorArguments: [name, symbol, coreAddress],
  });
  console.log("Coin Verified:", coinAddress);
}

async function getFundraiserCoinVerificationInfo(fundraiserAddress) {
  const fundraiser = await ethers.getContractAt(
    "contracts/Fundraiser.sol:Fundraiser",
    fundraiserAddress,
  );
  const coinAddress = await fundraiser.coin();
  const coin = await ethers.getContractAt(
    "contracts/Coin.sol:Coin",
    coinAddress,
  );

  const name = await coin.name();
  const symbol = await coin.symbol();
  const coreAddress = core?.address || CORE;

  const abiCoder = new ethers.utils.AbiCoder();
  const encodedArgs = abiCoder.encode(
    ["string", "string", "address"],
    [name, symbol, coreAddress],
  );
  const encodedArgsNoPrefix = encodedArgs.slice(2);

  console.log("\n=== Coin Verification Info ===\n");
  console.log("Coin Address:", coinAddress);
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Core:", coreAddress);
  console.log("\nABI-Encoded Constructor Arguments (for BaseScan):");
  console.log(encodedArgsNoPrefix);
  console.log("\n==============================\n");

  return {
    coinAddress,
    name,
    symbol,
    coreAddress,
    encodedArgs: encodedArgsNoPrefix,
  };
}

async function verifyFundraiserByAddress(fundraiserAddress) {
  const fundraiser = await ethers.getContractAt(
    "contracts/Fundraiser.sol:Fundraiser",
    fundraiserAddress,
  );

  const coinAddress = await fundraiser.coin();
  const quoteToken = await fundraiser.quote();
  const coreAddress = await fundraiser.core();
  const treasury = await fundraiser.treasury();
  const team = await fundraiser.team();
  const recipient = await fundraiser.recipient();
  const initialEmission = await fundraiser.initialEmission();
  const minEmission = await fundraiser.minEmission();
  const halvingPeriod = await fundraiser.halvingPeriod();
  const epochDuration = await fundraiser.epochDuration();
  const uri = await fundraiser.uri();

  console.log("Starting Fundraiser Verification for:", fundraiserAddress);
  console.log("  Coin:", coinAddress);
  console.log("  Quote:", quoteToken);
  console.log("  Core:", coreAddress);
  console.log("  Treasury:", treasury);
  console.log("  Team:", team);
  console.log("  Recipient:", recipient);
  console.log("  Initial Emission:", initialEmission.toString());
  console.log("  Min Emission:", minEmission.toString());
  console.log("  Halving Period:", halvingPeriod.toString());
  console.log("  Epoch Duration:", epochDuration.toString());
  console.log("  URI:", uri);

  await hre.run("verify:verify", {
    address: fundraiserAddress,
    contract: "contracts/Fundraiser.sol:Fundraiser",
    constructorArguments: [
      coinAddress,
      quoteToken,
      coreAddress,
      treasury,
      team,
      recipient,
      {
        initialEmission: initialEmission,
        minEmission: minEmission,
        halvingPeriod: halvingPeriod,
        epochDuration: epochDuration,
      },
      uri,
    ],
  });
  console.log("Fundraiser Verified:", fundraiserAddress);
}

async function verifyFundraiserAuctionByAddress(fundraiserAddress) {
  const auctionAddress = await core.fundraiserToAuction(fundraiserAddress);
  const auction = await ethers.getContractAt(
    "contracts/Auction.sol:Auction",
    auctionAddress,
  );

  const paymentToken = await auction.paymentToken();
  const paymentReceiver = await auction.paymentReceiver();
  const epochPeriod = await auction.epochPeriod();
  const priceMultiplier = await auction.priceMultiplier();
  const minInitPrice = await auction.minInitPrice();

  const epochId = await auction.epochId();
  const currentInitPrice = await auction.initPrice();
  const initPrice = epochId.eq(0) ? currentInitPrice : minInitPrice;

  if (!epochId.eq(0)) {
    console.log(
      "  WARNING: Auction has been used (epochId > 0). Using minInitPrice as initPrice.",
    );
    console.log(
      "  If verification fails, you may need to find the original auctionInitPrice from launch event.",
    );
  }

  console.log("Starting Auction Verification for:", auctionAddress);
  console.log("  Init Price:", initPrice.toString());
  console.log("  Payment Token:", paymentToken);
  console.log("  Payment Receiver:", paymentReceiver);
  console.log("  Epoch Period:", epochPeriod.toString());
  console.log("  Price Multiplier:", priceMultiplier.toString());
  console.log("  Min Init Price:", minInitPrice.toString());

  await hre.run("verify:verify", {
    address: auctionAddress,
    contract: "contracts/Auction.sol:Auction",
    constructorArguments: [
      initPrice,
      paymentToken,
      paymentReceiver,
      epochPeriod,
      priceMultiplier,
      minInitPrice,
    ],
  });
  console.log("Auction Verified:", auctionAddress);
}

// =============================================================================
// CONFIGURATION FUNCTIONS
// =============================================================================

async function setProtocolFeeAddress(coreContract, newAddress) {
  console.log("Setting Protocol Fee Address to:", newAddress);
  const tx = await coreContract.setProtocolFeeAddress(newAddress);
  await tx.wait();
  console.log("Protocol Fee Address updated");
}

async function setMinUsdcForLaunch(coreContract, amount) {
  console.log("Setting Min USDC for Launch to:", divDec(amount));
  const tx = await coreContract.setMinUsdcForLaunch(amount);
  await tx.wait();
  console.log("Min USDC updated");
}

async function transferCoreOwnership(newOwner) {
  console.log("Transferring Core ownership to:", newOwner);
  const tx = await core.transferOwnership(newOwner);
  await tx.wait();
  console.log("Core ownership transferred");
}

// =============================================================================
// PRINT FUNCTIONS
// =============================================================================

async function printDeployment() {
  console.log("\n==================== DEPLOYMENT ====================\n");

  console.log("--- Configuration ---");
  console.log("USDC:                ", USDC_ADDRESS);
  console.log("Uniswap V2 Factory:  ", UNISWAP_V2_FACTORY);
  console.log("Uniswap V2 Router:   ", UNISWAP_V2_ROUTER);
  console.log("Protocol Fee Address:", PROTOCOL_FEE_ADDRESS || "NOT SET");
  console.log("Min USDC for Launch:", divDec(MIN_USDC_FOR_LAUNCH));

  console.log("\n--- Deployed Contracts ---");
  console.log(
    "CoinFactory:         ",
    coinFactory?.address || COIN_FACTORY || "NOT DEPLOYED",
  );
  console.log(
    "AuctionFactory:      ",
    auctionFactory?.address || AUCTION_FACTORY || "NOT DEPLOYED",
  );
  console.log(
    "FundraiserFactory:   ",
    fundraiserFactory?.address || FUNDRAISER_FACTORY || "NOT DEPLOYED",
  );
  console.log("Core:                ", core?.address || CORE || "NOT DEPLOYED");
  console.log(
    "Multicall:           ",
    multicall?.address || MULTICALL || "NOT DEPLOYED",
  );

  if (core) {
    console.log("\n--- Core State ---");
    console.log("Owner:               ", await core.owner());
    console.log("Protocol Fee Address:", await core.protocolFeeAddress());
    console.log("Min USDC:           ", divDec(await core.minUsdcForLaunch()));
  }

  console.log("\n====================================================\n");
}

async function printCoreState(coreContract, label) {
  console.log(`\n--- ${label} State ---`);
  console.log("Owner:               ", await coreContract.owner());
  console.log("Protocol Fee Address:", await coreContract.protocolFeeAddress());
  console.log("USDC:               ", await coreContract.usdcToken());
  console.log(
    "Min USDC:           ",
    divDec(await coreContract.minUsdcForLaunch()),
  );
  console.log("Coin Factory:        ", await coreContract.coinFactory());
  console.log("Auction Factory:     ", await coreContract.auctionFactory());
  console.log("Fundraiser Factory:  ", await coreContract.fundraiserFactory());
  console.log("");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const [wallet] = await ethers.getSigners();
  console.log("Using wallet:", wallet.address);
  console.log(
    "Account balance:",
    ethers.utils.formatEther(await wallet.getBalance()),
    "ETH",
  );
  console.log("");

  await getContracts();

  //===================================================================
  // 1. Deploy System
  //===================================================================

  // console.log("Starting Deployment...");
  // await deployCoinFactory();
  // await deployAuctionFactory();
  // await deployFundraiserFactory();
  // await deployCore();
  // await deployMulticall();

  //===================================================================
  // 2. Verify Contracts
  //===================================================================

  // console.log("Starting Verification...");
  // await verifyCoinFactory();
  // await sleep(5000);
  // await verifyAuctionFactory();
  // await sleep(5000);
  // await verifyFundraiserFactory();
  // await sleep(5000);
  // await verifyCore();
  // await sleep(5000);
  // await verifyMulticall();
  // await sleep(5000);

  // --- Fundraiser-specific verification (pass fundraiser address) ---
  // await getFundraiserCoinVerificationInfo("0xFUNDRAISER_ADDRESS");
  // await verifyFundraiserCoinByAddress("0xFUNDRAISER_ADDRESS");
  // await sleep(5000);
  // await verifyFundraiserByAddress("0xFUNDRAISER_ADDRESS");
  // await sleep(5000);
  // await verifyFundraiserAuctionByAddress("0xFUNDRAISER_ADDRESS");
  // await sleep(5000);

  //===================================================================
  // 3. Configuration (optional)
  //===================================================================

  // await setProtocolFeeAddress(core, PROTOCOL_FEE_ADDRESS);
  // await setMinUsdcForLaunch(core, MIN_USDC_FOR_LAUNCH);

  //===================================================================
  // 4. Transfer Ownership (optional)
  //===================================================================

  // await transferCoreOwnership(MULTISIG_ADDRESS);

  //===================================================================
  // Print Deployment
  //===================================================================

  await printDeployment();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
