# Security and Trust Assumptions

## Immutability

All Farplace contracts are **non-upgradeable**. There are no proxy patterns, no upgrade mechanisms, and no admin keys that can alter contract logic. Once a rig is deployed, its code cannot be changed.

The following parameters are set at deployment and can never be modified:

- Pricing parameters (`epochPeriod`, `priceMultiplier`, `minInitPrice`)
- Emission parameters (`initialUps`, `tailUps`, `halvingAmount` / `halvingPeriod`, `initialEmission`, `minEmission`)
- Fee percentages (hardcoded as constants in each contract)
- Quote token address
- Unit token address
- Auction configuration

---

## Locked Liquidity

When a token is launched, initial liquidity is created on Uniswap V2 by pairing USDC with the newly minted Unit token. The resulting LP tokens are **burned** -- sent to the dead address (`0x000...dEaD`). This means:

- Liquidity can never be pulled or rugged by the launcher.
- The trading pair has a permanent liquidity floor.
- The Auction contract further burns LP tokens on every treasury purchase, continuously increasing the liquidity floor per remaining LP token.

---

## Permissionless

Anyone can launch a token on Farplace. There are no allowlists, no KYC requirements, and no gatekeeping. The only requirement is providing a minimum amount of USDC for initial liquidity. All rig types, parameters, and token configurations are available to any address.

---

## Owner Capabilities

Each rig has an owner (the launcher). The owner has limited administrative control -- they can adjust operational parameters but cannot alter the core economics or access user funds.

### What the Owner CAN Do

| Capability | MineRig | SpinRig | FundRig |
|-----------|---------|---------|---------|
| Change treasury address | Yes | Yes | Yes |
| Change team address (or disable) | Yes | Yes | Yes |
| Change metadata URI | Yes | Yes | Yes |
| Change recipient address | -- | -- | Yes |
| Increase slot capacity (never decrease) | Yes | -- | -- |
| Toggle Pyth Entropy on/off | Yes | Yes | -- |

### What the Owner CANNOT Do

- **Change pricing parameters** -- `epochPeriod`, `priceMultiplier`, and `minInitPrice` are immutable.
- **Change emission rates** -- `initialUps`, `tailUps`, `halvingAmount`, `halvingPeriod`, `initialEmission`, and `minEmission` are immutable.
- **Change fee percentages** -- Fee splits are hardcoded constants (e.g., 80/15/4/1 for MineRig).
- **Halt or pause the rig** -- There is no pause mechanism. Rigs run indefinitely.
- **Withdraw user funds** -- MineRig miner fees use a pull-based claim pattern; the owner has no access. SpinRig prize pool tokens can only be distributed via the spin mechanism. FundRig donations are distributed immediately on deposit.
- **Change the quote token or unit token** -- These are immutable.
- **Modify the Auction contract** -- Auction parameters are set at deployment and cannot be changed.
- **Decrease MineRig capacity** -- Capacity can only increase, never decrease.

---

## Trust Assumptions

### Quote Token (USDC)

The quote token is assumed to be a **standard ERC20** with no unusual behaviors:

- No fee-on-transfer (the contract does not account for transfer fees reducing received amounts).
- No rebasing (balances are assumed to remain stable between transactions).
- Standard `approve` / `transferFrom` behavior.

Using a non-standard ERC20 as the quote token may result in incorrect fee calculations, stuck funds, or broken auction mechanics.

### Pyth Entropy (VRF)

Pyth Entropy is trusted as the source of verifiable randomness for:

- **MineRig**: Random UPS multiplier assignment (1x-10x) when a slot changes hands.
- **SpinRig**: Random payout percentage drawn from the odds array on each spin.

If Pyth Entropy becomes unavailable or goes offline:

- **MineRig**: The rig continues to function normally. The UPS multiplier defaults to 1x (no bonus). Mining, pricing, emissions, and fee distribution all work without VRF. The owner can also disable entropy via `setEntropyEnabled(false)`.
- **SpinRig**: If entropy is enabled and Pyth is unavailable, spins will revert because the VRF fee call will fail. The owner should disable entropy via `setEntropyEnabled(false)`, which activates a deterministic fallback that always uses `odds[0]` as the payout percentage.

### Uniswap V2 Router

The Uniswap V2 router is trusted for initial LP creation during rig launches. The router is called by the Core contracts (MineCore, SpinCore, FundCore) to add liquidity and create the Unit/USDC trading pair.

---

## Known Design Trade-offs

### MineRig

- **Excess ETH from entropy fees is not recoverable.** When a miner sends ETH for the Pyth Entropy VRF fee, any excess beyond the required fee remains in the MineRig contract. There is no withdrawal mechanism for this ETH.
- **UPS dilution on capacity increase.** When the owner increases slot capacity, the global UPS rate is divided across more slots. Existing miners will see their per-slot UPS decrease. This is an expected consequence of capacity scaling.
- **Constructor emits Mine event with epochId=0 but stores epochId=1.** Slot 0 is initialized in the constructor with `epochId: 1`, but the emitted `MineRig__Mine` event uses `epochId: 0`. This is a cosmetic inconsistency only -- it does not affect contract logic or state.

### SpinRig

- **Emission calculation does not integrate across halving boundaries.** The `_mintEmissions()` function uses the current UPS rate for the entire elapsed time period since the last emission. If a halving boundary was crossed during that period, the function slightly underestimates the total emissions (it uses the post-halving rate for the entire period instead of the pre-halving rate for the earlier portion). This produces a conservative estimate that mints fewer tokens than the theoretical continuous emission, marginally benefiting future spinners.

### FundRig

- **Daily granularity.** Emissions are calculated per calendar day (based on `block.timestamp`). Donations made near the end of a day compete with all donations from that entire day. There is no intra-day emission weighting.

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

### Pull-Based Claims (MineRig)

MineRig uses a pull-based claim pattern for miner fees. When a miner is displaced, their 80% fee is credited to `accountToClaimable[miner]` rather than transferred directly. The miner (or anyone on their behalf) later calls `claim()` to withdraw. This prevents:

- **Griefing via revert.** A malicious contract set as the miner address cannot block future mining by reverting on token receipt.
- **Gas limit attacks.** The mining transaction's gas cost is predictable regardless of the displaced miner's address.

### Checks-Effects-Interactions Pattern

All contracts follow the Checks-Effects-Interactions (CEI) pattern:

1. **Checks** -- Validate all inputs and preconditions.
2. **Effects** -- Update contract state.
3. **Interactions** -- Perform external calls (token transfers, VRF requests).

FundRig's `claim()` function explicitly marks the claim as completed (`dayAccountToHasClaimed[day][account] = true`) before minting tokens.

### Front-Run Protection

Multiple layers of protection against front-running and sandwich attacks:

| Protection | Mechanism | Applies To |
|-----------|-----------|------------|
| **Epoch ID matching** | Transaction reverts if `epochId` does not match the current epoch, preventing stale or replayed transactions. | Auction `buy()`, MineRig `mine()`, SpinRig `spin()` |
| **Deadline checks** | Transaction reverts if `block.timestamp > deadline`, preventing indefinite pending transactions. | Auction `buy()`, MineRig `mine()`, SpinRig `spin()` |
| **Slippage protection** | `maxPaymentTokenAmount` (Auction) and `maxPrice` (MineRig, SpinRig) cap the maximum the user will pay. | Auction `buy()`, MineRig `mine()`, SpinRig `spin()` |

### Supply Cap (Unit Token)

The Unit token extends OpenZeppelin's `ERC20Votes`, which enforces a maximum total supply of `type(uint224).max` (approximately 2.7 * 10^49 tokens). Any mint that would exceed this cap will revert, preventing supply overflow.

### Minting Restriction (Unit Token)

Only the designated rig address can mint Unit tokens. The rig address is locked permanently after it is set via `setRig()` -- this function can only be called once, and since the Rig contracts have no `setRig()` function, the minting authority becomes effectively immutable after launch.
