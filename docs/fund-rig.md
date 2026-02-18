# FundRig

## Overview

FundRig is a donation-based token distribution mechanism within the Farplace launchpad. It allows communities to fund a recipient -- such as a creator, charity, or project -- while earning proportional Unit token emissions in return.

Users donate a payment token (typically USDC) into daily pools. Donations are split immediately upon deposit: 50% goes directly to the designated recipient, with the remaining 50% distributed among the treasury, team, and protocol. After each 24-hour day concludes, donors can claim their proportional share of that day's Unit token emission based on how much they contributed relative to the total pool.

FundRig is one of three rig types on Farplace, alongside MineRig (competitive slot mining) and SpinRig (slot machine). It is the simplest of the three -- there is no Dutch auction pricing, no VRF randomness, and no competitive displacement. The incentive model is straightforward: donate to fund a recipient, receive tokens proportional to your contribution.

---

## How It Works

### Donating

To donate, call `fund(account, amount, uri)` on the FundRig contract.

```solidity
function fund(address account, uint256 amount, string calldata _uri) external;
```

- **`account`** -- The address that will be credited for this donation and will be able to claim Unit tokens later. This does not have to be `msg.sender`; you can fund on behalf of another account.
- **`amount`** -- The amount of the quote token (e.g., USDC) to donate. Must be at least `MIN_DONATION` (10,000 raw units, equivalent to $0.01 for USDC with 6 decimals).
- **`_uri`** -- An arbitrary metadata string attached to the donation event (e.g., a message, link, or identifier).

The caller (`msg.sender`) must have approved the FundRig contract to transfer `amount` of the quote token beforehand. The tokens are transferred from `msg.sender`, but the donation is credited to `account`.

Upon calling `fund()`:

1. The full `amount` is transferred from `msg.sender` to the contract.
2. The amount is immediately split and distributed to the recipient, treasury, team, and protocol.
3. The donation is recorded in the current day's pool, crediting `account`.

No tokens are held by the contract after a `fund()` call -- all donated funds are distributed immediately.

### Daily Pools

Time is divided into 24-hour days starting from the contract's deployment timestamp (`startTime`). The current day number is calculated as:

```
currentDay = (block.timestamp - startTime) / 86400
```

Day 0 starts at deployment. Day 1 begins exactly 24 hours later, and so on.

Each day is an independent pool. Multiple donations within the same day accumulate for the same donor. For example, if Alice donates 100 USDC and then another 50 USDC on day 5, her total recorded donation for day 5 is 150 USDC.

The daily pool tracks two values:
- **`dayToTotalDonated[day]`** -- The total amount donated by all users on that day.
- **`dayAccountToDonation[day][account]`** -- The amount donated by a specific account on that day.

These values are used purely for proportional emission calculation. The actual donated funds have already been distributed at the time of the `fund()` call.

### Claiming

After a day ends, donors can claim their proportional share of that day's Unit token emission by calling `claim(account, day)`.

```solidity
function claim(address account, uint256 day) external;
```

- **`account`** -- The account to claim for. Must have a non-zero donation recorded for the specified day.
- **`day`** -- The day number to claim for. Must be a completed day (i.e., `day < currentDay()`).

The reward is calculated as:

```
userReward = (userDonation * dayEmission) / dayTotal
```

Where:
- `userDonation` is the account's total donation for that day.
- `dayEmission` is the Unit token emission allocated to that day (see [Emission Schedule](#emission-schedule)).
- `dayTotal` is the total donations from all users on that day.

Key rules:
- **Per-day claims**: Each day must be claimed individually. There is no batch claim function on the rig itself.
- **One claim per account per day**: Once claimed, `dayAccountToHasClaimed[day][account]` is set to `true` and the account cannot claim again for that day.
- **Anyone can trigger a claim**: The caller does not need to be the account. Anyone can call `claim(account, day)` on behalf of any account. The Unit tokens are always minted to `account`.
- **Day must be over**: You cannot claim for the current day. The day must have fully elapsed.
- **Zero-donation days**: If nobody donates on a given day, those emissions are effectively unclaimable. The `dayTotal` for that day is zero, and no claims can be made.

---

## Emission Schedule

FundRig distributes a fixed number of Unit tokens per day, following a halving schedule:

- **Initial emission**: Set by `initialEmission` at launch. Valid range: `1e18` to `1e30`.
- **Halving**: Every `halvingPeriod` days (measured in wall-clock time from deployment), the daily emission halves.
- **Floor**: The emission never drops below `minEmission`.

The emission for any given day is computed as:

```solidity
function getDayEmission(uint256 day) public view returns (uint256) {
    uint256 halvings = day / halvingPeriod;
    uint256 emission = initialEmission >> halvings; // divide by 2^halvings
    if (emission < minEmission) {
        return minEmission;
    }
    return emission;
}
```

### Example

With `initialEmission = 1000e18`, `halvingPeriod = 30`, and `minEmission = 10e18`:

| Day Range | Halvings | Daily Emission |
|-----------|----------|----------------|
| 0 -- 29   | 0        | 1000 tokens    |
| 30 -- 59  | 1        | 500 tokens     |
| 60 -- 89  | 2        | 250 tokens     |
| 90 -- 119 | 3        | 125 tokens     |
| 120 -- 149| 4        | 62.5 tokens    |
| 150 -- 179| 5        | 31.25 tokens   |
| 180 -- 209| 6        | 15.625 tokens  |
| 210+      | 7+       | 10 tokens (floor) |

Once the halved emission drops below `minEmission`, the floor value is used indefinitely. The emission schedule is entirely immutable -- it cannot be changed after deployment.

### Comparison with Other Rig Types

Unlike MineRig (which uses supply-based halvings triggered by total tokens minted) or SpinRig (which uses time-based UPS halvings measured in seconds), FundRig uses day-based halvings. The emission is a discrete daily amount, not a continuous rate.

---

## Fee Distribution

Every `fund()` call distributes the donated amount immediately according to fixed basis-point splits:

| Recipient   | Basis Points | Percentage | Description                                      |
|-------------|-------------|------------|--------------------------------------------------|
| Recipient   | 5,000       | 50%        | The designated recipient address                  |
| Treasury    | Remainder   | ~45%       | Absorbs rounding dust; receives the balance       |
| Team        | 400         | 4%         | The launcher/team address                         |
| Protocol    | 100         | 1%         | The Farplace protocol fee address                 |

### How Fees Are Calculated

```solidity
recipientAmount = amount * 5000 / 10000;      // 50%
teamFee         = amount * 400  / 10000;       // 4%  (0 if team == address(0))
protocolFee     = amount * 100  / 10000;       // 1%  (0 if protocol == address(0))
treasuryFee     = amount - recipientAmount - teamFee - protocolFee;  // remainder (~45%)
```

### Special Cases

- **Team is zero address**: If the owner sets the `team` address to `address(0)`, the 4% team fee is not sent. It is absorbed into the treasury remainder.
- **Protocol is zero address**: If the FundCore's `protocolFeeAddress` is set to `address(0)`, the 1% protocol fee is not sent. It is absorbed into the treasury remainder.
- **Both zero**: If both team and protocol are the zero address, the treasury receives the full 50% (the non-recipient half).
- **Rounding dust**: Because the treasury fee is calculated as a remainder (`amount - recipientAmount - teamFee - protocolFee`), any fractional wei lost to integer division in the other three calculations is captured by the treasury.

### Distribution Timing

Fees are distributed immediately on each `fund()` call via direct ERC-20 transfers. There is no batching, no accumulator pattern, and no pull-based claiming for fees. Each `fund()` call triggers up to four `safeTransfer` calls (recipient, treasury, and conditionally team and protocol).

### Default Treasury Setup

When launched through FundCore, the treasury is initially set to the **Auction contract** associated with the rig. This means the 45% treasury share flows into the Auction, which can sell Unit tokens for LP tokens that are then burned, creating deflationary pressure on the liquidity pool. The team address is initially set to the **launcher's address**.

---

## Recipient Model

The `recipient` address is central to FundRig's purpose. It represents the entity that the community is funding -- a creator, charity, public good, or any cause.

### How It Works

- The recipient receives **50% of every donation** immediately via direct ERC-20 transfer.
- The recipient does not need to take any action -- funds arrive automatically whenever anyone calls `fund()`.
- The recipient address is set at construction and can be updated by the rig owner after deployment.

### Constraints

- **Must be non-zero**: The constructor enforces `_recipient != address(0)`, and `setRecipient()` enforces the same check. A FundRig cannot operate without a recipient.
- **No special permissions**: The recipient address has no privileged role in the contract beyond receiving funds. It cannot pause the rig, change parameters, or claim tokens.
- **Owner-controlled**: Only the rig owner can change the recipient address via `setRecipient()`.

### Use Cases

- **Creator funding**: A community launches a FundRig for a content creator. The creator's address is set as the recipient. Donations fund the creator while donors earn the community token.
- **Charity**: A charity wallet is set as the recipient. Donors contribute to the cause and receive tokens representing their participation.
- **Protocol treasury**: A DAO treasury is set as the recipient, with donations serving as a fundraising mechanism that simultaneously distributes governance tokens.

---

## Launch Parameters

The following parameters are set at launch time (via `FundCore.launch()`) and are **immutable** once the contract is deployed.

### FundRig Configuration

| Parameter          | Type      | Valid Range                | Description                                                                 |
|--------------------|-----------|----------------------------|-----------------------------------------------------------------------------|
| `quoteToken`       | `address` | Any standard ERC-20        | The payment token accepted for donations (e.g., USDC). No rebasing or fee-on-transfer tokens. |
| `recipient`        | `address` | Non-zero                   | Address receiving 50% of all donations.                                      |
| `tokenName`        | `string`  | Non-empty                  | Name of the Unit (ERC-20) token created for this rig.                        |
| `tokenSymbol`      | `string`  | Non-empty                  | Symbol of the Unit token.                                                    |
| `uri`              | `string`  | Non-empty                  | Initial metadata URI for the rig (e.g., branding, logo).                     |
| `usdcAmount`       | `uint256` | >= `minUsdcForLaunch`      | USDC provided by the launcher to seed the initial liquidity pool.            |
| `unitAmount`       | `uint256` | > 0                        | Number of Unit tokens minted for the initial liquidity pool.                 |
| `initialEmission`  | `uint256` | `1e18` -- `1e30`           | Starting Unit token emission per day.                                        |
| `minEmission`      | `uint256` | `1` -- `initialEmission`   | Minimum daily emission floor (emission never drops below this).              |
| `halvingPeriod`    | `uint256` | 7 -- 365 (days)            | Number of days between emission halvings.                                    |

### Auction Configuration

Each FundRig is deployed alongside an Auction contract for treasury token sales. These parameters configure that auction.

| Parameter                 | Type      | Description                                                        |
|---------------------------|-----------|--------------------------------------------------------------------|
| `auctionInitPrice`        | `uint256` | Starting price for the treasury auction.                           |
| `auctionEpochPeriod`      | `uint256` | Duration of each auction epoch (Dutch auction decay period).       |
| `auctionPriceMultiplier`  | `uint256` | Price reset multiplier after each auction purchase.                |
| `auctionMinInitPrice`     | `uint256` | Minimum starting price for the auction.                            |

### What Happens at Launch

When `FundCore.launch()` is called:

1. A new **Unit** ERC-20 token is deployed.
2. `unitAmount` of the Unit token is minted and paired with `usdcAmount` of USDC to create a **Uniswap V2 liquidity pool**.
3. The initial LP tokens are **burned** (sent to the dead address `0x...dEaD`), permanently locking the liquidity.
4. An **Auction** contract is deployed (configured with the auction parameters) to handle treasury token sales.
5. The **FundRig** contract is deployed with the emission configuration.
6. Unit minting rights are transferred to the FundRig (only the rig can mint new Unit tokens going forward).
7. Ownership of the FundRig is transferred to the launcher.
8. The rig is registered in the central Registry.

---

## Owner Controls

The rig owner (initially the launcher) can modify the following parameters after deployment:

### Mutable Settings

| Function            | Parameter     | Constraints                                 | Description                                                       |
|---------------------|---------------|---------------------------------------------|-------------------------------------------------------------------|
| `setRecipient()`    | `recipient`   | Cannot be `address(0)`                      | Change the address that receives 50% of donations.                |
| `setTreasury()`     | `treasury`    | Cannot be `address(0)`                      | Change the treasury address that receives ~45% of donations.      |
| `setTeam()`         | `team`        | Can be `address(0)` (disables team fees)    | Change the team address. Setting to zero redirects team fees to treasury. |
| `setUri()`          | `uri`         | Any string                                  | Update the metadata URI for the rig.                              |
| `transferOwnership()` | `owner`    | Standard OpenZeppelin Ownable               | Transfer ownership of the rig to a new address.                   |

### Immutable Settings (Cannot Be Changed)

The following are fixed at deployment and can never be modified:

- `unit` -- The Unit token address
- `quote` -- The payment token address
- `core` -- The FundCore contract address
- `startTime` -- The deployment timestamp (determines day boundaries)
- `initialEmission` -- The starting daily emission
- `minEmission` -- The emission floor
- `halvingPeriod` -- The halving schedule
- Fee percentages (`RECIPIENT_BPS`, `TEAM_BPS`, `PROTOCOL_BPS`, `DIVISOR`)

---

## View Functions

### `currentDay()`

```solidity
function currentDay() public view returns (uint256)
```

Returns the current day number since contract deployment, 0-indexed. Calculated as `(block.timestamp - startTime) / 86400`. Day 0 is the deployment day.

### `getDayEmission(day)`

```solidity
function getDayEmission(uint256 day) public view returns (uint256)
```

Returns the Unit token emission allocated to a specific day. Applies the halving schedule: `initialEmission >> (day / halvingPeriod)`, floored at `minEmission`. Can be called for any day number, including future days.

### `getPendingReward(day, account)`

```solidity
function getPendingReward(uint256 day, address account) external view returns (uint256)
```

Returns the pending (unclaimed) Unit reward for `account` on a given `day`. Returns `0` if:
- The day has not yet ended (`day >= currentDay()`).
- The account has already claimed for that day.
- The account did not donate on that day.

Otherwise, returns `(userDonation * dayEmission) / dayTotal`.

### State Mappings

These public mappings are accessible as view functions:

| Mapping                              | Returns     | Description                                                    |
|--------------------------------------|-------------|----------------------------------------------------------------|
| `dayToTotalDonated(uint256 day)`     | `uint256`   | Total amount donated by all users on a given day.              |
| `dayAccountToDonation(uint256 day, address account)` | `uint256` | Amount donated by a specific account on a given day.   |
| `dayAccountToHasClaimed(uint256 day, address account)` | `bool`   | Whether the account has already claimed for that day.  |

### Immutable / State Getters

| Function            | Returns     | Description                                           |
|---------------------|-------------|-------------------------------------------------------|
| `unit()`            | `address`   | The Unit (ERC-20) token address.                      |
| `quote()`           | `address`   | The quote (payment) token address.                    |
| `core()`            | `address`   | The FundCore contract address.                        |
| `startTime()`       | `uint256`   | The contract deployment timestamp.                    |
| `initialEmission()` | `uint256`   | The starting daily emission amount.                   |
| `minEmission()`     | `uint256`   | The minimum daily emission floor.                     |
| `halvingPeriod()`   | `uint256`   | Number of days between halvings.                      |
| `recipient()`       | `address`   | Current recipient address (receives 50% of donations).|
| `treasury()`        | `address`   | Current treasury address.                             |
| `team()`            | `address`   | Current team address (zero means disabled).           |
| `uri()`             | `string`    | Current metadata URI for the rig.                     |

### Constants

| Constant               | Value    | Description                                          |
|------------------------|----------|------------------------------------------------------|
| `DAY_DURATION`         | `86400`  | Seconds in one day (1 days).                         |
| `MIN_HALVING_PERIOD`   | `7`      | Minimum allowed halving period (days).               |
| `MAX_HALVING_PERIOD`   | `365`    | Maximum allowed halving period (days).               |
| `MIN_INITIAL_EMISSION` | `1e18`   | Minimum allowed initial emission.                    |
| `MAX_INITIAL_EMISSION` | `1e30`   | Maximum allowed initial emission.                    |
| `RECIPIENT_BPS`        | `5000`   | Recipient fee in basis points (50%).                 |
| `TEAM_BPS`             | `400`    | Team fee in basis points (4%).                       |
| `PROTOCOL_BPS`         | `100`    | Protocol fee in basis points (1%).                   |
| `DIVISOR`              | `10000`  | Basis point divisor.                                 |
| `MIN_DONATION`         | `10000`  | Minimum donation amount in raw token units.          |

---

## Events

### `FundRig__Funded`

Emitted when a donation is made via `fund()`.

```solidity
event FundRig__Funded(address sender, address indexed funder, uint256 amount, uint256 day, string uri);
```

| Parameter | Indexed | Description                                                        |
|-----------|---------|--------------------------------------------------------------------|
| `sender`  | No      | The address that called `fund()` and paid the tokens (`msg.sender`). |
| `funder`  | Yes     | The account credited for the donation (will claim Unit tokens).    |
| `amount`  | No      | The total donation amount in quote token units.                    |
| `day`     | No      | The day number the donation was recorded in.                       |
| `uri`     | No      | The metadata URI string attached to this donation.                 |

### `FundRig__Claimed`

Emitted when Unit tokens are claimed for a completed day via `claim()`.

```solidity
event FundRig__Claimed(address indexed account, uint256 amount, uint256 day);
```

| Parameter | Indexed | Description                                                  |
|-----------|---------|--------------------------------------------------------------|
| `account` | Yes     | The account that received the claimed Unit tokens.           |
| `amount`  | No      | The number of Unit tokens minted and sent to the account.    |
| `day`     | No      | The day number that was claimed.                             |

### `FundRig__TreasuryFee`

Emitted on every `fund()` call when the treasury fee is transferred.

```solidity
event FundRig__TreasuryFee(address indexed treasury, uint256 indexed day, uint256 amount);
```

| Parameter  | Indexed | Description                                        |
|------------|---------|----------------------------------------------------|
| `treasury` | Yes     | The treasury address that received the fee.        |
| `day`      | Yes     | The day number when the fee was collected.         |
| `amount`   | No      | The treasury fee amount in quote token units.      |

### `FundRig__TeamFee`

Emitted on `fund()` calls when the team fee is transferred (only if `team != address(0)`).

```solidity
event FundRig__TeamFee(address indexed team, uint256 indexed day, uint256 amount);
```

| Parameter | Indexed | Description                                    |
|-----------|---------|-------------------------------------------------|
| `team`    | Yes     | The team address that received the fee.         |
| `day`     | Yes     | The day number when the fee was collected.      |
| `amount`  | No      | The team fee amount in quote token units.       |

### `FundRig__ProtocolFee`

Emitted on `fund()` calls when the protocol fee is transferred (only if `protocol != address(0)`).

```solidity
event FundRig__ProtocolFee(address indexed protocol, uint256 indexed day, uint256 amount);
```

| Parameter  | Indexed | Description                                      |
|------------|---------|--------------------------------------------------|
| `protocol` | Yes     | The protocol fee address that received the fee.  |
| `day`      | Yes     | The day number when the fee was collected.       |
| `amount`   | No      | The protocol fee amount in quote token units.    |

### `FundRig__RecipientSet`

Emitted when the owner changes the recipient address.

```solidity
event FundRig__RecipientSet(address indexed recipient);
```

| Parameter   | Indexed | Description                          |
|-------------|---------|--------------------------------------|
| `recipient` | Yes     | The new recipient address.           |

### `FundRig__TreasurySet`

Emitted when the owner changes the treasury address.

```solidity
event FundRig__TreasurySet(address indexed treasury);
```

| Parameter  | Indexed | Description                          |
|------------|---------|--------------------------------------|
| `treasury` | Yes     | The new treasury address.            |

### `FundRig__TeamSet`

Emitted when the owner changes the team address.

```solidity
event FundRig__TeamSet(address indexed team);
```

| Parameter | Indexed | Description                                                  |
|-----------|---------|--------------------------------------------------------------|
| `team`    | Yes     | The new team address (or `address(0)` to disable team fees). |

### `FundRig__UriSet`

Emitted when the owner updates the metadata URI.

```solidity
event FundRig__UriSet(string uri);
```

| Parameter | Indexed | Description                |
|-----------|---------|----------------------------|
| `uri`     | No      | The new metadata URI.      |
