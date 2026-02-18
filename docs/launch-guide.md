# Launch Parameters Guide

## Overview

Launching a token on Farplace creates three contracts:

1. **Unit** -- An ERC20 token with permit and voting capabilities.
2. **Rig** -- The distribution mechanism (MineRig, SpinRig, or FundRig).
3. **Auction** -- A Dutch auction for selling treasury-accumulated assets in exchange for LP token burns.

To launch, you choose a rig type, configure its parameters, and provide USDC for initial liquidity. The USDC is paired with newly minted Unit tokens to create a Uniswap V2 liquidity pool. The resulting LP tokens are burned to the dead address, permanently locking the liquidity.

All launch parameters are **immutable** -- they cannot be changed after deployment. Choose carefully.

---

## Common Parameters (All Rig Types)

These parameters are shared across MineRig, SpinRig, and FundRig launches.

### Token and Liquidity

| Parameter | Type | Description |
|-----------|------|-------------|
| `quoteToken` | `address` | ERC20 token used for payments (typically USDC). Must be a standard ERC20 with no fee-on-transfer or rebasing. |
| `tokenName` | `string` | Name of the Unit token (e.g., "My Token"). |
| `tokenSymbol` | `string` | Symbol of the Unit token (e.g., "MYT"). |
| `usdcAmount` | `uint256` | Amount of USDC to provide for initial liquidity. Determines the starting price of the Unit token. |
| `unitAmount` | `uint256` | Amount of Unit tokens to mint for initial liquidity. Together with `usdcAmount`, determines the initial Unit/USDC price ratio. |
| `uri` | `string` | Metadata URI for the rig (e.g., logo, description). Can be updated by the owner after launch. |

### Auction Parameters

Every rig launch includes an Auction contract. These parameters configure the treasury Dutch auction.

| Parameter | Type | Description | Valid Range |
|-----------|------|-------------|-------------|
| `auctionInitPrice` | `uint256` | Starting price for the first auction epoch (in LP tokens). | `auctionMinInitPrice` to `type(uint192).max` |
| `auctionEpochPeriod` | `uint256` | Duration of each auction epoch. | 1 hour to 365 days |
| `auctionPriceMultiplier` | `uint256` | Multiplier applied to the last purchase price to set the next epoch's starting price (18 decimals). | `1.1e18` (1.1x) to `3e18` (3x) |
| `auctionMinInitPrice` | `uint256` | Minimum starting price per auction epoch. Prevents the auction from resetting to trivially low prices. | `1e6` to `type(uint192).max` |

---

## MineRig Parameters

MineRig distributes tokens through competitive slot mining. Users pay Dutch auction prices to claim mining slots, earn token emissions while holding a slot, and receive 80% of the next miner's payment when displaced.

### Configuration

| Parameter | Type | Description | Valid Range |
|-----------|------|-------------|-------------|
| `initialUps` | `uint256` | Starting units per second (UPS) emission rate. This is the total UPS across all slots; each slot receives `initialUps / capacity`. | 1 to `1e24` |
| `tailUps` | `uint256` | Minimum UPS floor. After enough halvings, UPS will never drop below this value. | 1 to `initialUps` |
| `halvingAmount` | `uint256` | Total minted token threshold for the first halving. UPS halves when `totalMinted` reaches this amount. Subsequent halvings occur at `halvingAmount * 1.5`, `halvingAmount * 1.75`, etc. (geometric series approaching `2 * halvingAmount`). | `1000e18` to `1e27` |
| `epochPeriod` | `uint256` | Duration of each Dutch auction epoch per slot. The slot price decays linearly from `initPrice` to 0 over this period. | 10 minutes to 365 days |
| `priceMultiplier` | `uint256` | When a slot is mined, the next epoch's starting price is set to `lastPrice * priceMultiplier / 1e18`. Higher values mean steeper price escalation. | `1.1e18` (1.1x) to `3e18` (3x) |
| `minInitPrice` | `uint256` | Minimum starting price per epoch. Even if the computed price would be lower, it resets to at least this value. For USDC with 6 decimals, `1e6` equals $1.00. | `1e6` to `type(uint192).max` |
| `upsMultipliers` | `uint256[]` | Array of possible UPS multiplier values (18 decimals). When Pyth Entropy is enabled, a random entry is drawn on each mine action. `1e18` = 1x, `5e18` = 5x, `10e18` = 10x. | Each value: `1e18` (1x) to `10e18` (10x). Array must have at least 1 entry. |
| `upsMultiplierDuration` | `uint256` | How long a VRF-assigned UPS multiplier lasts before resetting to 1x. A new multiplier is drawn on the next mine action after expiry. | 1 hour to 7 days |

### Fee Split

| Recipient | Percentage |
|-----------|-----------|
| Previous miner | 80% |
| Treasury | 15% |
| Team | 4% |
| Protocol | 1% |

### Owner-Settable (Post-Launch)

| Parameter | Notes |
|-----------|-------|
| `treasury` | Cannot be zero address. |
| `team` | Can be zero (disables team fees, redirects to treasury). |
| `capacity` | Can only increase (max 256). Dilutes UPS across more slots. |
| `entropyEnabled` | Toggle VRF randomness on/off. |
| `uri` | Metadata URI. |

---

## SpinRig Parameters

SpinRig distributes tokens through a slot machine mechanic. Users pay a Dutch auction price to spin, and Pyth Entropy VRF determines what percentage of the prize pool they win. Emissions accumulate in the prize pool continuously, whether or not anyone is spinning.

### Configuration

| Parameter | Type | Description | Valid Range |
|-----------|------|-------------|-------------|
| `initialUps` | `uint256` | Starting units per second (UPS) emission rate into the prize pool. | 1 to `1e24` |
| `tailUps` | `uint256` | Minimum UPS floor after halvings. | 1 to `initialUps` |
| `halvingPeriod` | `uint256` | Wall-clock time between halvings. Unlike MineRig (supply-based), SpinRig halvings are time-based. UPS halves every `halvingPeriod` since deployment. | 7 days to 365 days |
| `epochPeriod` | `uint256` | Duration of each Dutch auction epoch for the spin price. | 10 minutes to 365 days |
| `priceMultiplier` | `uint256` | Multiplier applied to the last spin price to set the next epoch's starting price (18 decimals). | `1.1e18` (1.1x) to `3e18` (3x) |
| `minInitPrice` | `uint256` | Minimum starting price per epoch. | `1e6` to `type(uint192).max` |
| `odds` | `uint256[]` | Array of payout percentages in basis points. On each spin, one entry is drawn uniformly at random. For example, `[100, 500, 1000, 5000]` means equal probability of winning 1%, 5%, 10%, or 50% of the pool. | Each value: 10 (0.1%) to 8000 (80%). Array must have at least 1 entry. |

### Fee Split

| Recipient | Percentage |
|-----------|-----------|
| Treasury | 95% |
| Team | 4% |
| Protocol | 1% |

### Owner-Settable (Post-Launch)

| Parameter | Notes |
|-----------|-------|
| `treasury` | Cannot be zero address. |
| `team` | Can be zero (disables team fees, redirects to treasury). |
| `entropyEnabled` | Toggle VRF randomness on/off. When off, uses `odds[0]` deterministically. |
| `uri` | Metadata URI. |

---

## FundRig Parameters

FundRig distributes tokens through donations. Users donate USDC into a daily pool, and after the day ends, each donor can claim their proportional share of that day's Unit token emission. Donations are split immediately: 50% to the recipient, 45% to treasury, 4% to team, 1% to protocol.

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

### Epoch Period

| Duration | Effect |
|----------|--------|
| **Shorter** (10 min - 1 hour) | More frequent price resets. Higher activity. Prices decay quickly, encouraging rapid engagement. Best for highly active communities. |
| **Moderate** (1 hour - 1 day) | Balanced pace. Allows time for price discovery without excessive urgency. |
| **Longer** (1 day - 1 week+) | Slow, deliberate price decay. Lower activity cadence. Better for passive participation. |

### Price Multiplier

| Value | Effect |
|-------|--------|
| **Low** (1.1x - 1.3x) | Gradual price escalation. Prices stay accessible. Lower volatility between epochs. |
| **Moderate** (1.5x - 2x) | Noticeable price jumps on each action. Creates meaningful cost differences between early and late participants within an epoch. |
| **High** (2.5x - 3x) | Aggressive price escalation. Prices spike sharply after each action and take longer to decay. Creates strong incentives to wait for lower prices. |

### Minimum Init Price

Sets the floor for epoch starting prices. After quiet periods where prices decay to near-zero, this prevents the next epoch from starting at a trivially low price.

- For USDC (6 decimals): `1e6` = $1.00, `5e6` = $5.00, `1e5` = $0.10.
- Set this to the minimum price you consider meaningful for participation.

### MineRig: Halving Amount

Controls how quickly emissions decrease based on minted supply.

| Value | Effect |
|-------|--------|
| **Lower** (1,000 - 10,000 tokens) | Rapid halvings. Early miners get significantly more tokens. Strong first-mover advantage. |
| **Higher** (100,000 - 1,000,000 tokens) | Slow halvings. Emissions stay high for longer. More gradual transition to tail emissions. |

The total supply asymptotically approaches `2 * halvingAmount` before hitting the `tailUps` floor, at which point emissions continue indefinitely at the tail rate.

### MineRig: UPS Multipliers

The `upsMultipliers` array defines the possible random bonus multipliers. Consider:

- **All 1x** (`[1e18]`): No randomness. Every slot earns the base rate. Predictable.
- **Mixed low** (`[1e18, 2e18, 3e18]`): Mild randomness. Slight advantage for lucky draws.
- **Wide spread** (`[1e18, 1e18, 1e18, 5e18, 10e18]`): High variance. Most miners get 1x, but occasional 5x or 10x jackpots. The array is sampled uniformly, so repeating values adjusts probability (3/5 chance of 1x in this example).

### SpinRig: Odds Array

The `odds` array defines possible payout percentages from the prize pool (in basis points). Each entry has equal probability of being drawn.

| Design | Example | Effect |
|--------|---------|--------|
| **Conservative** | `[100, 200, 500]` | Small consistent payouts (1%, 2%, 5%). Prize pool drains slowly. |
| **Balanced** | `[100, 500, 1000, 2500]` | Mix of small and medium payouts. Steady pool dynamics. |
| **High variance** | `[10, 10, 10, 5000]` | Mostly tiny payouts (0.1%) with rare 50% jackpots. Pool grows between big wins. |
| **Weighted** | `[100, 100, 100, 100, 5000]` | 4/5 chance of 1%, 1/5 chance of 50%. Repeat entries to adjust probability. |

Note: The maximum per-spin payout is 80% (`8000` bps), ensuring the pool never fully drains in a single spin.

### SpinRig: Halving Period

Controls how quickly emissions decrease over time.

| Duration | Effect |
|----------|--------|
| **7 days** | Aggressive decay. Emissions halve weekly. Early spinners benefit dramatically. |
| **30 days** | Monthly halvings. Balanced lifespan. |
| **90-365 days** | Slow decay. Prize pool accumulates emissions for months before rates drop significantly. |

### FundRig: Initial Emission and Halving

- **Higher `initialEmission`**: More tokens distributed per day. Donors receive larger rewards early on.
- **Lower `halvingPeriod`** (7-14 days): Emission drops quickly, creating urgency to donate early.
- **Higher `halvingPeriod`** (90-365 days): Stable emission rate for months, encouraging sustained participation.
- **`minEmission`** should be set to a non-trivial amount to ensure the rig remains attractive even after many halvings.

### Auction Parameters

| Parameter | Guidance |
|-----------|----------|
| `auctionInitPrice` | Set to a reasonable starting price for the first auction. If too high, the first epoch may expire before anyone buys. |
| `auctionEpochPeriod` | Shorter periods (1-6 hours) create urgency. Longer periods (1-7 days) allow more accumulation between auctions. |
| `auctionPriceMultiplier` | Lower multipliers (1.1x-1.5x) keep auction prices stable. Higher multipliers (2x-3x) create more price volatility between auctions. |
| `auctionMinInitPrice` | Prevents free claims during active periods. Set to the minimum LP token amount you consider a meaningful purchase. |
