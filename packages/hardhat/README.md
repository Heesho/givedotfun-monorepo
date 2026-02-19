# give.fun Smart Contracts

A perpetual funding platform on Base. Fundraisers are paired with USDC, initial liquidity is permanently locked, and token emissions follow halving schedules.

---

## Table of Contents

- [Overview](#overview)
- [Fundraiser - Donation Pool](#fundraiser---donation-pool)
- [Shared Infrastructure](#shared-infrastructure)
  - [Launch Sequence](#launch-sequence)
  - [Unit Token](#unit-token)
  - [Treasury Auctions](#treasury-auctions)
  - [Registry](#registry)
- [Contract Architecture](#contract-architecture)
- [Contract Reference](#contract-reference)
- [Parameter Bounds](#parameter-bounds)
- [Security Model](#security-model)
- [Development](#development)

---

## Overview

When someone launches a fundraiser on give.fun, the system:

1. Deploys an ERC20 token (Unit) with voting/permit support
2. Creates a Unit/USDC liquidity pool on Uniswap V2
3. Burns the LP tokens permanently (liquidity can never be removed)
4. Deploys a Fundraiser contract that controls all future token minting
5. Deploys an Auction contract for treasury LP buybacks
6. Locks minting rights to the Fundraiser (one-time, irreversible)

---

## Fundraiser - Donation Pool

Users donate payment tokens to a daily pool. Donations are split between a designated recipient and the treasury. At the end of each day, donors claim their proportional share of that day's token emission.

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

- Each day has a fixed emission amount: `initialEmission >> (day / halvingPeriod)`
- Halving is day-count based (e.g., every 30 days)
- Floor at `minEmission`
- Donors claim proportionally: `(userDonation / dayTotal) * dayEmission`

**Claiming:**

- Claims are available once the day ends (day < currentDay)
- Each account can claim once per day
- No double claims (tracked per account per day)
- Multicall provides batch claiming across multiple days

**Minimum donation:** 10,000 wei of the payment token (prevents dust donations that produce zero fee splits).

---

## Shared Infrastructure

### Launch Sequence

The launch flow is orchestrated by FundraiserCore:

```
User calls FundraiserCore.launch(params)
    |
    +-- 1. Validate params (launcher, quoteToken, usdc, name, symbol, unitAmount)
    +-- 2. Transfer USDC from launcher
    +-- 3. Deploy Unit token (ERC20 with voting/permit)
    +-- 4. Mint initial Unit tokens for LP seeding
    +-- 5. Create Uniswap V2 pair (Unit/USDC), add liquidity
    +-- 6. Burn LP tokens to 0x000...dEaD (permanent liquidity)
    +-- 7. Deploy Auction contract (LP buyback mechanism)
    +-- 8. Deploy Fundraiser contract (validates fundraiser-specific params)
    +-- 9. Lock minting rights: Unit.setRig(fundraiser) (one-time, irreversible)
    +-- 10. Transfer Fundraiser ownership to launcher
    +-- 11. Register with central Registry
```

### Unit Token

Every launch creates a new Unit (ERC20) with:

- **ERC20Permit** - Gasless approvals via signatures
- **ERC20Votes** - On-chain governance voting support
- **Controlled minting** - Only the Fundraiser contract can mint, permanently locked via one-time `setRig()`
- **No supply cap** - Supply is bounded only by the halving schedule and tail emission
- **Burn support** - Anyone can burn their own tokens

### Treasury Auctions

Each fundraiser has an associated Auction contract. Treasury fees (45%) accumulate as the quote token in the Auction contract. Anyone can buy the accumulated tokens by paying with LP tokens, which are sent to the burn address.

This creates deflationary pressure on the LP supply: as more treasury fees accumulate and get auctioned off, LP tokens are permanently removed from circulation.

### Registry

A central Registry contract tracks all deployed fundraisers. Only approved Core contracts (factories) can register new fundraisers. The Registry provides enumeration and lookup of fundraiser metadata.

---

## Contract Architecture

```
                        +------------------+
                        |    Registry      |
                        | (central index)  |
                        +--------+---------+
                                 |
                        +--------v-----------+
                        |  FundraiserCore    |
                        | (launch orchestrator)|
                        +--+----+---+--------+
                           |    |   |
                           v    v   v
                        Unit  Fundraiser  Auction
                        Factory  Factory  Factory
                           |    |   |
                           v    v   v
                        +-----+ +--------+ +-----+
                        |Unit | |Fundraiser| |Auct.|
                        |ERC20| |         | |     |
                        +-----+ +---------+ +-----+

                        +---------------------+
                        | FundraiserMulticall  |
                        | (batch ops +        |
                        |  view helpers)      |
                        +---------------------+
```

### File Structure

```
contracts/
+-- Auction.sol              # Dutch auction for treasury LP buybacks
+-- AuctionFactory.sol       # Deploys Auction instances
+-- Registry.sol             # Central fundraiser registry
+-- Unit.sol                 # ERC20 token with voting/permit
+-- UnitFactory.sol          # Deploys Unit instances
+-- interfaces/              # Shared interfaces
+-- rigs/
    +-- fundraiser/
        +-- FundraiserCore.sol         # Launch orchestrator for Fundraisers
        +-- Fundraiser.sol             # Donation pool with daily claims
        +-- FundraiserFactory.sol      # Deploys Fundraiser instances
        +-- FundraiserMulticall.sol    # Batch fund/claim + view helpers
        +-- interfaces/
```

---

## Contract Reference

### FundraiserCore

```solidity
// Launch a new fundraiser (deploys Unit + LP + Auction + Fundraiser)
function launch(LaunchParams calldata params)
    external returns (address unit, address rig, address auction, address lpToken)

// Admin
function setProtocolFeeAddress(address) external      // owner only
function setMinUsdcForLaunch(uint256) external        // owner only

// View
function deployedRigsLength() external view returns (uint256)
function isDeployedRig(address) external view returns (bool)
function rigToUnit(address) external view returns (address)
function rigToAuction(address) external view returns (address)
function rigToLP(address) external view returns (address)
```

### Fundraiser

```solidity
// Donate to the daily pool
function fund(address account, uint256 amount) external

// Claim token reward for a past day
function claim(address account, uint256 day) external

// Owner functions
function setRecipient(address) external
function setTreasury(address) external
function setTeam(address) external
function setUri(string memory) external

// View
function currentDay() external view returns (uint256)
function getDayEmission(uint256 day) external view returns (uint256)
function getDayTotal(uint256 day) external view returns (uint256)
function getPendingReward(uint256 day, address account) external view returns (uint256)
function getUserDonation(uint256 day, address account) external view returns (uint256)
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

### FundraiserMulticall

```solidity
function fund(address rig, address account, uint256 amount, string calldata _uri) external
function claim(address rig, address account, uint256 day) external
function claimMultiple(address rig, address account, uint256[] calldata dayIds) external
function buy(...) external
function launch(...) external returns (...)
function getRig(address rig, address account) external view returns (RigState memory)
function getClaimableDays(address rig, address account, uint256 startDay, uint256 endDay) external view returns (ClaimableDay[] memory)
function getAuction(address rig, address account) external view returns (AuctionState memory)
```

---

## Parameter Bounds

### Fundraiser

| Parameter | Min | Max | Description |
|-----------|-----|-----|-------------|
| `initialEmission` | 1e18 | 1e30 | Starting daily token emission |
| `minEmission` | 1 | initialEmission | Minimum daily emission floor |
| `halvingPeriod` | 7 days | 365 days | Days between halvings |

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
npx hardhat test tests/fund/testBusinessLogic.js

# With gas reporting
REPORT_GAS=true npx hardhat test
```

### Test Suite

| Directory | Files | Coverage |
|-----------|-------|----------|
| `tests/fund/` | 3 files | Fundraiser core, business logic, invariants |
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
