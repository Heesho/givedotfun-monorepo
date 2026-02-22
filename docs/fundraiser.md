# Fundraiser

## Overview

Fundraiser is a donation-based token distribution mechanism within the give.fun platform. It allows communities to fund a recipient -- such as a creator, charity, or project -- while earning proportional Coin token emissions in return.

Users donate a payment token (typically USDC) into epoch pools. Donations are split immediately upon deposit: 50% goes directly to the designated recipient, with the remaining 50% distributed among the treasury, team, and protocol. After each epoch concludes, donors can claim their proportional share of that epoch's Coin token emission based on how much they contributed relative to the total pool.

The Fundraiser is the core mechanism of give.fun. There is no Dutch auction pricing, no VRF randomness, and no competitive displacement. The incentive model is straightforward: donate to fund a recipient, receive tokens proportional to your contribution.

---

## How It Works

### Donating

To donate, call `fund(account, amount, uri)` on the Fundraiser contract.

```solidity
function fund(address account, uint256 amount, string calldata _uri) external;
```

- **`account`** -- The address that will be credited for this donation and will be able to claim Coin tokens later. This does not have to be `msg.sender`; you can fund on behalf of another account.
- **`amount`** -- The amount of the quote token (e.g., USDC) to donate. Must be at least `MIN_DONATION` (10,000 raw units, equivalent to $0.01 for USDC with 6 decimals).
- **`_uri`** -- An arbitrary metadata string attached to the donation event (e.g., a message, link, or identifier).

The caller (`msg.sender`) must have approved the Fundraiser contract to transfer `amount` of the quote token beforehand. The tokens are transferred from `msg.sender`, but the donation is credited to `account`.

Upon calling `fund()`:

1. The full `amount` is transferred from `msg.sender` to the contract.
2. The amount is immediately split and distributed to the recipient, treasury, team, and protocol.
3. The donation is recorded in the current epoch's pool, crediting `account`.

No tokens are held by the contract after a `fund()` call -- all donated funds are distributed immediately.

### Epoch Pools

Time is divided into configurable-length epochs starting from the contract's deployment timestamp (`startTime`). The epoch duration is set at launch via `epochDuration` (valid range: 1 hour to 7 days). The current epoch number is calculated as:

```
currentEpoch = (block.timestamp - startTime) / epochDuration
```

Epoch 0 starts at deployment. Epoch 1 begins exactly `epochDuration` seconds later, and so on.

Each epoch is an independent pool. Multiple donations within the same epoch accumulate for the same donor. For example, if Alice donates 100 USDC and then another 50 USDC in epoch 5, her total recorded donation for epoch 5 is 150 USDC.

The epoch pool tracks two values:
- **`epochToTotalDonated[epoch]`** -- The total amount donated by all users in that epoch.
- **`epochAccountToDonation[epoch][account]`** -- The amount donated by a specific account in that epoch.

These values are used purely for proportional emission calculation. The actual donated funds have already been distributed at the time of the `fund()` call.

### Claiming

After an epoch ends, donors can claim their proportional share of that epoch's Coin token emission by calling `claim(account, epoch)`.

```solidity
function claim(address account, uint256 epoch) external;
```

- **`account`** -- The account to claim for. Must have a non-zero donation recorded for the specified epoch.
- **`epoch`** -- The epoch number to claim for. Must be a completed epoch (i.e., `epoch < currentEpoch()`).

The reward is calculated as:

```
userReward = (userDonation * epochEmission) / epochTotal
```

Where:
- `userDonation` is the account's total donation for that epoch.
- `epochEmission` is the Coin token emission allocated to that epoch (see [Emission Schedule](#emission-schedule)).
- `epochTotal` is the total donations from all users in that epoch.

Key rules:
- **Per-epoch claims**: Each epoch must be claimed individually. There is no batch claim function on the fundraiser itself (use Multicall for batch claims).
- **One claim per account per epoch**: Once claimed, `epochAccountToHasClaimed[epoch][account]` is set to `true` and the account cannot claim again for that epoch.
- **Anyone can trigger a claim**: The caller does not need to be the account. Anyone can call `claim(account, epoch)` on behalf of any account. The Coin tokens are always minted to `account`.
- **Epoch must be over**: You cannot claim for the current epoch. The epoch must have fully elapsed.
- **Zero-donation epochs**: If nobody donates in a given epoch, those emissions are effectively unclaimable. The `epochTotal` for that epoch is zero, and no claims can be made.

---

## Emission Schedule

Fundraiser distributes a fixed number of Coin tokens per epoch, following a halving schedule:

- **Initial emission**: Set by `initialEmission` at launch. Valid range: `1e18` to `1e30`.
- **Halving**: Every `halvingPeriod` epochs, the per-epoch emission halves.
- **Floor**: The emission never drops below `minEmission`.
- **Epoch duration**: Configurable at launch via `epochDuration` (1 hour to 7 days).

The emission for any given epoch is computed as:

```solidity
function getEpochEmission(uint256 epoch) public view returns (uint256) {
    uint256 halvings = epoch / halvingPeriod;
    uint256 emission = initialEmission >> halvings; // divide by 2^halvings
    if (emission < minEmission) {
        return minEmission;
    }
    return emission;
}
```

### Example

With `initialEmission = 1000e18`, `halvingPeriod = 30`, and `minEmission = 10e18`:

| Epoch Range | Halvings | Emission Per Epoch |
|-------------|----------|--------------------|
| 0 -- 29     | 0        | 1000 tokens        |
| 30 -- 59    | 1        | 500 tokens         |
| 60 -- 89    | 2        | 250 tokens         |
| 90 -- 119   | 3        | 125 tokens         |
| 120 -- 149  | 4        | 62.5 tokens        |
| 150 -- 179  | 5        | 31.25 tokens       |
| 180 -- 209  | 6        | 15.625 tokens      |
| 210+        | 7+       | 10 tokens (floor)  |

Once the halved emission drops below `minEmission`, the floor value is used indefinitely. The emission schedule is entirely immutable -- it cannot be changed after deployment.

---

## Fee Distribution

Every `fund()` call distributes the donated amount immediately according to fixed basis-point splits:

| Recipient   | Basis Points | Percentage | Description                                      |
|-------------|-------------|------------|--------------------------------------------------|
| Recipient   | 5,000       | 50%        | The designated recipient address                  |
| Treasury    | Remainder   | ~45%       | Absorbs rounding dust; receives the balance       |
| Team        | 400         | 4%         | The launcher/team address                         |
| Protocol    | 100         | 1%         | The give.fun protocol fee address                 |

### How Fees Are Calculated

```solidity
recipientAmount = amount * 5000 / 10000;      // 50%
teamFee         = amount * 400  / 10000;       // 4%  (0 if team == address(0))
protocolFee     = amount * 100  / 10000;       // 1%  (0 if protocol == address(0))
treasuryFee     = amount - recipientAmount - teamFee - protocolFee;  // remainder (~45%)
```

### Special Cases

- **Team is zero address**: If the owner sets the `team` address to `address(0)`, the 4% team fee is not sent. It is absorbed into the treasury remainder.
- **Protocol is zero address**: If the Core's `protocolFeeAddress` is set to `address(0)`, the 1% protocol fee is not sent. It is absorbed into the treasury remainder.
- **Both zero**: If both team and protocol are the zero address, the treasury receives the full 50% (the non-recipient half).
- **Rounding dust**: Because the treasury fee is calculated as a remainder (`amount - recipientAmount - teamFee - protocolFee`), any fractional wei lost to integer division in the other three calculations is captured by the treasury.

### Distribution Timing

Fees are distributed immediately on each `fund()` call via direct ERC-20 transfers. There is no batching, no accumulator pattern, and no pull-based claiming for fees. Each `fund()` call triggers up to four `safeTransfer` calls (recipient, treasury, and conditionally team and protocol).

### Default Treasury Setup

When launched through Core, the treasury is initially set to the **Auction contract** associated with the fundraiser. This means the 45% treasury share flows into the Auction, which can sell Coin tokens for LP tokens that are then burned, creating deflationary pressure on the liquidity pool. The team address is initially set to the **launcher's address**.

---

## Recipient Model

The `recipient` address is central to Fundraiser's purpose. It represents the entity that the community is funding -- a creator, charity, public good, or any cause.

### How It Works

- The recipient receives **50% of every donation** immediately via direct ERC-20 transfer.
- The recipient does not need to take any action -- funds arrive automatically whenever anyone calls `fund()`.
- The recipient address is set at construction and can be updated by the fundraiser owner after deployment.

### Constraints

- **Must be non-zero**: The constructor enforces `_recipient != address(0)`, and `setRecipient()` enforces the same check. A Fundraiser cannot operate without a recipient.
- **No special permissions**: The recipient address has no privileged role in the contract beyond receiving funds. It cannot pause the fundraiser, change parameters, or claim tokens.
- **Owner-controlled**: Only the fundraiser owner can change the recipient address via `setRecipient()`.

### Use Cases

- **Creator funding**: A community launches a Fundraiser for a content creator. The creator's address is set as the recipient. Donations fund the creator while donors earn the community token.
- **Charity**: A charity wallet is set as the recipient. Donors contribute to the cause and receive tokens representing their participation.
- **Protocol treasury**: A DAO treasury is set as the recipient, with donations serving as a fundraising mechanism that simultaneously distributes governance tokens.

---

## Launch Parameters

The following parameters are set at launch time (via `Core.launch()`) and are **immutable** once the contract is deployed.

### Fundraiser Configuration

| Parameter          | Type      | Valid Range                | Description                                                                 |
|--------------------|-----------|----------------------------|-----------------------------------------------------------------------------|
| `quoteToken`       | `address` | Any standard ERC-20        | The payment token accepted for donations (e.g., USDC). No rebasing or fee-on-transfer tokens. |
| `recipient`        | `address` | Non-zero                   | Address receiving 50% of all donations.                                      |
| `tokenName`        | `string`  | Non-empty                  | Name of the Coin (ERC-20) token created for this fundraiser.                 |
| `tokenSymbol`      | `string`  | Non-empty                  | Symbol of the Coin token.                                                    |
| `uri`              | `string`  | Non-empty                  | Initial metadata URI for the fundraiser (e.g., branding, logo).                     |
| `usdcAmount`       | `uint256` | >= `minUsdcForLaunch`      | USDC provided by the launcher to seed the initial liquidity pool.            |
| `coinAmount`       | `uint256` | > 0                        | Number of Coin tokens minted for the initial liquidity pool.                 |
| `initialEmission`  | `uint256` | `1e18` -- `1e30`           | Starting Coin token emission per epoch.                                      |
| `minEmission`      | `uint256` | `1` -- `initialEmission`   | Minimum emission floor per epoch (emission never drops below this).          |
| `halvingPeriod`    | `uint256` | 7 -- 365 (epochs)          | Number of epochs between emission halvings.                                  |
| `epochDuration`    | `uint256` | 1 hour -- 7 days           | Duration of each epoch in seconds.                                           |

### Auction Configuration

Each Fundraiser is deployed alongside an Auction contract for treasury token sales. These parameters configure that auction.

| Parameter                 | Type      | Description                                                        |
|---------------------------|-----------|--------------------------------------------------------------------|
| `auctionInitPrice`        | `uint256` | Starting price for the treasury auction.                           |
| `auctionEpochPeriod`      | `uint256` | Duration of each auction epoch (Dutch auction decay period).       |
| `auctionPriceMultiplier`  | `uint256` | Price reset multiplier after each auction purchase.                |
| `auctionMinInitPrice`     | `uint256` | Minimum starting price for the auction.                            |

### What Happens at Launch

When `Core.launch()` is called:

1. A new **Coin** ERC-20 token is deployed.
2. `unitAmount` of the Coin token is minted and paired with `usdcAmount` of USDC to create a **Uniswap V2 liquidity pool**.
3. The initial LP tokens are **burned** (sent to the dead address `0x...dEaD`), permanently locking the liquidity.
4. An **Auction** contract is deployed (configured with the auction parameters) to handle treasury token sales.
5. The **Fundraiser** contract is deployed with the emission configuration.
6. Coin minting rights are transferred to the Fundraiser (only the fundraiser can mint new Coin tokens going forward).
7. Ownership of the Fundraiser is transferred to the launcher.

---

## Owner Controls

The fundraiser owner (initially the launcher) can modify the following parameters after deployment:

### Mutable Settings

| Function            | Parameter     | Constraints                                 | Description                                                       |
|---------------------|---------------|---------------------------------------------|-------------------------------------------------------------------|
| `setRecipient()`    | `recipient`   | Cannot be `address(0)`                      | Change the address that receives 50% of donations.                |
| `setTreasury()`     | `treasury`    | Cannot be `address(0)`                      | Change the treasury address that receives ~45% of donations.      |
| `setTeam()`         | `team`        | Can be `address(0)` (disables team fees)    | Change the team address. Setting to zero redirects team fees to treasury. |
| `setUri()`          | `uri`         | Any string                                  | Update the metadata URI for the fundraiser.                              |
| `transferOwnership()` | `owner`    | Standard OpenZeppelin Ownable               | Transfer ownership of the fundraiser to a new address.                   |

### Immutable Settings (Cannot Be Changed)

The following are fixed at deployment and can never be modified:

- `unit` -- The Coin token address
- `quote` -- The payment token address
- `core` -- The Core contract address
- `startTime` -- The deployment timestamp (determines epoch boundaries)
- `initialEmission` -- The starting emission per epoch
- `minEmission` -- The emission floor
- `halvingPeriod` -- The halving schedule
- `epochDuration` -- The length of each epoch
- Fee percentages (`RECIPIENT_BPS`, `TEAM_BPS`, `PROTOCOL_BPS`, `DIVISOR`)

---

## View Functions

### `currentEpoch()`

```solidity
function currentEpoch() public view returns (uint256)
```

Returns the current epoch number since contract deployment, 0-indexed. Calculated as `(block.timestamp - startTime) / epochDuration`. Epoch 0 is the deployment epoch.

### `getEpochEmission(epoch)`

```solidity
function getEpochEmission(uint256 epoch) public view returns (uint256)
```

Returns the Coin token emission allocated to a specific epoch. Applies the halving schedule: `initialEmission >> (epoch / halvingPeriod)`, floored at `minEmission`. Can be called for any epoch number, including future epochs.

### `getPendingReward(epoch, account)`

```solidity
function getPendingReward(uint256 epoch, address account) external view returns (uint256)
```

Returns the pending (unclaimed) Coin reward for `account` on a given `epoch`. Returns `0` if:
- The epoch has not yet ended (`epoch >= currentEpoch()`).
- The account has already claimed for that epoch.
- The account did not donate in that epoch.

Otherwise, returns `(userDonation * epochEmission) / epochTotal`.

### State Mappings

These public mappings are accessible as view functions:

| Mapping                              | Returns     | Description                                                    |
|--------------------------------------|-------------|----------------------------------------------------------------|
| `epochToTotalDonated(uint256 epoch)` | `uint256`   | Total amount donated by all users in a given epoch.            |
| `epochAccountToDonation(uint256 epoch, address account)` | `uint256` | Amount donated by a specific account in a given epoch. |
| `epochAccountToHasClaimed(uint256 epoch, address account)` | `bool`   | Whether the account has already claimed for that epoch. |

### Immutable / State Getters

| Function            | Returns     | Description                                           |
|---------------------|-------------|-------------------------------------------------------|
| `coin()`            | `address`   | The Coin (ERC-20) token address.                      |
| `quote()`           | `address`   | The quote (payment) token address.                    |
| `core()`            | `address`   | The Core contract address.                                  |
| `startTime()`       | `uint256`   | The contract deployment timestamp.                    |
| `initialEmission()` | `uint256`   | The starting emission amount per epoch.               |
| `minEmission()`     | `uint256`   | The minimum emission floor per epoch.                 |
| `halvingPeriod()`   | `uint256`   | Number of epochs between halvings.                    |
| `epochDuration()`   | `uint256`   | Duration of each epoch in seconds.                    |
| `recipient()`       | `address`   | Current recipient address (receives 50% of donations).|
| `treasury()`        | `address`   | Current treasury address.                             |
| `team()`            | `address`   | Current team address (zero means disabled).           |
| `uri()`             | `string`    | Current metadata URI for the fundraiser.                     |

### Constants

| Constant               | Value    | Description                                          |
|------------------------|----------|------------------------------------------------------|
| `MIN_EPOCH_DURATION`   | `3600`   | Minimum epoch duration (1 hour).                     |
| `MAX_EPOCH_DURATION`   | `604800` | Maximum epoch duration (7 days).                     |
| `MIN_HALVING_PERIOD`   | `7`      | Minimum allowed halving period (epochs).             |
| `MAX_HALVING_PERIOD`   | `365`    | Maximum allowed halving period (epochs).             |
| `MIN_INITIAL_EMISSION` | `1e18`   | Minimum allowed initial emission.                    |
| `MAX_INITIAL_EMISSION` | `1e30`   | Maximum allowed initial emission.                    |
| `RECIPIENT_BPS`        | `5000`   | Recipient fee in basis points (50%).                 |
| `TEAM_BPS`             | `400`    | Team fee in basis points (4%).                       |
| `PROTOCOL_BPS`         | `100`    | Protocol fee in basis points (1%).                   |
| `DIVISOR`              | `10000`  | Basis point divisor.                                 |
| `MIN_DONATION`         | `10000`  | Minimum donation amount in raw token units.          |

---

## Events

### `Fundraiser__Funded`

Emitted when a donation is made via `fund()`.

```solidity
event Fundraiser__Funded(address sender, address indexed funder, uint256 amount, uint256 epoch, string uri);
```

| Parameter | Indexed | Description                                                        |
|-----------|---------|--------------------------------------------------------------------|
| `sender`  | No      | The address that called `fund()` and paid the tokens (`msg.sender`). |
| `funder`  | Yes     | The account credited for the donation (will claim Coin tokens).    |
| `amount`  | No      | The total donation amount in quote token units.                    |
| `epoch`   | No      | The epoch number the donation was recorded in.                     |
| `uri`     | No      | The metadata URI string attached to this donation.                 |

### `Fundraiser__Claimed`

Emitted when Coin tokens are claimed for a completed epoch via `claim()`.

```solidity
event Fundraiser__Claimed(address indexed account, uint256 amount, uint256 epoch);
```

| Parameter | Indexed | Description                                                  |
|-----------|---------|--------------------------------------------------------------|
| `account` | Yes     | The account that received the claimed Coin tokens.           |
| `amount`  | No      | The number of Coin tokens minted and sent to the account.    |
| `epoch`   | No      | The epoch number that was claimed.                           |

### `Fundraiser__TreasuryFee`

Emitted on every `fund()` call when the treasury fee is transferred.

```solidity
event Fundraiser__TreasuryFee(address indexed treasury, uint256 indexed epoch, uint256 amount);
```

| Parameter  | Indexed | Description                                        |
|------------|---------|----------------------------------------------------|
| `treasury` | Yes     | The treasury address that received the fee.        |
| `epoch`    | Yes     | The epoch number when the fee was collected.       |
| `amount`   | No      | The treasury fee amount in quote token units.      |

### `Fundraiser__TeamFee`

Emitted on `fund()` calls when the team fee is transferred (only if `team != address(0)`).

```solidity
event Fundraiser__TeamFee(address indexed team, uint256 indexed epoch, uint256 amount);
```

| Parameter | Indexed | Description                                    |
|-----------|---------|-------------------------------------------------|
| `team`    | Yes     | The team address that received the fee.         |
| `epoch`   | Yes     | The epoch number when the fee was collected.    |
| `amount`  | No      | The team fee amount in quote token units.       |

### `Fundraiser__ProtocolFee`

Emitted on `fund()` calls when the protocol fee is transferred (only if `protocol != address(0)`).

```solidity
event Fundraiser__ProtocolFee(address indexed protocol, uint256 indexed epoch, uint256 amount);
```

| Parameter  | Indexed | Description                                      |
|------------|---------|--------------------------------------------------|
| `protocol` | Yes     | The protocol fee address that received the fee.  |
| `epoch`    | Yes     | The epoch number when the fee was collected.     |
| `amount`   | No      | The protocol fee amount in quote token units.    |

### `Fundraiser__RecipientSet`

Emitted when the owner changes the recipient address.

```solidity
event Fundraiser__RecipientSet(address indexed recipient);
```

| Parameter   | Indexed | Description                          |
|-------------|---------|--------------------------------------|
| `recipient` | Yes     | The new recipient address.           |

### `Fundraiser__TreasurySet`

Emitted when the owner changes the treasury address.

```solidity
event Fundraiser__TreasurySet(address indexed treasury);
```

| Parameter  | Indexed | Description                          |
|------------|---------|--------------------------------------|
| `treasury` | Yes     | The new treasury address.            |

### `Fundraiser__TeamSet`

Emitted when the owner changes the team address.

```solidity
event Fundraiser__TeamSet(address indexed team);
```

| Parameter | Indexed | Description                                                  |
|-----------|---------|--------------------------------------------------------------|
| `team`    | Yes     | The new team address (or `address(0)` to disable team fees). |

### `Fundraiser__UriSet`

Emitted when the owner updates the metadata URI.

```solidity
event Fundraiser__UriSet(string uri);
```

| Parameter | Indexed | Description                |
|-----------|---------|----------------------------|
| `uri`     | No      | The new metadata URI.      |
