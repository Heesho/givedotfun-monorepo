# Security and Trust Assumptions

## Immutability

All give.fun contracts are **non-upgradeable**. There are no proxy patterns, no upgrade mechanisms, and no admin keys that can alter contract logic. Once a fundraiser is deployed, its code cannot be changed.

The following parameters are set at deployment and can never be modified:

- Emission parameters (`initialEmission`, `minEmission`, `halvingPeriod`)
- Fee percentages (hardcoded as constants in the contract)
- Quote token address
- Coin token address
- Auction configuration

---

## Locked Liquidity

When a token is launched, initial liquidity is created on Uniswap V2 by pairing USDC with the newly minted Coin token. The resulting LP tokens are **burned** -- sent to the dead address (`0x000...dEaD`). This means:

- Liquidity can never be pulled or rugged by the launcher.
- The trading pair has a permanent liquidity floor.
- The Auction contract further burns LP tokens on every treasury purchase, continuously increasing the liquidity floor per remaining LP token.

---

## Permissionless

Anyone can launch a fundraiser on give.fun. There are no allowlists, no KYC requirements, and no gatekeeping. The only requirement is providing a minimum amount of USDC for initial liquidity. All parameters and token configurations are available to any address.

---

## Owner Capabilities

Each fundraiser has an owner (the launcher). The owner has limited administrative control -- they can adjust operational parameters but cannot alter the core economics or access user funds.

### What the Owner CAN Do

| Capability | Fundraiser |
|-----------|---------|
| Change treasury address | Yes |
| Change team address (or disable) | Yes |
| Change metadata URI | Yes |
| Change recipient address | Yes |

### What the Owner CANNOT Do

- **Change emission rates** -- `initialEmission`, `minEmission`, and `halvingPeriod` are immutable.
- **Change fee percentages** -- Fee splits are hardcoded constants (50/45/4/1).
- **Halt or pause the fundraiser** -- There is no pause mechanism. Fundraisers run indefinitely.
- **Withdraw user funds** -- Donations are distributed immediately on deposit.
- **Change the quote token or coin token** -- These are immutable.
- **Modify the Auction contract** -- Auction parameters are set at deployment and cannot be changed.

---

## Trust Assumptions

### Quote Token (USDC)

The quote token is assumed to be a **standard ERC20** with no unusual behaviors:

- No fee-on-transfer (the contract does not account for transfer fees reducing received amounts).
- No rebasing (balances are assumed to remain stable between transactions).
- Standard `approve` / `transferFrom` behavior.

Using a non-standard ERC20 as the quote token may result in incorrect fee calculations, stuck funds, or broken auction mechanics.

### Uniswap V2 Router

The Uniswap V2 router is trusted for initial LP creation during fundraiser launches. The router is called by Core to add liquidity and create the Coin/USDC trading pair.

---

## Known Design Trade-offs

### Fundraiser

- **Epoch granularity.** Emissions are calculated per epoch (based on `block.timestamp` and configurable `epochDuration`). Donations made near the end of an epoch compete with all donations from that entire epoch. There is no intra-epoch emission weighting.

### Auction

- **Free claims at epoch expiry.** If the full `epochPeriod` passes without a purchase, the Dutch auction price reaches 0. The next buyer can claim all accumulated assets for free (paying 0 LP tokens). This is intentional -- it incentivizes timely purchases and prevents assets from becoming permanently stuck.

---

## Security Measures

### Reentrancy Protection

All state-changing external functions across every contract use OpenZeppelin's `ReentrancyGuard` (`nonReentrant` modifier). This prevents reentrant calls from exploiting intermediate state during external token transfers.

### Safe Token Transfers

All ERC20 interactions use OpenZeppelin's `SafeERC20` library, which:

- Handles tokens that do not return a boolean on `transfer` / `transferFrom`.
- Reverts on failed transfers instead of silently succeeding.

### Checks-Effects-Interactions Pattern

All contracts follow the Checks-Effects-Interactions (CEI) pattern:

1. **Checks** -- Validate all inputs and preconditions.
2. **Effects** -- Update contract state.
3. **Interactions** -- Perform external calls (token transfers).

Fundraiser's `claim()` function explicitly marks the claim as completed (`epochAccountToHasClaimed[epoch][account] = true`) before minting tokens.

### Front-Run Protection

Multiple layers of protection against front-running and sandwich attacks on auction operations:

| Protection | Mechanism | Applies To |
|-----------|-----------|------------|
| **Epoch ID matching** | Transaction reverts if `epochId` does not match the current epoch. | Auction `buy()` |
| **Deadline checks** | Transaction reverts if `block.timestamp > deadline`. | Auction `buy()` |
| **Slippage protection** | `maxPaymentTokenAmount` caps the maximum the user will pay. | Auction `buy()` |

### Supply Cap (Coin Token)

The Coin token extends OpenZeppelin's `ERC20Votes`, which enforces a maximum total supply of `type(uint224).max` (approximately 2.7 * 10^49 tokens). Any mint that would exceed this cap will revert.

### Minting Restriction (Coin Token)

Only the designated fundraiser address can mint Coin tokens. The fundraiser address is locked permanently after it is set via `setMinter()` -- this function can only be called once, and since the Fundraiser contracts have no `setMinter()` function, the minting authority becomes effectively immutable after launch.
