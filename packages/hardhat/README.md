# give.fun Smart Contracts

A perpetual funding platform on Base. Fundraisers are paired with USDC, initial liquidity is permanently locked, and token emissions follow halving schedules.

---

## Table of Contents

- [Overview](#overview)
- [Fundraiser - Donation Pool](#fundraiser---donation-pool)
- [Shared Infrastructure](#shared-infrastructure)
  - [Launch Sequence](#launch-sequence)
  - [Coin Token](#coin-token)
  - [Treasury Auctions](#treasury-auctions)
- [Contract Architecture](#contract-architecture)
- [Contract Reference](#contract-reference)
- [Parameter Bounds](#parameter-bounds)
- [Security Model](#security-model)
- [Development](#development)

---

## Overview

When someone launches a fundraiser on give.fun, the system:

1. Deploys an ERC20 token (Coin) with voting/permit support
2. Creates a Coin/USDC liquidity pool on Uniswap V2
3. Burns the LP tokens permanently (liquidity can never be removed)
4. Deploys a Fundraiser contract that controls all future token minting
5. Deploys an Auction contract for treasury LP buybacks
6. Locks minting rights to the Fundraiser (one-time, irreversible)

---

## Fundraiser - Donation Pool

Users donate payment tokens to an epoch pool. Donations are split between a designated recipient and the treasury. At the end of each epoch, donors claim their proportional share of that epoch's token emission.

**How it works:**

```
Day 0: Emission = 1000 tokens
  Alice donates 60 USDC, Bob donates 40 USDC
  Total donations: 100 USDC

  50 USDC -> recipient (charity, creator, etc.)
  45 USDC -> treasury (for LP auctions)
   4 USDC -> team
   1 USDC -> protocol

Day 1: Alice claims 600 tokens (60%), Bob claims 400 tokens (40%)

Day 1: Emission = 1000 tokens (same until halving)
  ...cycle continues
```

**Fee split on each donation:**

| Recipient | Share | Description |
|-----------|-------|-------------|
| Recipient | 50% | The cause/creator being funded |
| Treasury | 45% | Accumulates for LP auctions |
| Team | 4% | Launcher's revenue |
| Protocol | 1% | Platform fee |

**Token emissions:**

- Each epoch has a fixed emission amount: `initialEmission >> (epoch / halvingPeriod)`
- Halving is epoch-count based (e.g., every 30 epochs)
- Floor at `minEmission`
- Donors claim proportionally: `(userDonation / dayTotal) * dayEmission`

**Claiming:**

- Claims are available once the epoch ends (epoch < currentEpoch)
- Each account can claim once per epoch
- No double claims (tracked per account per epoch)
- Multicall provides batch claiming across multiple days

**Minimum donation:** 10,000 wei of the payment token (prevents dust donations that produce zero fee splits).

---

## Shared Infrastructure

### Launch Sequence

The launch flow is orchestrated by Core:

```
User calls Core.launch(params)
    |
    +-- 1. Validate params (launcher, quoteToken, usdc, name, symbol, coinAmount)
    +-- 2. Transfer USDC from launcher
    +-- 3. Deploy Coin token (ERC20 with voting/permit)
    +-- 4. Mint initial Coin tokens for LP seeding
    +-- 5. Create Uniswap V2 pair (Coin/USDC), add liquidity
    +-- 6. Burn LP tokens to 0x000...dEaD (permanent liquidity)
    +-- 7. Deploy Auction contract via AuctionFactory (LP buyback mechanism)
    +-- 8. Deploy Fundraiser contract via FundraiserFactory (validates fundraiser-specific params)
    +-- 9. Lock minting rights: Coin.setMinter(fundraiser) (one-time, irreversible)
    +-- 10. Transfer Fundraiser ownership to launcher
```

### Coin Token

Every launch creates a new Coin (ERC20) with:

- **ERC20Permit** - Gasless approvals via signatures
- **ERC20Votes** - On-chain governance voting support
- **Controlled minting** - Only the Fundraiser contract can mint, permanently locked via one-time `setMinter()`
- **No supply cap** - Supply is bounded only by the halving schedule and tail emission
- **Burn support** - Anyone can burn their own tokens

### Treasury Auctions

Each fundraiser has an associated Auction contract. Treasury fees (45%) accumulate as the quote token in the Auction contract. Anyone can buy the accumulated tokens by paying with LP tokens, which are sent to the burn address.

This creates deflationary pressure on the LP supply: as more treasury fees accumulate and get auctioned off, LP tokens are permanently removed from circulation.

---

## Contract Architecture

```
                        +--------------------+
                        |       Core         |
                        | (launch orchestrator)|
                        +--+----+---+--------+
                           |    |
                           v    v
                    Coin   Fundraiser  Auction
                    Factory  Factory   Factory
                       |       |         |
                       v       v         v
                    +-----+ +------+ +-----+
                    |Coin | |Fund- | |Auct.|
                    |ERC20| |raiser| |     |
                    +-----+ +------+ +-----+

All three child contracts are deployed through their respective factories.

                        +---------------------+
                        |     Multicall       |
                        | (batch ops +        |
                        |  view helpers)      |
                        +---------------------+
```

### File Structure

```
contracts/
+-- Auction.sol              # Dutch auction for treasury LP buybacks
+-- AuctionFactory.sol       # Deploys Auction instances
+-- Core.sol                 # Launch orchestrator for Fundraisers
+-- Fundraiser.sol           # Donation pool with epoch-based claims
+-- FundraiserFactory.sol    # Deploys Fundraiser instances
+-- Multicall.sol            # Batch fund/claim + view helpers
+-- Coin.sol                 # ERC20 token with voting/permit
+-- CoinFactory.sol          # Deploys Coin instances
+-- interfaces/              # All interfaces (IFundraiser, ICore, ICoin, ICoinFactory, etc.)
+-- mocks/                   # Test mocks (MockUSDC, MockUniswapV2, etc.)
```

---

## Contract Reference

### Core

```solidity
// Launch a new fundraiser (deploys Coin + LP + Auction + Fundraiser)
function launch(LaunchParams calldata params)
    external returns (address coin, address fundraiser, address auction, address lpToken)

// Admin
function setProtocolFeeAddress(address) external      // owner only
function setMinUsdcForLaunch(uint256) external        // owner only

// View
function fundraisersLength() external view returns (uint256)
function fundraiserToIsFundraiser(address) external view returns (bool)
function fundraiserToAuction(address) external view returns (address)
function fundraiserToLP(address) external view returns (address)
```

### Fundraiser

```solidity
// Donate to the current epoch's pool
function fund(address account, uint256 amount, string calldata uri) external

// Claim token reward for a past epoch
function claim(address account, uint256 epoch) external

// Owner functions
function setRecipient(address) external
function setTreasury(address) external
function setTeam(address) external
function setUri(string calldata) external

// View
function currentEpoch() external view returns (uint256)
function getEpochEmission(uint256 epoch) external view returns (uint256)
function getPendingReward(uint256 epoch, address account) external view returns (uint256)
function epochToTotalDonated(uint256 epoch) external view returns (uint256)
function epochAccountToDonation(uint256 epoch, address account) external view returns (uint256)
```

### Auction

```solidity
// Buy accumulated treasury tokens with LP tokens (LP is burned)
function buy(
    address[] calldata assets,
    address assetsReceiver,
    uint256 _epochId,
    uint256 deadline,
    uint256 maxPaymentTokenAmount
) external returns (uint256 paymentAmount)

// View
function getPrice() external view returns (uint256)
function epochId() external view returns (uint256)
```

### Multicall

```solidity
function fund(address fundraiser, address account, uint256 amount, string calldata _uri) external
function claim(address fundraiser, address account, uint256 epoch) external
function claimMultiple(address fundraiser, address account, uint256[] calldata epochIds) external
function buy(...) external
function launch(...) external returns (...)
function getFundraiser(address fundraiser, address account) external view returns (FundraiserState memory)
function getClaimableEpochs(address fundraiser, address account, uint256 startEpoch, uint256 endEpoch) external view returns (ClaimableEpoch[] memory)
function getTotalPendingRewards(address fundraiser, address account, uint256 startEpoch, uint256 endEpoch) external view returns (uint256, uint256[] memory)
function getEmissionSchedule(address fundraiser, uint256 numEpochs) external view returns (uint256[] memory)
function getAuction(address fundraiser, address account) external view returns (AuctionState memory)
```

---

## Parameter Bounds

### Fundraiser

| Parameter | Min | Max | Description |
|-----------|-----|-----|-------------|
| `initialEmission` | 1e18 | 1e30 | Starting token emission per epoch |
| `minEmission` | 1 | initialEmission | Minimum emission floor per epoch |
| `halvingPeriod` | 7 | 365 | Epochs between halvings |
| `epochDuration` | 1 hour | 7 days | Duration of each epoch |

### Auction (shared)

| Parameter | Min | Max | Description |
|-----------|-----|-----|-------------|
| `epochPeriod` | 1 hour | 365 days | Auction duration |
| `priceMultiplier` | 1.1x | 3x | Price reset multiplier |
| `minInitPrice` | 1e6 | uint192 max | Floor starting price |
| `initPrice` | minInitPrice | uint192 max | Initial starting price |

---

## Security Model

### Immutable After Launch

- Token name and symbol
- Quote token (payment token)
- All emission parameters (initialEmission, minEmission, halvingPeriod)
- Fee split percentages
- Recipient address split percentages
- Initial liquidity (LP burned to dead address)
- Minting rights (permanently locked to Fundraiser)

### Mutable by Fundraiser Owner

- Treasury address
- Team address (can be set to zero to disable)
- Metadata URI
- Recipient address

### Cannot Be Done

- Mint tokens outside the Fundraiser mechanism
- Remove or reduce initial liquidity
- Pause, stop, or freeze any fundraiser
- Change emission rates
- Upgrade contracts (all are non-upgradeable)

### Protections

- **ReentrancyGuard** on all state-changing entry points
- **SafeERC20** for all token transfers
- **Frontrun protection** via epochId, deadline, and maxPrice on auction functions

### Unsupported Token Types

The following are **not supported** as quote/payment tokens:

- **Fee-on-transfer tokens** (transfer amount != received amount)
- **Rebasing tokens** (balances change without transfers)
- **Tokens with blocklists** (may cause unexpected reverts)

Use standard ERC20 tokens: USDC, WETH, DAI, etc.

---

## Development

### Setup

```bash
npm install
npx hardhat compile
```

### Testing

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test tests/fundraiser/testCharityRig.js

# With gas reporting
REPORT_GAS=true npx hardhat test
```

### Test Suite

| Directory | Files | Coverage |
|-----------|-------|----------|
| `tests/fundraiser/` | 3 files | Fundraiser core, business logic, invariants |
| `tests/security/` | 4+ files | Edge cases, exploits, fuzz testing, invariants |

### Deployment

```bash
# Configure .env
PRIVATE_KEY=your_deployer_private_key
RPC_URL=https://mainnet.base.org
SCAN_API_KEY=your_basescan_api_key

# Deploy
npx hardhat run scripts/deploy.js --network base
```

### Dependencies

- Solidity 0.8.19 (Paris EVM target)
- OpenZeppelin Contracts (ERC20, Ownable, ReentrancyGuard, SafeERC20)
- Uniswap V2 (LP creation)

---

## License

MIT
