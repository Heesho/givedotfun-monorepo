# Finding Drafts (Working Set)

## Confirmed finding: Multicall helper assumes exact-input token transfers for non-standard ERC20s

- Severity: Medium
- Status: Confirmed
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Fundraiser.sol:173-210`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:102-115`

### Why this is a problem

The fundraiser and multicall split path uses `amount` as the canonical value at every step, with no on-chain delta accounting:

- `Fundraiser.fund` pulls `amount` from `msg.sender`, then computes all fee splits from `amount` (`Fundraiser.sol:179-203`).
- `Multicall.fund` pulls `amount` from user and approves exactly `amount` for the fundraiser (`Multicall.sol:111-114`).

For fee-on-transfer, rebasing, or deflationary quote tokens, `safeTransferFrom` into `Multicall` can leave it with `< amount`, so the downstream pull/allowance path fails or creates accounting mismatches.

### Exploit / failure sequence

1. Attacker deploys/uses a fundraiser where quote token has transfer fee semantics.
2. User calls `Multicall.fund(fundraiser, account, X, uri)`.
3. `Multicall` receives `X - fee` from user.
4. `Multicall` attempts to call `Fundraiser.fund(..., X, ...)`, which requires pulling `X` from `Multicall`.
5. Transfer into fundraiser reverts with insufficient balance/allowance behavior.

### Impact

- Donation UX failure and blocked fundraising for non-standard quote token behaviors.
- Potential inconsistency between intended and received value when integrations assume fundraiser-level accounting from user input only.

### Patch direction (code-level)

- In `Fundraiser.fund`, measure actual received value:
  - capture `quoteBalanceBefore = IERC20(quote).balanceOf(address(this))`
  - transfer from payer
  - capture `quoteBalanceAfter`
  - set `uint256 received = quoteBalanceAfter - quoteBalanceBefore`
  - use `received` for split math and state updates
- In `Multicall.fund`, pass a deterministic on-chain `receivedAmount` into `Fundraiser.fund` after transfer into helper.
- In all such paths, reject donation if `received < MIN_DONATION`.

## Confirmed finding: `Multicall.launch` has same exact-input forwarding failure mode

- Severity: Medium
- Status: Confirmed
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:195-221`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:171-211`

### Why this is a problem

`Multicall.launch` transfers and approves `params.usdcAmount` for exact forwarding to `Core.launch` without validating the real received amount in helper custody:
- `Multicall.sol:195-199`, `Core.sol:179-183`.

If a non-standard USDC-like token or fee-on-transfer token is used as launch token, `Core.launch` can fail while user funds are partially locked/consumed by token mechanics.

### Exploit / failure sequence

1. Launcher calls `Multicall.launch` with a non-standard token.
2. Multicall receives less than `params.usdcAmount`.
3. Core attempts to consume exactly `params.usdcAmount`.
4. Launch reverts; helper cannot complete flow.

### Patch direction

- Mirror the exact-received amount before forwarding.
- Revert if helper balance delta is below expected minimum.
- Return explicit values for forwarded amount and resulting fundraiser address if supported by API design.

## Confirmed finding: `Multicall.buy` shares the same assumptions for LP token transfers

- Severity: Medium
- Status: Confirmed (defensive class)
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:162-179`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Auction.sol:107-151`

### Why this is a problem

`Multicall.buy` takes `price` from `IAuction.getPrice()` and immediately forwards that exact `price` of LP tokens from user to auction (`Multicall.sol:170-173`).

`Auction.buy` then transfers exactly `paymentAmount` from `msg.sender` (`Multicall`) (`Auction.sol:123`).

With non-standard LP token mechanics, this path can fail mid-auction or allow underflow-like funding mismatch if token semantics differ.

### Exploit / failure sequence

1. User calls `Multicall.buy` using a non-standard LP token.
2. Fee-on-transfer causes helper custody to be `< price`.
3. `Auction.buy` reverts on `safeTransferFrom` due to shortfall.

### Patch direction

- Apply the same received-amount accounting pattern in `Multicall.buy`.
- Use observed post-transfer balance delta for payment approval and pass max payment via actual received value.

## Design-acknowledged constraint: fundraiser quote token is USDC/6-decimal only

- Severity: Informational / Design
- Status: Acknowledged (No smart-contract bug; off-chain integration expectation)
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/subgraph/src/fundraiser.ts`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/app/lib/contracts.ts`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/subgraph/src/pair.ts`

### Why this is a risk

Off-chain components hardcode 6-decimal assumptions in multiple places (eg. constant scaling and Coin price math). This is not a smart-contract vulnerability, but an off-chain accuracy risk if non-6-decimal quote tokens are introduced.

### Policy acknowledgment

The protocol is operating under USDC-only policy for quote/payment token flows. Under this policy, this finding is accepted and out of scope for on-chain threat analysis.

### Patch direction

- Keep these assumptions explicit in product/docs and enforce them at launch/UI boundaries.
- If multi-token support is added later, read decimals dynamically from token contracts and normalize on-chain raw units in a token-agnostic way before rendering user-facing values.

## Design-acknowledged constraint: Core launch liquidity is USDC-paired while quote token can differ

- Severity: Informational / Design
- Status: Acknowledged (No smart-contract exploit; architecture/documentation scope)
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:39-50`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:171-208`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:260-265`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:191-221`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/interfaces/ICore.sol:1-34`

### Why this is a design boundary

`Core.launch` keeps the USDC path immutable for LP provisioning (`usdcToken`, `usdcAmount`, and `addLiquidity` with `coin/usdcToken`) but allows `LaunchParams.quoteToken` to be arbitrary (`params.quoteToken`) for fundraiser donation flows.

This is only a risk if the protocol later permits quote tokens that are not the USDC-centric LP/financial model.

### Policy acknowledgment

Current deployment and UI flow are USDC-centric (`packages/app/lib/contracts.ts` uses USDC for launch and balances; off-chain code assumes USDC for LP math and user display). This mismatch is therefore accepted as intended architecture.

### Operational recommendation

- Keep this architecture explicit in product docs and validation checks.
- If non-USDC donations are introduced later, define whether LP provisioning should remain USDC-paired or shift to the chosen donation token and refactor treasury/auction accounting accordingly.
