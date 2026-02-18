# Auction

## Overview

Every rig launch on Farplace creates an **Auction** contract alongside the rig and its Unit token. The Auction serves as the rig's treasury marketplace -- it accumulates quote tokens (USDC) from the rig's fee splits and allows anyone to purchase those accumulated tokens via a repeating Dutch auction.

The Auction contract is forked and modified from [Euler Fee Flow](https://github.com/euler-xyz/fee-flow). It provides a permissionless, automated mechanism for converting treasury assets into LP token burns, creating sustained deflationary pressure on the liquidity pool.

---

## How It Works

### Dutch Auction Pricing

The Auction uses a linear Dutch auction that repeats in epochs:

1. **Price starts high.** At the beginning of each epoch, the price is set to `initPrice`.
2. **Price decays linearly.** Over the course of `epochPeriod`, the price falls from `initPrice` to 0.
3. **Buyer executes `buy()`.** At any point during the epoch, a buyer can purchase all accumulated asset balances at the current price.
4. **Price resets.** After a purchase, the next epoch begins with a new `initPrice` calculated as:

```
newInitPrice = paymentAmount * priceMultiplier / 1e18
```

The new `initPrice` is clamped between `minInitPrice` and `ABS_MAX_INIT_PRICE` (`type(uint192).max`).

### Purchase Flow

When a buyer calls `buy()`, the following occurs:

1. **Validation** -- The contract checks the deadline, epoch ID (front-run protection), and maximum payment amount (slippage protection).
2. **Payment** -- The buyer pays the current Dutch auction price in **LP tokens** (the Uniswap V2 pair token for the Unit/USDC pool). LP tokens are transferred to the `paymentReceiver`, which is the burn address (`0x000...dead`).
3. **Asset Transfer** -- All accumulated balances of the specified asset tokens are transferred to the buyer's designated receiver address.
4. **Epoch Reset** -- The epoch counter increments, the new `initPrice` is calculated, and the auction clock restarts.

### Price Calculation

The current price at any point in time is:

```
price = initPrice - (initPrice * timePassed / epochPeriod)
```

If `timePassed > epochPeriod`, the price is 0.

---

## Key Properties

### Payment in LP Tokens

Unlike the rigs themselves (which accept USDC), the Auction requires payment in **LP tokens**. To participate, a buyer must first acquire LP tokens by providing liquidity to the Unit/USDC Uniswap V2 pool.

### Deflationary LP Burns

All LP tokens paid to the Auction are sent to the dead address (`0x000...dEaD`). This permanently removes those LP tokens from circulation. As the LP supply decreases, each remaining LP token represents a larger share of the underlying pool reserves, effectively increasing the price floor per LP token.

### Continuous Asset Accumulation

Assets accumulate in the Auction contract from rig fee splits:

| Rig Type | Treasury Fee (to Auction) |
|----------|--------------------------|
| MineRig  | 15% of slot purchase price |
| SpinRig  | 95% of spin price |
| FundRig  | 45% of donation amount |

The Auction can hold multiple asset types simultaneously. When a buyer calls `buy()`, they specify which asset token addresses to claim, and the contract transfers the full balance of each.

### Free Claims at Epoch Expiry

If an epoch expires without a purchase (price reaches 0), the next buyer can claim all accumulated assets for free. This is by design -- it incentivizes timely purchases and ensures assets do not become permanently locked.

---

## Constructor Parameters

| Parameter | Type | Description | Valid Range |
|-----------|------|-------------|-------------|
| `paymentToken` | `address` | LP token address used for payment | Non-zero address |
| `paymentReceiver` | `address` | Address to receive LP payments (burn address) | Non-zero address |
| `initPrice` | `uint256` | Starting price for the first epoch | `minInitPrice` to `type(uint192).max` |
| `epochPeriod` | `uint256` | Duration of each auction epoch | 1 hour to 365 days |
| `priceMultiplier` | `uint256` | Multiplier for calculating next epoch's starting price (18 decimals) | 1.1x (`1.1e18`) to 3x (`3e18`) |
| `minInitPrice` | `uint256` | Minimum allowed starting price per epoch | `1e6` to `type(uint192).max` |

---

## External Functions

### `buy()`

```solidity
function buy(
    address[] calldata assets,
    address assetsReceiver,
    uint256 _epochId,
    uint256 deadline,
    uint256 maxPaymentTokenAmount
) external nonReentrant returns (uint256 paymentAmount)
```

Purchase all accumulated balances of the specified asset tokens.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `assets` | Array of ERC20 token addresses to claim from the Auction |
| `assetsReceiver` | Address to receive the claimed asset tokens |
| `_epochId` | Expected epoch ID; reverts if mismatched (front-run protection) |
| `deadline` | Transaction deadline timestamp; reverts if passed |
| `maxPaymentTokenAmount` | Maximum LP tokens the buyer is willing to pay (slippage protection) |

**Returns:** `paymentAmount` -- the actual amount of LP tokens paid.

**Reverts:**

| Error | Condition |
|-------|-----------|
| `Auction__DeadlinePassed` | `block.timestamp > deadline` |
| `Auction__EmptyAssets` | `assets` array is empty |
| `Auction__EpochIdMismatch` | `_epochId` does not match current `epochId` |
| `Auction__MaxPaymentAmountExceeded` | Current price exceeds `maxPaymentTokenAmount` |

---

## View Functions

### `getPrice()`

```solidity
function getPrice() public view returns (uint256)
```

Returns the current Dutch auction price. The price decays linearly from `initPrice` to 0 over `epochPeriod`. Returns 0 if the current epoch has expired.

---

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `epochId` | `uint256` | Current epoch counter (increments on each purchase) |
| `initPrice` | `uint256` | Starting price for the current epoch |
| `startTime` | `uint256` | Timestamp when the current epoch began |

---

## Events

### `Auction__Buy`

```solidity
event Auction__Buy(
    address indexed buyer,
    address indexed assetsReceiver,
    uint256 paymentAmount
);
```

Emitted on every successful purchase. Logs the buyer address, the receiver of the assets, and the LP token amount paid.

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_EPOCH_PERIOD` | 1 hour | Minimum auction epoch duration |
| `MAX_EPOCH_PERIOD` | 365 days | Maximum auction epoch duration |
| `MIN_PRICE_MULTIPLIER` | `1.1e18` | Minimum price multiplier (1.1x) |
| `MAX_PRICE_MULTIPLIER` | `3e18` | Maximum price multiplier (3x) |
| `ABS_MIN_INIT_PRICE` | `1e6` | Absolute minimum initial price |
| `ABS_MAX_INIT_PRICE` | `type(uint192).max` | Absolute maximum initial price |
| `PRECISION` | `1e18` | Fixed-point precision for multiplier math |
