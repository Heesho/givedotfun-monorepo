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
const REGISTRY = "";
const UNIT_FACTORY = "";
const AUCTION_FACTORY = "";
const FUNDRAISER_CORE = "";
const FUNDRAISER_MULTICALL = "";

// Contract Variables
let usdc,
  registry,
  unitFactory,
  auctionFactory,
  fundraiserCore,
  fundraiserMulticall;

// =============================================================================
// GET CONTRACTS
// =============================================================================

async function getContracts() {
  usdc = await ethers.getContractAt(
    "contracts/mocks/MockUSDC.sol:MockUSDC",
    USDC_ADDRESS
  );

  if (REGISTRY) {
    registry = await ethers.getContractAt(
      "contracts/Registry.sol:Registry",
      REGISTRY
    );
  }

  if (UNIT_FACTORY) {
    unitFactory = await ethers.getContractAt(
      "contracts/UnitFactory.sol:UnitFactory",
      UNIT_FACTORY
    );
  }

  if (AUCTION_FACTORY) {
    auctionFactory = await ethers.getContractAt(
      "contracts/AuctionFactory.sol:AuctionFactory",
      AUCTION_FACTORY
    );
  }

  if (FUNDRAISER_CORE) {
    fundraiserCore = await ethers.getContractAt(
      "contracts/FundraiserCore.sol:FundraiserCore",
      FUNDRAISER_CORE
    );
  }

  if (FUNDRAISER_MULTICALL) {
    fundraiserMulticall = await ethers.getContractAt(
      "contracts/FundraiserMulticall.sol:FundraiserMulticall",
      FUNDRAISER_MULTICALL
    );
  }

  console.log("Contracts Retrieved");
}

// =============================================================================
// DEPLOY FUNCTIONS
// =============================================================================

async function deployRegistry() {
  console.log("Starting Registry Deployment");
  const artifact = await ethers.getContractFactory("Registry");
  const contract = await artifact.deploy({ gasPrice: ethers.gasPrice, nonce: await getNextNonce() });
  registry = await contract.deployed();
  await sleep(5000);
  console.log("Registry Deployed at:", registry.address);
}

async function deployUnitFactory() {
  console.log("Starting UnitFactory Deployment");
  const artifact = await ethers.getContractFactory("UnitFactory");
  const contract = await artifact.deploy({ gasPrice: ethers.gasPrice, nonce: await getNextNonce() });
  unitFactory = await contract.deployed();
  await sleep(5000);
  console.log("UnitFactory Deployed at:", unitFactory.address);
}

async function deployAuctionFactory() {
  console.log("Starting AuctionFactory Deployment");
  const artifact = await ethers.getContractFactory("AuctionFactory");
  const contract = await artifact.deploy({ gasPrice: ethers.gasPrice, nonce: await getNextNonce() });
  auctionFactory = await contract.deployed();
  await sleep(5000);
  console.log("AuctionFactory Deployed at:", auctionFactory.address);
}

async function deployFundraiserCore() {
  console.log("Starting FundraiserCore Deployment");

  if (!PROTOCOL_FEE_ADDRESS) {
    throw new Error("PROTOCOL_FEE_ADDRESS must be set before deployment");
  }
  if (!USDC_ADDRESS) {
    throw new Error("USDC_ADDRESS must be set before deployment");
  }
  if (!registry?.address && !REGISTRY) {
    throw new Error("Registry must be deployed before FundraiserCore");
  }

  const registryAddress = registry?.address || REGISTRY;

  const artifact = await ethers.getContractFactory("FundraiserCore");
  const contract = await artifact.deploy(
    registryAddress,
    USDC_ADDRESS,
    UNISWAP_V2_FACTORY,
    UNISWAP_V2_ROUTER,
    unitFactory.address,
    auctionFactory.address,
    PROTOCOL_FEE_ADDRESS,
    MIN_USDC_FOR_LAUNCH,
    { gasPrice: ethers.gasPrice, nonce: await getNextNonce() }
  );
  fundraiserCore = await contract.deployed();
  await sleep(5000);
  console.log("FundraiserCore Deployed at:", fundraiserCore.address);
}

async function approveFundraiserCore() {
  console.log("Approving FundraiserCore as factory in Registry...");
  const coreAddress = fundraiserCore?.address || FUNDRAISER_CORE;
  const tx = await registry.setFactoryApproval(coreAddress, true, { nonce: await getNextNonce() });
  await tx.wait();
  console.log("FundraiserCore approved in Registry");
}

async function deployFundraiserMulticall() {
  console.log("Starting FundraiserMulticall Deployment");
  const artifact = await ethers.getContractFactory("FundraiserMulticall");
  const contract = await artifact.deploy(fundraiserCore.address, USDC_ADDRESS, {
    gasPrice: ethers.gasPrice,
  });
  fundraiserMulticall = await contract.deployed();
  await sleep(5000);
  console.log("FundraiserMulticall Deployed at:", fundraiserMulticall.address);
}

// =============================================================================
// VERIFY FUNCTIONS
// =============================================================================

async function verifyRegistry() {
  console.log("Starting Registry Verification");
  await hre.run("verify:verify", {
    address: registry?.address || REGISTRY,
    contract: "contracts/Registry.sol:Registry",
    constructorArguments: [],
  });
  console.log("Registry Verified");
}

async function verifyUnitFactory() {
  console.log("Starting UnitFactory Verification");
  await hre.run("verify:verify", {
    address: unitFactory?.address || UNIT_FACTORY,
    contract: "contracts/UnitFactory.sol:UnitFactory",
    constructorArguments: [],
  });
  console.log("UnitFactory Verified");
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

async function verifyFundraiserCore() {
  console.log("Starting FundraiserCore Verification");
  await hre.run("verify:verify", {
    address: fundraiserCore?.address || FUNDRAISER_CORE,
    contract: "contracts/rigs/fundraiser/FundraiserCore.sol:FundraiserCore",
    constructorArguments: [
      registry?.address || REGISTRY,
      USDC_ADDRESS,
      UNISWAP_V2_FACTORY,
      UNISWAP_V2_ROUTER,
      unitFactory?.address || UNIT_FACTORY,
      auctionFactory?.address || AUCTION_FACTORY,
      PROTOCOL_FEE_ADDRESS,
      MIN_USDC_FOR_LAUNCH,
    ],
  });
  console.log("FundraiserCore Verified");
}

async function verifyFundraiserMulticall() {
  console.log("Starting FundraiserMulticall Verification");
  await hre.run("verify:verify", {
    address: fundraiserMulticall?.address || FUNDRAISER_MULTICALL,
    contract: "contracts/rigs/fundraiser/FundraiserMulticall.sol:FundraiserMulticall",
    constructorArguments: [fundraiserCore?.address || FUNDRAISER_CORE, USDC_ADDRESS],
  });
  console.log("FundraiserMulticall Verified");
}

// --- Fundraiser-specific verification ---

async function verifyFundraiserUnitByRigAddress(rigAddress) {
  const rig = await ethers.getContractAt(
    "contracts/Fundraiser.sol:Fundraiser",
    rigAddress
  );
  const unitAddress = await rig.unit();
  const unit = await ethers.getContractAt(
    "contracts/Unit.sol:Unit",
    unitAddress
  );

  const name = await unit.name();
  const symbol = await unit.symbol();
  const coreAddress = fundraiserCore?.address || FUNDRAISER_CORE;

  console.log("Starting Unit Verification for:", unitAddress);
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Initial Rig (Core):", coreAddress);

  await hre.run("verify:verify", {
    address: unitAddress,
    contract: "contracts/Unit.sol:Unit",
    constructorArguments: [name, symbol, coreAddress],
  });
  console.log("Unit Verified:", unitAddress);
}

async function getFundraiserUnitVerificationInfo(rigAddress) {
  const rig = await ethers.getContractAt(
    "contracts/Fundraiser.sol:Fundraiser",
    rigAddress
  );
  const unitAddress = await rig.unit();
  const unit = await ethers.getContractAt(
    "contracts/Unit.sol:Unit",
    unitAddress
  );

  const name = await unit.name();
  const symbol = await unit.symbol();
  const coreAddress = fundraiserCore?.address || FUNDRAISER_CORE;

  const abiCoder = new ethers.utils.AbiCoder();
  const encodedArgs = abiCoder.encode(
    ["string", "string", "address"],
    [name, symbol, coreAddress]
  );
  const encodedArgsNoPrefix = encodedArgs.slice(2);

  console.log("\n=== Fundraiser Unit Verification Info ===\n");
  console.log("Unit Address:", unitAddress);
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Initial Rig (Core):", coreAddress);
  console.log("\nABI-Encoded Constructor Arguments (for BaseScan):");
  console.log(encodedArgsNoPrefix);
  console.log("\n==============================\n");

  return {
    unitAddress,
    name,
    symbol,
    coreAddress,
    encodedArgs: encodedArgsNoPrefix,
  };
}

async function verifyFundraiserByAddress(rigAddress) {
  const rig = await ethers.getContractAt(
    "contracts/Fundraiser.sol:Fundraiser",
    rigAddress
  );

  const unitAddress = await rig.unit();
  const quoteToken = await rig.quote();
  const coreAddress = await rig.core();
  const treasury = await rig.treasury();
  const team = await rig.team();
  const recipient = await rig.recipient();
  const initialEmission = await rig.initialEmission();
  const minEmission = await rig.minEmission();
  const halvingPeriod = await rig.halvingPeriod();

  console.log("Starting Fundraiser Verification for:", rigAddress);
  console.log("  Unit:", unitAddress);
  console.log("  Quote:", quoteToken);
  console.log("  Core:", coreAddress);
  console.log("  Treasury:", treasury);
  console.log("  Team:", team);
  console.log("  Recipient:", recipient);
  console.log("  Initial Emission:", initialEmission.toString());
  console.log("  Min Emission:", minEmission.toString());
  console.log("  Halving Period:", halvingPeriod.toString());

  await hre.run("verify:verify", {
    address: rigAddress,
    contract: "contracts/rigs/fundraiser/Fundraiser.sol:Fundraiser",
    constructorArguments: [
      unitAddress,
      quoteToken,
      coreAddress,
      treasury,
      team,
      recipient,
      {
        initialEmission: initialEmission,
        minEmission: minEmission,
        halvingPeriod: halvingPeriod,
      },
    ],
  });
  console.log("Fundraiser Verified:", rigAddress);
}

async function verifyFundraiserAuctionByRigAddress(rigAddress) {
  const auctionAddress = await fundraiserCore.rigToAuction(rigAddress);
  const auction = await ethers.getContractAt(
    "contracts/Auction.sol:Auction",
    auctionAddress
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
      "  WARNING: Auction has been used (epochId > 0). Using minInitPrice as initPrice."
    );
    console.log(
      "  If verification fails, you may need to find the original auctionInitPrice from launch event."
    );
  }

  console.log("Starting Fundraiser Auction Verification for:", auctionAddress);
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
  console.log("Fundraiser Auction Verified:", auctionAddress);
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

async function transferFundraiserCoreOwnership(newOwner) {
  console.log("Transferring FundraiserCore ownership to:", newOwner);
  const tx = await fundraiserCore.transferOwnership(newOwner);
  await tx.wait();
  console.log("FundraiserCore ownership transferred");
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
    "Registry:            ",
    registry?.address || REGISTRY || "NOT DEPLOYED"
  );
  console.log(
    "UnitFactory:         ",
    unitFactory?.address || UNIT_FACTORY || "NOT DEPLOYED"
  );
  console.log(
    "AuctionFactory:      ",
    auctionFactory?.address || AUCTION_FACTORY || "NOT DEPLOYED"
  );
  console.log(
    "FundraiserCore:      ",
    fundraiserCore?.address || FUNDRAISER_CORE || "NOT DEPLOYED"
  );
  console.log(
    "FundraiserMulticall: ",
    fundraiserMulticall?.address || FUNDRAISER_MULTICALL || "NOT DEPLOYED"
  );

  if (fundraiserCore) {
    console.log("\n--- FundraiserCore State ---");
    console.log("Owner:               ", await fundraiserCore.owner());
    console.log("Protocol Fee Address:", await fundraiserCore.protocolFeeAddress());
    console.log(
      "Min USDC:           ",
      divDec(await fundraiserCore.minUsdcForLaunch())
    );
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
    divDec(await coreContract.minUsdcForLaunch())
  );
  console.log("Unit Factory:        ", await coreContract.unitFactory());
  console.log("Auction Factory:     ", await coreContract.auctionFactory());
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
    "ETH"
  );
  console.log("");

  await getContracts();

  //===================================================================
  // 1. Deploy System
  //===================================================================

  // --- Shared infrastructure ---
  console.log("Starting Deployment...");
  await deployRegistry();
  await deployUnitFactory();
  await deployAuctionFactory();

  // --- FundraiserCore ---
  await deployFundraiserCore();
  await approveFundraiserCore();
  await deployFundraiserMulticall();

  //===================================================================
  // 2. Verify Contracts
  //===================================================================

  // --- Shared infrastructure ---
  // console.log("Starting Verification...");
  // await verifyRegistry();
  // await sleep(5000);
  // await verifyUnitFactory();
  // await sleep(5000);
  // await verifyAuctionFactory();
  // await sleep(5000);

  // // --- FundraiserCore ---
  // await verifyFundraiserCore();
  // await sleep(5000);
  // await verifyFundraiserMulticall();
  // await sleep(5000);

  // --- Fundraiser-specific verification (pass rig address) ---
  // await getFundraiserUnitVerificationInfo("0xRIG_ADDRESS");
  // await verifyFundraiserUnitByRigAddress("0xRIG_ADDRESS");
  // await sleep(5000);
  // await verifyFundraiserByAddress("0xRIG_ADDRESS");
  // await sleep(5000);
  // await verifyFundraiserAuctionByRigAddress("0xRIG_ADDRESS");
  // await sleep(5000);

  //===================================================================
  // 3. Configuration (optional)
  //===================================================================

  // await setProtocolFeeAddress(fundraiserCore, PROTOCOL_FEE_ADDRESS);
  // await setMinUsdcForLaunch(fundraiserCore, MIN_USDC_FOR_LAUNCH);

  //===================================================================
  // 4. Transfer Ownership (optional)
  //===================================================================

  // await transferFundraiserCoreOwnership(MULTISIG_ADDRESS);

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
