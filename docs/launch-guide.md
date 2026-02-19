# Launch Parameters Guide

## Overview

Launching a fundraiser on give.fun creates three contracts:

1. **Unit** -- An ERC20 token with permit and voting capabilities.
2. **Fundraiser** -- The donation-based distribution mechanism.
3. **Auction** -- A Dutch auction for selling treasury-accumulated assets in exchange for LP token burns.

To launch, you configure the fundraiser parameters and provide USDC for initial liquidity. The USDC is paired with newly minted Unit tokens to create a Uniswap V2 liquidity pool. The resulting LP tokens are burned to the dead address, permanently locking the liquidity.

All launch parameters are **immutable** -- they cannot be changed after deployment. Choose carefully.

---

## Common Parameters

### Token and Liquidity

| Parameter | Type | Description |
|-----------|------|-------------|
| `quoteToken` | `address` | ERC20 token used for donations (typically USDC). Must be a standard ERC20 with no fee-on-transfer or rebasing. |
| `tokenName` | `string` | Name of the Unit token (e.g., "My Token"). |
| `tokenSymbol` | `string` | Symbol of the Unit token (e.g., "MYT"). |
| `usdcAmount` | `uint256` | Amount of USDC to provide for initial liquidity. Determines the starting price of the Unit token. |
| `unitAmount` | `uint256` | Amount of Unit tokens to mint for initial liquidity. Together with `usdcAmount`, determines the initial Unit/USDC price ratio. |
| `uri` | `string` | Metadata URI for the fundraiser (e.g., logo, description). Can be updated by the owner after launch. |

### Auction Parameters

Every fundraiser launch includes an Auction contract. These parameters configure the treasury Dutch auction.

| Parameter | Type | Description | Valid Range |
|-----------|------|-------------|-------------|
| `auctionInitPrice` | `uint256` | Starting price for the first auction epoch (in LP tokens). | `auctionMinInitPrice` to `type(uint192).max` |
| `auctionEpochPeriod` | `uint256` | Duration of each auction epoch. | 1 hour to 365 days |
| `auctionPriceMultiplier` | `uint256` | Multiplier applied to the last purchase price to set the next epoch's starting price (18 decimals). | `1.1e18` (1.1x) to `3e18` (3x) |
| `auctionMinInitPrice` | `uint256` | Minimum starting price per auction epoch. Prevents the auction from resetting to trivially low prices. | `1e6` to `type(uint192).max` |

---

## Fundraiser Parameters

Fundraiser distributes tokens through donations. Users donate USDC into a daily pool, and after the day ends, each donor can claim their proportional share of that day's Unit token emission. Donations are split immediately: 50% to the recipient, 45% to treasury, 4% to team, 1% to protocol.

### Configuration

| Parameter | Type | Description | Valid Range |
|-----------|------|-------------|-------------|
| `recipient` | `address` | Address that receives 50% of all donations. Required; cannot be zero. Can be updated by the owner post-launch. | Non-zero address |
| `initialEmission` | `uint256` | Unit tokens emitted per day at launch. This is the total daily emission -- donors split it proportionally based on their contribution. | `1e18` to `1e30` |
| `minEmission` | `uint256` | Minimum daily emission floor. After enough halvings, emission will never drop below this value. | 1 to `initialEmission` |
| `halvingPeriod` | `uint256` | Number of days between halvings. Emission halves every `halvingPeriod` days since deployment. | 7 to 365 (in days) |

### Fee Split

| Recipient | Percentage |
|-----------|-----------|
| Donation recipient | 50% |
| Treasury | 45% |
| Team | 4% |
| Protocol | 1% |

### Owner-Settable (Post-Launch)

| Parameter | Notes |
|-----------|-------|
| `recipient` | Cannot be zero address. |
| `treasury` | Cannot be zero address. |
| `team` | Can be zero (disables team fees, redirects to treasury). |
| `uri` | Metadata URI. |

---

## Parameter Recommendations

### Initial Liquidity (`usdcAmount` and `unitAmount`)

The ratio of `usdcAmount` to `unitAmount` determines the initial price of the Unit token. Consider:

- **Higher `usdcAmount`**: Creates a deeper liquidity pool with less slippage on trades. Requires more upfront capital.
- **Lower `unitAmount` relative to `usdcAmount`**: Sets a higher initial token price. Fewer tokens in circulation at launch.
- **Higher `unitAmount` relative to `usdcAmount`**: Sets a lower initial token price. More tokens available for early trading.

### Fundraiser: Initial Emission and Halving

- **Higher `initialEmission`**: More tokens distributed per day. Donors receive larger rewards early on.
- **Lower `halvingPeriod`** (7-14 days): Emission drops quickly, creating urgency to donate early.
- **Higher `halvingPeriod`** (90-365 days): Stable emission rate for months, encouraging sustained participation.
- **`minEmission`** should be set to a non-trivial amount to ensure the fundraiser remains attractive even after many halvings.

### Auction Parameters

| Parameter | Guidance |
|-----------|----------|
| `auctionInitPrice` | Set to a reasonable starting price for the first auction. If too high, the first epoch may expire before anyone buys. |
| `auctionEpochPeriod` | Shorter periods (1-6 hours) create urgency. Longer periods (1-7 days) allow more accumulation between auctions. |
| `auctionPriceMultiplier` | Lower multipliers (1.1x-1.5x) keep auction prices stable. Higher multipliers (2x-3x) create more price volatility between auctions. |
| `auctionMinInitPrice` | Prevents free claims during active periods. Set to the minimum LP token amount you consider a meaningful purchase. |
