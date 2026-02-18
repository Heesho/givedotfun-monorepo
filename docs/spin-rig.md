# SpinRig

## Overview

SpinRig is a slot machine-style token distribution mechanism within the Farplace protocol. Users pay a Dutch auction price to "spin" for a chance to win Unit tokens from a continuously growing prize pool. On each spin, Pyth Entropy VRF selects a random payout percentage from a preconfigured odds array, and the spinner receives that percentage of the current pool balance.

Unlike MineRig, where fees partially flow to other users, 100% of the spin price goes to protocol fees. The spinner's return comes entirely from the VRF-determined payout drawn from the prize pool. The pool grows over time through time-based token emissions that are minted into the contract on every spin, meaning the pool accumulates whether or not anyone is actively spinning.

---

## How It Works

### Spinning

To spin, call the `spin()` function:

```solidity
function spin(
    address spinner,
    uint256 _epochId,
    uint256 deadline,
    uint256 maxPrice,
    string calldata _uri
) external payable returns (uint256 price);
```

**Parameters:**

| Parameter   | Description                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `spinner`   | Address that will receive any winnings. Cannot be the zero address.                             |
| `_epochId`  | The expected current epoch ID. Provides frontrun protection -- reverts if epoch has changed.    |
| `deadline`  | Unix timestamp after which the transaction reverts. Provides deadline protection.               |
| `maxPrice`  | Maximum quote token amount the caller is willing to pay. Provides slippage protection.          |
| `_uri`      | Metadata URI associated with this spin (e.g., for display purposes).                            |

**What happens on each spin:**

1. The current Dutch auction price is calculated. If the epoch has expired (time elapsed > `epochPeriod`), the price is zero.
2. The caller pays the current price in the quote token (e.g., USDC). The price is split into fees and distributed immediately.
3. Pending emissions since the last spin are minted into the prize pool (held by the SpinRig contract).
4. The Dutch auction resets for the next epoch: `initPrice = max(lastPrice * priceMultiplier / 1e18, minInitPrice)`, capped at `type(uint192).max`.
5. The epoch ID increments and `spinStartTime` resets to the current block timestamp.
6. If entropy is enabled, a VRF request is sent to Pyth Entropy. The callback later determines the payout and transfers winnings. If entropy is disabled, `odds[0]` is used immediately and winnings are transferred in the same transaction.

### Dutch Auction Pricing

SpinRig uses the same linear decay pricing model as MineRig:

- Each epoch begins with a starting price (`initPrice`).
- The price decays linearly from `initPrice` to zero over the `epochPeriod`.
- When a spin occurs, the next epoch's `initPrice` is set to `lastPrice * priceMultiplier / 1e18`.
- The new `initPrice` is clamped between `minInitPrice` and `type(uint192).max`.
- If the epoch expires without a spin (time elapsed > `epochPeriod`), the next spinner pays nothing (price = 0).

**Price formula at time `t` within an epoch:**

```
price = initPrice - (initPrice * timePassed / epochPeriod)
```

Where `timePassed = block.timestamp - spinStartTime`. If `timePassed > epochPeriod`, the price is 0.

### Prize Pool

The prize pool is the balance of Unit tokens held by the SpinRig contract. It grows through two mechanisms:

1. **Emissions**: On every spin, the contract mints `timeElapsed * currentUps` Unit tokens to itself, where `timeElapsed` is the time since the last emission mint.
2. **Accumulation between spins**: Because emissions are time-based, the prize pool grows continuously even when no one is spinning. The longer the gap between spins, the larger the emission mint on the next spin.

The pool never fully drains because each payout is a percentage of the current balance (maximum 80%), not a fixed amount.

### VRF Payout

When entropy is enabled, Pyth Entropy VRF determines the payout:

1. A random `bytes32` value is returned by the VRF callback.
2. The random value is used to select an index from the `odds[]` array: `index = uint256(randomNumber) % odds.length`.
3. The selected odds value (in basis points) determines the payout percentage.
4. The spinner receives `pool * oddsBps / 10000` Unit tokens.

**Example:** If `odds = [100, 500, 1000, 5000]`, each spin has an equal 25% chance of one of:

| Odds Value | Percentage of Pool | Probability |
| ---------- | ------------------ | ----------- |
| 100        | 1%                 | 25%         |
| 500        | 5%                 | 25%         |
| 1000       | 10%                | 25%         |
| 5000       | 50%                | 25%         |

Each entry in the odds array has equal probability of being selected. To weight certain outcomes, include them multiple times in the array.

### Non-VRF Fallback

When entropy is disabled (`entropyEnabled = false`):

- The first entry in the odds array (`odds[0]`) is always used as the payout percentage.
- Winnings are calculated and transferred to the spinner in the same transaction (no callback needed).
- No ETH is required for VRF fees. If any ETH is sent with the transaction, it reverts with `SpinRig__NoEntropyRequired`.

This mode is useful for testing or for rigs that prefer deterministic behavior.

---

## Emission Schedule

SpinRig uses a **time-based** halving schedule, unlike MineRig which halves based on total supply minted.

- The emission rate starts at `initialUps` (units per second) at deployment.
- Every `halvingPeriod` seconds of wall-clock time since `startTime`, the UPS halves.
- The UPS is floored at `tailUps` and never drops below this value.

**UPS formula:**

```
halvings = (currentTime - startTime) / halvingPeriod
ups = initialUps >> halvings
if ups < tailUps:
    ups = tailUps
```

**Emission mint on each spin:**

```
emissionAmount = (block.timestamp - lastEmissionTime) * currentUps
```

The `lastEmissionTime` is updated to `block.timestamp` after each mint. Emissions are minted to the SpinRig contract itself, adding to the prize pool.

**Example schedule** with `initialUps = 1000`, `tailUps = 10`, `halvingPeriod = 30 days`:

| Period       | UPS  |
| ------------ | ---- |
| Days 0-29    | 1000 |
| Days 30-59   | 500  |
| Days 60-89   | 250  |
| Days 90-119  | 125  |
| Days 120-149 | 62   |
| Days 150-179 | 31   |
| Days 180-209 | 15   |
| Days 210+    | 10 (tail floor) |

---

## Fee Distribution

100% of the spin price goes to fees. Unlike MineRig, no portion of the payment goes to another user. The spinner's value comes from the prize pool payout, not from fee redistribution.

**Fee breakdown:**

| Recipient  | Percentage | Basis Points | Notes                                                           |
| ---------- | ---------- | ------------ | --------------------------------------------------------------- |
| Treasury   | 95%        | Remainder    | Receives `price - teamFee - protocolFee`. Absorbs rounding dust.|
| Team       | 4%         | 400          | Set to 0% if `team` is the zero address; portion goes to treasury. |
| Protocol   | 1%         | 100          | Set to 0% if protocol fee address is zero; portion goes to treasury. |

**Fee calculation logic:**

```solidity
uint256 teamFee = team != address(0) ? price * 400 / 10000 : 0;
uint256 protocolFee = protocol != address(0) ? price * 100 / 10000 : 0;
uint256 treasuryFee = price - teamFee - protocolFee;
```

Treasury always receives the remainder after team and protocol fees, so it absorbs any rounding dust from integer division. When team or protocol addresses are zero, their respective fees are not calculated at all, meaning the full amount flows to treasury.

If the spin price is zero (expired epoch), no fees are collected.

---

## Entropy (VRF)

SpinRig uses [Pyth Entropy](https://docs.pyth.network/entropy) for verifiable random number generation to determine spin outcomes.

### When Entropy is Enabled

1. The caller must send ETH with the `spin()` call to cover the VRF fee (`msg.value >= getEntropyFee()`).
2. The spin transaction records the spinner address and epoch, then submits a VRF request to Pyth Entropy.
3. The `SpinRig__EntropyRequested` event is emitted with the epoch ID and sequence number.
4. Pyth Entropy calls back `entropyCallback()` with the random result (typically in a subsequent block).
5. The callback selects a random index from the `odds[]` array and transfers the corresponding payout to the spinner.
6. The `SpinRig__Win` event is emitted with the outcome.

**Important:** When entropy is enabled, winnings are not delivered in the same transaction as the spin. There is a delay between spinning and receiving the payout.

### When Entropy is Disabled

1. No ETH is required. If ETH is sent, the transaction reverts.
2. The payout is determined immediately using `odds[0]` (the first entry in the odds array).
3. Winnings are transferred to the spinner in the same transaction.
4. The `SpinRig__Win` event is emitted immediately.

### Owner Control

The rig owner can toggle entropy on or off at any time using `setEntropyEnabled(bool)`. This allows the owner to:

- Disable VRF to reduce gas costs and simplify the user experience.
- Re-enable VRF to restore random outcomes.

Note: Pending VRF callbacks from before disabling entropy will still be processed when the callback arrives.

---

## Launch Parameters

All launch parameters are immutable after deployment. They are set in the constructor via the `Config` struct.

| Parameter         | Type        | Description                                              | Valid Range                                 |
| ----------------- | ----------- | -------------------------------------------------------- | ------------------------------------------- |
| `unit`            | `address`   | Unit token (ERC20) address created for this rig.         | Non-zero address                            |
| `quote`           | `address`   | Payment token address (e.g., USDC).                      | Non-zero address                            |
| `core`            | `address`   | SpinCore contract address.                               | Non-zero address                            |
| `entropy`         | `address`   | Pyth Entropy contract address for VRF.                   | Non-zero address                            |
| `treasury`        | `address`   | Initial treasury address for fee collection.             | Non-zero address                            |
| `team`            | `address`   | Initial team address for fee collection.                 | Any address (zero disables team fees)       |
| `epochPeriod`     | `uint256`   | Duration of each Dutch auction epoch in seconds.         | 10 minutes -- 365 days                      |
| `priceMultiplier` | `uint256`   | Multiplier applied to spin price for next epoch (18 decimals). | 1.1e18 -- 3e18                        |
| `minInitPrice`    | `uint256`   | Floor for the epoch starting price.                      | 1e6 -- type(uint192).max                    |
| `initialUps`      | `uint256`   | Starting units per second emission rate.                 | 1 -- 1e24                                   |
| `tailUps`         | `uint256`   | Minimum UPS floor after halvings.                        | 1 -- initialUps                             |
| `halvingPeriod`   | `uint256`   | Wall-clock time between UPS halvings in seconds.         | 7 days -- 365 days                          |
| `odds`            | `uint256[]` | Array of payout percentages in basis points.             | Each entry: 10 (0.1%) -- 8000 (80%). Array must be non-empty. |

### Constants

| Constant               | Value              | Description                               |
| ---------------------- | ------------------ | ----------------------------------------- |
| `TEAM_BPS`             | 400                | Team fee in basis points (4%).            |
| `PROTOCOL_BPS`         | 100                | Protocol fee in basis points (1%).        |
| `DIVISOR`              | 10,000             | Basis points divisor.                     |
| `PRECISION`            | 1e18               | Fixed-point precision for multiplier.     |
| `MIN_EPOCH_PERIOD`     | 10 minutes         | Minimum allowed epoch period.             |
| `MAX_EPOCH_PERIOD`     | 365 days           | Maximum allowed epoch period.             |
| `MIN_PRICE_MULTIPLIER` | 1.1e18             | Minimum price multiplier (1.1x).          |
| `MAX_PRICE_MULTIPLIER` | 3e18               | Maximum price multiplier (3x).            |
| `ABS_MIN_INIT_PRICE`   | 1e6                | Absolute minimum starting price.          |
| `ABS_MAX_INIT_PRICE`   | type(uint192).max  | Absolute maximum starting price.          |
| `MAX_INITIAL_UPS`      | 1e24               | Maximum initial units per second.         |
| `MIN_HALVING_PERIOD`   | 7 days             | Minimum halving period.                   |
| `MAX_HALVING_PERIOD`   | 365 days           | Maximum halving period.                   |
| `MIN_ODDS_BPS`         | 10                 | Minimum odds entry (0.1% payout).         |
| `MAX_ODDS_BPS`         | 8000               | Maximum odds entry (80% payout).          |

---

## Owner Controls

The rig owner (set via OpenZeppelin `Ownable`) can modify the following parameters after deployment:

### Mutable Parameters

| Function              | Parameter         | Constraints                                                        |
| --------------------- | ----------------- | ------------------------------------------------------------------ |
| `setTreasury(address)`| `treasury`        | Cannot be the zero address.                                        |
| `setTeam(address)`    | `team`            | Can be the zero address (disables team fees, redirects to treasury).|
| `setEntropyEnabled(bool)` | `entropyEnabled` | Toggles VRF on or off for spin outcomes.                       |
| `setUri(string)`      | `uri`             | Sets the metadata URI for the rig (e.g., logo, branding).         |
| `transferOwnership(address)` | `owner`    | Inherited from OpenZeppelin Ownable. Transfers rig ownership.      |

### Immutable (Cannot Be Changed)

The following cannot be modified after deployment:

- `unit`, `quote`, `core`, `entropy` -- contract addresses
- `epochPeriod`, `priceMultiplier`, `minInitPrice` -- Dutch auction parameters
- `initialUps`, `tailUps`, `halvingPeriod` -- emission schedule
- `odds[]` -- payout percentages
- `startTime` -- deployment timestamp

---

## View Functions

### `getPrice()`

```solidity
function getPrice() public view returns (uint256)
```

Returns the current Dutch auction spin price. The price decays linearly from `initPrice` to 0 over `epochPeriod`. Returns 0 if the epoch has expired.

### `getUps()`

```solidity
function getUps() external view returns (uint256)
```

Returns the current units per second emission rate, accounting for halvings. Reflects the rate at `block.timestamp`.

### `getPrizePool()`

```solidity
function getPrizePool() external view returns (uint256)
```

Returns the current Unit token balance held by the SpinRig contract. This is the prize pool from which spin winnings are paid. Note: this does not include pending emissions that have not yet been minted.

### `getPendingEmissions()`

```solidity
function getPendingEmissions() external view returns (uint256)
```

Returns the amount of Unit tokens that would be minted to the prize pool on the next spin. Calculated as `(block.timestamp - lastEmissionTime) * currentUps`. This amount is not yet in the prize pool but will be added when the next spin occurs.

### `getEntropyFee()`

```solidity
function getEntropyFee() external view returns (uint256)
```

Returns the current VRF fee in wei required to submit a spin when entropy is enabled. This is the minimum `msg.value` that must be sent with the `spin()` call. Delegates to `IEntropyV2(entropy).getFeeV2()`.

### `getOdds()`

```solidity
function getOdds() external view returns (uint256[] memory)
```

Returns the full odds array. Each value is in basis points (10000 = 100%). These are the possible payout percentages that can be drawn on each spin.

### `getOddsLength()`

```solidity
function getOddsLength() external view returns (uint256)
```

Returns the number of entries in the odds array. Each entry has an equal probability of being selected by VRF.

---

## Events

### `SpinRig__Spin`

```solidity
event SpinRig__Spin(
    address sender,
    address indexed spinner,
    uint256 indexed epochId,
    uint256 price,
    string uri
);
```

Emitted on every spin. Records who initiated the transaction (`sender`), who will receive winnings (`spinner`), the epoch in which the spin occurred, the price paid, and any metadata URI.

### `SpinRig__Win`

```solidity
event SpinRig__Win(
    address indexed spinner,
    uint256 indexed epochId,
    uint256 oddsBps,
    uint256 amount
);
```

Emitted when winnings are determined and transferred. When entropy is enabled, this fires in the VRF callback (a separate transaction from the spin). When entropy is disabled, this fires in the same transaction as the spin. `oddsBps` is the selected payout percentage in basis points, and `amount` is the actual number of Unit tokens transferred.

### `SpinRig__EntropyRequested`

```solidity
event SpinRig__EntropyRequested(uint256 indexed epochId, uint64 indexed sequenceNumber);
```

Emitted when a VRF request is submitted to Pyth Entropy. The `sequenceNumber` can be used to track the pending callback. Only fires when entropy is enabled.

### `SpinRig__TreasuryFee`

```solidity
event SpinRig__TreasuryFee(address indexed treasury, uint256 indexed epochId, uint256 amount);
```

Emitted when the treasury fee is transferred from the spin price.

### `SpinRig__TeamFee`

```solidity
event SpinRig__TeamFee(address indexed team, uint256 indexed epochId, uint256 amount);
```

Emitted when the team fee is transferred. Not emitted if the team address is zero.

### `SpinRig__ProtocolFee`

```solidity
event SpinRig__ProtocolFee(address indexed protocol, uint256 indexed epochId, uint256 amount);
```

Emitted when the protocol fee is transferred. Not emitted if the protocol fee address is zero.

### `SpinRig__EmissionMinted`

```solidity
event SpinRig__EmissionMinted(uint256 indexed epochId, uint256 amount);
```

Emitted when pending emissions are minted to the prize pool during a spin. The `amount` is the number of Unit tokens minted. Not emitted if zero time has elapsed since the last emission mint.

### `SpinRig__TreasurySet`

```solidity
event SpinRig__TreasurySet(address indexed treasury);
```

Emitted when the owner updates the treasury address.

### `SpinRig__TeamSet`

```solidity
event SpinRig__TeamSet(address indexed team);
```

Emitted when the owner updates the team address.

### `SpinRig__UriSet`

```solidity
event SpinRig__UriSet(string uri);
```

Emitted when the owner updates the metadata URI.

### `SpinRig__EntropyEnabledSet`

```solidity
event SpinRig__EntropyEnabledSet(bool enabled);
```

Emitted when the owner toggles entropy (VRF) on or off.
