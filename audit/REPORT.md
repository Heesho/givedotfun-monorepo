# Audit Report — GiveDotFun Protocol Contracts

## 1) Executive Summary

The GiveDotFun contract set is non-upgradeable, permissioned at launch-time only, and implements a fundraiser + emissions + treasury auction flow with immediate split-on-donation accounting. The biggest security issue identified in this phase is **non-standard token handling at aggregation boundaries** (`Multicall`), which can cause deterministic failures and incorrect economics when fee-on-transfer, rebate, or rebasing token behavior is introduced in donation, launch, or auction payment flows.

Primary findings are concentrated around exact-input assumptions across `Fundraiser`, `Multicall`, and `Core`.  

Observed posture:
- No critical privilege escalation across on-chain modules.
- No direct reentrancy bugs due `nonReentrant` on state-mutating functions and pull/push ordering.
- Non-standard ERC20 behavior is a recurring cross-module integration risk and must be treated as a hard design boundary.

## 2) Scope

- Repository: `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo`
- Commit snapshot used for this review: `d2bc5b5`
- In-scope contracts: `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol`, `Fundraiser.sol`, `Multicall.sol`, `Auction.sol`, `Coin.sol`, factories, and interface layer.
- Off-chain review scope: `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/app` and `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/subgraph` (integration-risk only; no core protocol trust).
- Toolchain assumptions:
  - Solidity `0.8.19`
  - Hardhat config compiler: `0.8.19`, optimizer enabled (`runs:200`), `viaIR: true`
  - Package dependencies include OpenZeppelin `^4.8.0`, Solmate `^6.8.0`.

## 3) Methodology

1. Static repo-level reading and threat mapping with inventory and actors.
2. Manual review by vulnerability classes:
   - funds flow
   - ERC20 semantics and external transfer patterns
   - role/authority
   - epoch/state correctness
   - reentrancy and call ordering
   - integration assumptions (front-end / subgraph assumptions)
3. Attempted tool checks (`slither`, `semgrep`, `solhint`) and environment checks; see `audit/TOOLS.md` and `audit/REPRODUCE.md`.
4. Constructed reproducible bug narratives with preconditions and exploit paths.
5. Produced patch + testing recommendations without modifying protocol contracts.

## 4) Findings Summary

### Confirmed issues

| ID | Title | Severity | Affected Contracts/Functions | Status | Evidence/PoC |
|---|---|---|---|---|---|
| F-01 | Exact-input token forwarding fails for non-standard ERC20s | Medium | `Multicall.fund`, `Multicall.launch`, `Multicall.buy` in conjunction with `Fundraiser.fund` and `Core.launch` | Unfixed (docs only) | `audit/FINDINGS_DRAFT.md` |

### Confirmed design constraints (acknowledged by product policy)

| ID | Title | Severity | Affected Contracts/Functions | Status | Evidence/PoC |
|---|---|---|---|---|---|
| F-02 | USDC-only quote-token policy is accepted (6-decimal off-chain assumption) | Informational / Design | `packages/app/lib/contracts.ts`, `packages/subgraph/src/fundraiser.ts`, `packages/subgraph/src/pair.ts` | Acknowledged (off-chain/integration scope) | `audit/FINDINGS_DRAFT.md` |
| F-03 | Unbounded range queries in Multicall can be DoS-prone in read-path consumers | Low | `Multicall.getClaimableEpochs`, `Multicall.getTotalPendingRewards` | Acknowledged (not planned) | `audit/FINDINGS_DRAFT.md` |
| F-04 | Core launch has fixed USDC LP path while donation quote token is decoupled | Informational / Design | `Core.sol`, `Multicall.sol`, `ICore.sol` | Acknowledged design boundary | `audit/FINDINGS_DRAFT.md` |

### Best-practice improvements

- Clarify and enforce quote-token policy (USDC-only vs arbitrary ERC20) and include launch-time validation.
- Add admin controls policy guidance for protocol fees/minimum launch threshold (timelock/incident runbook).

## 5) Detailed Findings

### F-01 — Exact-input token forwarding fails for non-standard ERC20s

- Severity: Medium
- Status: Confirmed
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Fundraiser.sol:173-210`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:102-115`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:195-199`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:162-173`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:179-192`

#### Impact
Donation and launch/auction batching can be permanently blocked (and in some cases partially inconsistent) when tokens impose transfer fees, rebases, or other post-transfer balance drift.

#### Attack / failure path
1. Integrator uses a quote or LP token with transfer fee semantics.
2. Attacker or user calls `Multicall.fund`, `Multicall.launch`, or `Multicall.buy`.
3. `Multicall` transfers `amount` in and approves the exact `amount` onward (`safeTransferFrom`/`safeApprove` pattern).
4. Actual received amount in helper is `< amount` due token mechanics.
5. Downstream contract (`Fundraiser.fund` or `Core.launch` or `Auction.buy`) expects / pulls `amount` and reverts.

#### Why this works
- `Fundraiser.fund` treats `amount` as canonical at input and accounting time and transfers that exact value from caller into storage state (`amount * splits` and map updates use `amount` directly): `/Users/.../Fundraiser.sol:173-210`.
- `Multicall.fund` and `Multicall.launch` similarly forward `amount` without reconciling deltas (`safeTransferFrom` then `safeApprove(..., amount)`): `/Users/.../Multicall.sol:111-114`, `/Users/.../Multicall.sol:196-199`.
- `Multicall.buy` does the same with LP payment path: `/Users/.../Multicall.sol:170-173`.

#### Likelihood and impact
- Likelihood: Medium-high if non-standard token is used in fundraiser quote or LP path.
- Impact: High user-friction and deterministic flow failure; in launch path this can block funding initialization; in donate/auction path it blocks expected state transitions.

#### Minimal PoC (Foundry-style)
Place as `/Users/.../audit/poc/poc_multicall_nonstandard_fee.t.sol` (proposed):
1. Deploy a `FeeToken` mock with fee-on-transfer (e.g., 5% burn on transfer).
2. Deploy mock `Core` + `Fundraiser` using `FeeToken` as quote.
3. User approves and calls `Multicall.fund(fundraiser, user, 1_000e6, "")`.
4. Expect revert during `Fundraiser.fund` pull path due insufficient available amount in `Multicall`.

Repeat for `Multicall.launch` with params.usdcAmount and `Multicall.buy` with LP token that charges fees.

#### Patch recommendation
- In each multicall entrypoint, compute actual balance delta before/after pull and forward only observed value.
- In `Fundraiser.fund`, use observed received value for split/accounting (not requested argument `amount`).
- Reject donations where received is below protocol minimum.
- Add explicit error when actual forward amount changes materially (`amount - received` threshold or full equality policy depending on intended token policy).

Detailed patch plan in `/Users/.../audit/FIXES.md`.

### F-02 — USDC-only quote token is a documented design constraint

- Severity: Informational / Design
- Status: Acknowledged (off-chain/integration scope)
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/app/lib/contracts.ts:1-4` (hardcoded USDC address)
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/subgraph/src/fundraiser.ts:90`, `/Users/.../fundraiser.ts:239-269`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/subgraph/src/pair.ts:76-89`, `170-186`

#### Impact
If quote token is not USDC-like (6 decimals), indexed analytics and displayed values can be wrong even if on-chain flow succeeds. This is off-chain presentation risk, not a direct on-chain contract exploit, under current policy.

#### Why this works
Several off-chain and helper math paths hardcode 6-decimal scaling without introspecting token decimals from chain state.

#### Policy acknowledgment

Product currently enforces USDC-centric flows for launch/fund/auction flows, and this risk is accepted by policy.

#### Recommendation
- Keep the policy explicit in docs, launch/creation controls, and operator runbooks.
- If token support is later expanded beyond USDC, read decimals dynamically from token contracts and normalize all UI/index metrics from on-chain raw units.

### F-03 — Unbounded range reads in Multicall are gas-fragile

- Severity: Low
- Status: Acknowledged (Not planned)
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:274-299`
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:320-340`

#### Impact
`getClaimableEpochs` and `getTotalPendingRewards` allocate arrays proportional to caller-provided range and iterate linearly. For huge epoch windows this can exhaust call gas in public RPC contexts and break front-end queries.

#### Likelihood
Low/Medium depending on front-end usage; attacker-controlled only through API caller-provided query range.

#### Recommendation
- Operationally cap query windows in callers (UI/indexer pagination and sensible defaults).
- If support requirements change, add hard caps (`maxRange`) and pagination in a follow-up hardening pass.

### F-04 — Fixed USDC LP provisioning with independent donation quote token is intended architecture

- Severity: Informational / Design
- Status: Acknowledged (not a protocol exploit under current policy)
- Affected files:
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:39-50` (`usdcToken` immutable)
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:171-208` (USDC `addLiquidity` path)
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol:260-265` (launch event and deployment wiring)
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol:191-221` (`usdc` forwarding for launch helper)
  - `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/interfaces/ICore.sol:1-34` (quote token not used for launch liquidity)

#### Why this is not treated as a bug

- `LaunchParams.quoteToken` is used only for the fundraiser payout token in fundraiser construction.
- `Core.launch` and `Multicall.launch` rely on immutable `usdcToken` and `params.usdcAmount` for LP seeding.
- This is an intentional split between donation-revenue token and launch liquidity token as configured today.

#### Impact if unacknowledged

- If non-USDC quote policy is later introduced without broader off-chain and accounting updates, users/analytics may see mismatched valuation assumptions.

#### Recommendation
- Keep explicit policy statements in launch validation and UI.
- If quote-token universality is added, decide whether LP path should remain USDC-only or be refactored to quote-token-paired liquidity and update subgraph/UI math accordingly.

## 6) Additional recommendations and hardening notes

- Make token assumptions explicit and enforceable:
  - either reject non-standard tokens at launch/creation (`quoteToken`) or codify helper support for them in `Multicall`.
- Add explicit `MIN_DONATION` checks from observed/actual receive amounts in all donation paths.
- Add invariant suite to assert accounting invariants over event replay (see item 7).
- Add explicit event fields for forwarded vs requested token amount in `Multicall` if supporting drifted transfers.

## 7) Testing plan (proposed)

Because no contract edits were applied in this pass, these are proposed additions:

1. **Reproducible Foundry PoCs**
   - `PocFeeOnTransferFund`: `Multicall.fund` with 5% fee token should revert before patch and pass after patch with exact received amount.
   - `PocFeeOnTransferLaunch`: `Multicall.launch` with FOT token should either revert with explicit minimum check or proceed with observed amount.
   - `PocFeeOnTransferBuy`: `Multicall.buy` using FOT LP token should transfer exact received and not over-approve.

2. **Invariant tests (Foundry)**  
   - `donationAccountingInvariant`: sum of `epochAccountToDonation` per epoch equals `epochToTotalDonated` over random multi-user donation batches.
   - `claimBoundInvariant`: each `(epoch, account)` has at most one claim and cannot over-claim (`claimedAtMostOnce`).
   - `treasuryConservationInvariant`: `sum(fees)` from donation equals sum of four split events for each donation under drift-aware accounting.
   - `auctionProgressInvariant`: calling `buy` updates `(epochId, initPrice, startTime)` consistently in one transition.

3. **Fuzz targets**
   - Randomized epoch transitions and role changes under concurrent fund/claim/restart.
   - Random pause-like simulation by skipping donations and verifying no claim misalignment.
   - Randomized token decimals in helper mocks for off-chain conversion formulas.

## 8) FIXED vs UNFIXED

All findings are currently unfixed in repository state, as this phase is documentation-first:

- `F-01` Unfixed (patch proposed)
- `F-02` Acknowledged by policy (no on-chain patch required)
- `F-03` Acknowledged (not planned in current scope)
- `F-04` Acknowledged design boundary (no on-chain patch required)

## 9) Appendix

- Tooling and reproducibility: `audit/TOOLS.md`, `audit/REPRODUCE.md` (note current tool availability and command list).
- Preliminary issue notes and exact line references: `audit/FINDINGS_DRAFT.md`.
