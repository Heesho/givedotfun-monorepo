# MineRig

## 1. Overview

MineRig is a competitive slot-mining mechanism for distributing Unit tokens on the Farplace platform. Users compete for "mining slots" by paying a Dutch auction price. While holding a slot, a miner earns Unit token emissions proportional to the time they occupy it. When another user takes a slot, the displaced miner receives 80% of the incoming payment as compensation.

Each MineRig starts with a single slot, but the owner can increase capacity up to 256 slots. The global emission rate -- measured in **Units Per Second (UPS)** -- is divided evenly across all active slots. This means adding more slots dilutes per-slot emissions but increases the total number of participants who can mine simultaneously.

MineRig contracts are deployed through **MineCore**, which handles token creation, initial liquidity provisioning, and rig registration with the central Registry.

---

## 2. How It Works

### Slots

A slot is a position within the rig that a miner can occupy to earn token emissions. Key properties of each slot:

| Field | Description |
|---|---|
| `epochId` | Current epoch counter for the slot (increments each time someone mines it) |
| `initPrice` | Starting price for the current epoch's Dutch auction |
| `startTime` | Timestamp when the current epoch began |
| `ups` | Units per second assigned to this slot |
| `upsMultiplier` | Active VRF-assigned multiplier (1e18 = 1x) |
| `lastUpsMultiplierTime` | Timestamp when the current multiplier was set |
| `miner` | Address of the current miner occupying the slot |
| `uri` | Metadata URI set by the current miner |

Slot 0 is initialized at deployment with the launcher as the first miner (`epochId = 1`). All other slots start uninitialized (`epochId = 0`, `miner = address(0)`) and become available when the owner increases capacity.

### Mining a Slot

To mine a slot, call the `mine()` function with the following parameters:

```solidity
function mine(
    address miner,      // Address to set as the slot miner (receives future emissions)
    uint256 index,      // Slot index to mine (0 to capacity - 1)
    uint256 epochId,    // Expected epoch ID (frontrun protection)
    uint256 deadline,   // Transaction deadline timestamp
    uint256 maxPrice,   // Maximum price willing to pay (slippage protection)
    string calldata _uri // Metadata URI for this mining action
) external payable returns (uint256 price);
```

When a user mines a slot:

1. The current Dutch auction price is calculated for the target slot.
2. The caller pays the price in the quote token (e.g., USDC).
3. Fees are distributed: 80% to the previous miner (as a claimable balance), 15% to treasury, 4% to team, 1% to protocol.
4. The previous miner's accumulated token emissions are minted and sent to them.
5. The slot's auction price resets to `lastPrice * priceMultiplier` for the next epoch.
6. The new miner begins earning emissions.
7. If entropy is enabled and the UPS multiplier has expired, a Pyth Entropy VRF request is made (requires ETH for the VRF fee sent as `msg.value`).

**Protections built into `mine()`:**

- **Frontrun protection**: The `epochId` parameter must match the slot's current epoch. If someone mines the slot before your transaction, the epoch increments and your transaction reverts instead of paying a higher price.
- **Slippage protection**: The `maxPrice` parameter sets a ceiling on how much you are willing to pay. If the price exceeds this amount, the transaction reverts.
- **Deadline protection**: The `deadline` parameter ensures the transaction reverts if it is not mined before a specified timestamp.

### Dutch Auction Pricing

Each slot runs an independent Dutch auction that determines the cost to mine it:

1. **Price decay**: The price starts at `initPrice` and decays **linearly** to 0 over the `epochPeriod`.

   ```
   price = initPrice - (initPrice * timePassed / epochPeriod)
   ```

2. **Price reset on mine**: When someone mines a slot, the next epoch's `initPrice` is set to:

   ```
   newInitPrice = lastPrice * priceMultiplier / 1e18
   ```

   This value is clamped between `minInitPrice` and `ABS_MAX_INIT_PRICE` (type(uint192).max).

3. **Free mining after epoch expiry**: If the full `epochPeriod` passes without anyone mining the slot, the price drops to 0. The next miner can take the slot for free, and the `initPrice` resets to `minInitPrice`.

**Example**: With `epochPeriod = 1 hour` and `priceMultiplier = 2e18` (2x):

- Alice mines slot 0 for 10 USDC.
- The new `initPrice` is set to 20 USDC (10 * 2).
- Over the next hour, the price decays from 20 USDC toward 0.
- If Bob mines 30 minutes in, he pays approximately 10 USDC, and the next `initPrice` resets to approximately 20 USDC.
- If nobody mines within the hour, the price reaches 0 and the next miner takes the slot for free at `minInitPrice`.

### Token Emissions

While holding a slot, a miner earns tokens at a rate of:

```
tokensPerSecond = slotUps * upsMultiplier / 1e18
```

Where `slotUps = globalUps / capacity`. Tokens are not streamed continuously; instead, the accumulated amount is calculated and minted to the displaced miner when the next person takes the slot:

```
minedAmount = (block.timestamp - slotStartTime) * slotUps * upsMultiplier / 1e18
```

The minted tokens are added to `totalMinted`, which drives the halving schedule.

### Halving Schedule

MineRig uses a Bitcoin-like halving mechanism based on total tokens minted (supply-based, not time-based). The global UPS halves each time a minting threshold is crossed.

**Threshold formula (geometric series):**

| Halving | Threshold | Formula |
|---|---|---|
| 1st | `halvingAmount` | `H` |
| 2nd | `halvingAmount * 1.5` | `H + H/2` |
| 3rd | `halvingAmount * 1.75` | `H + H/2 + H/4` |
| 4th | `halvingAmount * 1.875` | `H + H/2 + H/4 + H/8` |
| nth | approaching `2 * halvingAmount` | `H * (2 - 1/2^n)` |

**Example** with `halvingAmount = 1,000,000` and `initialUps = 100`:

| Total Minted | UPS | Halvings Applied |
|---|---|---|
| < 1,000,000 | 100 | 0 |
| < 1,500,000 | 50 | 1 |
| < 1,750,000 | 25 | 2 |
| < 1,875,000 | 12 | 3 |
| < 1,937,500 | 6 | 4 |
| ... | ... | ... |

UPS is floored at `tailUps` and will never drop below that value. The loop that counts halvings is capped at 64 iterations to prevent unbounded computation.

---

## 3. UPS Multipliers (VRF)

MineRig optionally integrates **Pyth Entropy VRF** to assign random UPS multipliers to individual slots. This feature adds a lottery-like element where some miners may earn significantly more than others during their tenure.

### How It Works

1. At deployment, the launcher provides a `upsMultipliers[]` array containing the set of possible multiplier values (e.g., `[1e18, 2e18, 5e18, 10e18]` for 1x, 2x, 5x, and 10x).
2. When a slot changes hands via `mine()` and the previous multiplier has expired (i.e., `upsMultiplierDuration` has elapsed since it was last set), the multiplier resets to 1x (the `DEFAULT_UPS_MULTIPLIER`).
3. If `entropyEnabled` is `true`, a Pyth Entropy VRF request is submitted. The caller must include the VRF fee as `msg.value` in ETH.
4. When the VRF callback fires, a random entry from `upsMultipliers[]` is selected using `randomNumber % arrayLength`, and the slot's `upsMultiplier` is updated.
5. The new multiplier lasts for `upsMultiplierDuration`, after which it resets to 1x on the next mine action.

### Multiplier Lifecycle

```
mine() called --> multiplier expired? --> reset to 1x --> entropy enabled? --> request VRF
                                                                                  |
                                                                          VRF callback fires
                                                                                  |
                                                                     random multiplier assigned
                                                                                  |
                                                                   lasts for upsMultiplierDuration
                                                                                  |
                                                                       multiplier expires
                                                                                  |
                                                                     (waits for next mine())
```

### Important Details

- If `entropyEnabled` is `false`, the multiplier is always 1x. No VRF fee is required. Sending ETH when entropy is not needed causes the transaction to revert with `MineRig__NoEntropyRequired`.
- If the VRF callback arrives after the slot has changed hands again (epoch mismatch), the callback is ignored and a `MineRig__EntropyIgnored` event is emitted.
- Each multiplier value must be between 1x (`1e18`) and 10x (`10e18`).
- The multiplier duration must be between 1 hour and 7 days.
- The rig owner can toggle entropy on or off at any time via `setEntropyEnabled()`.

---

## 4. Fee Distribution

Every time a slot is mined (and the price is greater than 0), the payment is split among four recipients:

| Recipient | Share | Basis Points | Notes |
|---|---|---|---|
| Previous Miner | 80% | 8,000 | Added to claimable balance (pull pattern) |
| Treasury | 15% | remainder | Receives `price - minerFee - teamFee - protocolFee`; absorbs rounding dust |
| Team | 4% | 400 | Set to 0% if `team` address is `address(0)`; redirected to treasury |
| Protocol | 1% | 100 | Set to 0% if protocol address is `address(0)`; redirected to treasury |

**Implementation details:**

- The contract uses `TOTAL_BPS = 2000` (20%) and `DIVISOR = 10000`. The miner fee is calculated as `price * (DIVISOR - TOTAL_BPS) / DIVISOR`, which yields 80%.
- Team and protocol fees are calculated as fixed basis points of the total price.
- The treasury fee is calculated as the remainder (`price - minerFee - teamFee - protocolFee`), which ensures all rounding dust accrues to the treasury rather than being lost.
- If the `team` address is set to `address(0)`, the team fee becomes 0 and that 4% is absorbed into the treasury remainder.
- If the protocol address (resolved via `IMineCore(core).protocolFeeAddress()`) is `address(0)`, the protocol fee becomes 0 and that 1% is absorbed into the treasury remainder.
- Miner fees are **not** transferred immediately. They are accumulated in `accountToClaimable[miner]` and must be withdrawn via the `claim()` function.
- Treasury, team, and protocol fees are transferred immediately via `safeTransfer`.

---

## 5. Claiming Miner Fees

Miner fees use a **pull-based claim pattern** rather than being pushed to the displaced miner during the `mine()` transaction. This is a critical design choice that prevents griefing attacks.

### Why Pull-Based?

If miner fees were sent directly during `mine()`, a malicious miner could set their address to a contract that reverts on token receipt. This would make the slot permanently un-mineable because every attempt to take the slot would revert when trying to send fees to the malicious miner.

By accumulating fees in a mapping and requiring a separate `claim()` call, the `mine()` function never sends tokens to the previous miner and cannot be blocked.

### How to Claim

```solidity
function claim(address account) external;
```

- **Anyone can call `claim()` for any account.** The funds always go to the `account` address, not the caller. This means a third party or bot can trigger claims on behalf of miners.
- Reverts with `MineRig__NothingToClaim` if the account has no accumulated fees.
- Reverts with `MineRig__ZeroAddress` if the account is `address(0)`.
- Emits `MineRig__Claimed(account, amount)` on success.
- The claimable balance is zeroed before the transfer (checks-effects-interactions pattern) and the function is protected by `nonReentrant`.

### Checking Claimable Balance

The `accountToClaimable` mapping is public:

```solidity
mapping(address => uint256) public accountToClaimable;
```

Query it to check how much a given address can claim.

---

## 6. Launch Parameters

These parameters are set at deployment and **cannot be changed** after the rig is created.

| Parameter | Type | Valid Range | Description |
|---|---|---|---|
| `quote` | `address` | Non-zero | Payment token address (e.g., USDC) |
| `epochPeriod` | `uint256` | 10 minutes -- 365 days | Duration of each Dutch auction epoch |
| `priceMultiplier` | `uint256` | 1.1e18 -- 3e18 | Multiplier applied to the mined price to set the next epoch's starting price. Uses 18 decimal precision (1e18 = 1x). |
| `minInitPrice` | `uint256` | 1e6 -- type(uint192).max | Minimum starting price for any epoch. Also used as the initial price for slot 0 at deployment. Denominated in the quote token (e.g., 1e6 = 1 USDC). |
| `initialUps` | `uint256` | 1 -- 1e24 | Starting units per second emission rate (before capacity division) |
| `tailUps` | `uint256` | 1 -- `initialUps` | Minimum UPS floor after halvings. Must be greater than 0 and at most equal to `initialUps`. |
| `halvingAmount` | `uint256` | 1,000e18 -- 1e27 | Total minted token threshold for the first halving |
| `upsMultipliers` | `uint256[]` | Each value: 1e18 -- 10e18; array must be non-empty | Set of possible UPS multiplier values drawn by VRF. Values use 18 decimal precision (1e18 = 1x, 10e18 = 10x). |
| `upsMultiplierDuration` | `uint256` | 1 hour -- 7 days | Duration a VRF-assigned multiplier remains active before resetting to 1x |

**Additional immutables** (set automatically, not user-configured):

| Parameter | Description |
|---|---|
| `unit` | Address of the Unit (ERC20) token minted by this rig |
| `entropy` | Address of the Pyth Entropy contract for VRF |
| `core` | Address of the MineCore contract that deployed this rig |
| `startTime` | Block timestamp at deployment |

---

## 7. Owner Controls

The rig owner (set at deployment, transferable via `transferOwnership()`) can modify the following parameters after deployment:

| Function | Parameter | Constraints |
|---|---|---|
| `setTreasury(address)` | Treasury fee recipient | Cannot be `address(0)` |
| `setTeam(address)` | Team fee recipient | Can be `address(0)` to disable team fees (redirected to treasury) |
| `setCapacity(uint256)` | Number of mining slots | Can only **increase** (never decrease). Maximum 256. |
| `setEntropyEnabled(bool)` | Toggle VRF multipliers | `true` enables random multipliers; `false` forces all multipliers to 1x |
| `setUri(string)` | Rig metadata URI | No constraints on content |

### What the Owner Cannot Do

- **Change pricing parameters**: `epochPeriod`, `priceMultiplier`, and `minInitPrice` are immutable.
- **Change emission parameters**: `initialUps`, `tailUps`, `halvingAmount`, and `upsMultiplierDuration` are immutable.
- **Halt mining**: There is no pause mechanism. Mining can always proceed as long as the contract exists.
- **Withdraw funds**: There is no withdrawal function. Miner fees are held for their rightful claimants. Treasury, team, and protocol fees are transferred immediately.
- **Affect pending claims**: Claimable balances are stored per-account and cannot be altered by the owner.
- **Reduce capacity**: Slots can only be added, never removed.
- **Change the UPS multiplier values**: The `upsMultipliers[]` array is set at deployment and cannot be modified.

---

## 8. View Functions

### `getPrice(uint256 index)`

Returns the current Dutch auction price for the specified slot.

```solidity
function getPrice(uint256 index) external view returns (uint256);
```

- Returns 0 if the epoch has expired (i.e., `timePassed > epochPeriod`).
- The price decays linearly from `initPrice` to 0 over the `epochPeriod`.

### `getUps()`

Returns the current global UPS based on the halving schedule.

```solidity
function getUps() external view returns (uint256);
```

- This is the total UPS before division by capacity. Each slot receives `getUps() / capacity`.
- Takes into account `totalMinted` and the halving thresholds.
- Floored at `tailUps`.

### `getSlot(uint256 index)`

Returns the full state of a mining slot as a `Slot` struct.

```solidity
function getSlot(uint256 index) external view returns (Slot memory);
```

Returns all fields: `epochId`, `initPrice`, `startTime`, `ups`, `upsMultiplier`, `lastUpsMultiplierTime`, `miner`, and `uri`.

### `getEntropyFee()`

Returns the current VRF fee required by Pyth Entropy, in wei.

```solidity
function getEntropyFee() external view returns (uint256);
```

This value must be sent as `msg.value` when calling `mine()` if entropy is enabled and the multiplier needs updating.

### `getUpsMultipliers()`

Returns the full array of possible UPS multiplier values.

```solidity
function getUpsMultipliers() external view returns (uint256[] memory);
```

Each value uses 18 decimal precision (`1e18` = 1x, `5e18` = 5x, `10e18` = 10x).

### `getUpsMultipliersLength()`

Returns the number of entries in the UPS multipliers array.

```solidity
function getUpsMultipliersLength() external view returns (uint256);
```

---

## 9. Events

### Mining Events

| Event | Parameters | Description |
|---|---|---|
| `MineRig__Mine` | `sender` (address), `miner` (indexed address), `index` (indexed uint256), `epochId` (indexed uint256), `price` (uint256), `uri` (string) | Emitted when a slot is mined. `sender` is `msg.sender`; `miner` is the address that will occupy the slot and receive emissions. |
| `MineRig__Mint` | `miner` (indexed address), `index` (indexed uint256), `epochId` (indexed uint256), `amount` (uint256) | Emitted when tokens are minted to the displaced miner for their accumulated emissions. |

### Fee Events

| Event | Parameters | Description |
|---|---|---|
| `MineRig__MinerFee` | `miner` (indexed address), `index` (indexed uint256), `epochId` (indexed uint256), `amount` (uint256) | Emitted when miner fees are added to the displaced miner's claimable balance. |
| `MineRig__TreasuryFee` | `treasury` (indexed address), `index` (indexed uint256), `epochId` (indexed uint256), `amount` (uint256) | Emitted when the treasury fee is transferred. |
| `MineRig__TeamFee` | `team` (indexed address), `index` (indexed uint256), `epochId` (indexed uint256), `amount` (uint256) | Emitted when the team fee is transferred. Only fires if the team address is non-zero and the team fee is greater than 0. |
| `MineRig__ProtocolFee` | `protocol` (indexed address), `index` (indexed uint256), `epochId` (indexed uint256), `amount` (uint256) | Emitted when the protocol fee is transferred. Only fires if the protocol address is non-zero and the protocol fee is greater than 0. |
| `MineRig__Claimed` | `account` (indexed address), `amount` (uint256) | Emitted when accumulated miner fees are claimed by or on behalf of an account. |

### Entropy Events

| Event | Parameters | Description |
|---|---|---|
| `MineRig__EntropyRequested` | `index` (indexed uint256), `epochId` (indexed uint256), `sequenceNumber` (indexed uint64) | Emitted when a Pyth Entropy VRF request is submitted for a slot's UPS multiplier. |
| `MineRig__UpsMultiplierSet` | `index` (indexed uint256), `epochId` (indexed uint256), `upsMultiplier` (uint256) | Emitted when a slot's UPS multiplier is updated, either by VRF callback or by resetting to 1x. |
| `MineRig__EntropyIgnored` | `index` (indexed uint256), `epochId` (indexed uint256) | Emitted when a VRF callback arrives but the slot's epoch has already changed (stale callback). The random result is discarded. |

### Admin Events

| Event | Parameters | Description |
|---|---|---|
| `MineRig__TreasurySet` | `treasury` (indexed address) | Emitted when the owner updates the treasury address. |
| `MineRig__TeamSet` | `team` (indexed address) | Emitted when the owner updates the team address. |
| `MineRig__CapacitySet` | `capacity` (uint256) | Emitted when the owner increases the slot capacity. |
| `MineRig__EntropyEnabledSet` | `enabled` (bool) | Emitted when the owner toggles entropy on or off. |
| `MineRig__UriSet` | `uri` (string) | Emitted when the owner updates the rig metadata URI. |
