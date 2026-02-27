# GiveDotFun Protocol — Final Audit Report (Documentation Consolidation)

## Executive summary

This audit review of the `givedotfun` repository identified one confirmed on-chain finding under current assumptions, plus three findings classified as accepted design constraints.

- Confirmed security issue: `F-01` (Medium)
- Design/operational acknowledgements: `F-02`, `F-03`, `F-04`
- No smart-contract source files were modified during this phase (docs-first mode).

Primary risk posture: protocol flow is internally consistent for the currently stated USDC-first model, but `Multicall` assumes exact-input token forwarding and will fail on non-standard token types unless explicit support is added.

## Scope and assumptions

- In-scope contracts reviewed:
  - `packages/hardhat/contracts/Core.sol`
  - `packages/hardhat/contracts/Fundraiser.sol`
  - `packages/hardhat/contracts/Multicall.sol`
  - `packages/hardhat/contracts/Auction.sol`
  - `packages/hardhat/contracts/Coin.sol`
  - `packages/hardhat/contracts/CoinFactory.sol`
  - `packages/hardhat/contracts/FundraiserFactory.sol`
  - `packages/hardhat/contracts/AuctionFactory.sol`
  - Interface layer in `packages/hardhat/contracts/interfaces/*`
- Tooling references and reproducibility notes are in:
  - `audit/REPRODUCE.md`
  - `audit/TOOLS.md`
- Policy assumption (acknowledged by product): USDC-first deployment for launch/liquidity and operational reporting, as documented during review.

## Findings summary

### Confirmed finding

| ID | Title | Severity | Status | Affected code | Contract-level impact |
|---|---|---|---|---|---|
| F-01 | Multicall assumes exact-input transfer semantics for non-standard ERC20 tokens | Medium | Confirmed | `/Users/.../packages/hardhat/contracts/Multicall.sol`, `/Users/.../packages/hardhat/contracts/Fundraiser.sol`, `/Users/.../packages/hardhat/contracts/Core.sol` | Revert / blocked donation/launch/buy flows when fee-on-transfer/rebasing semantics are used; accounting mismatch risk if assumptions are violated |

### Acknowledged design constraints (not classified as exploitable protocol vulnerabilities under current policy)

| ID | Title | Severity | Status | Affected code |
|---|---|---|---|---|
| F-02 | USDC-only quote-token precision assumptions in off-chain consumers | Informational / Design | Acknowledged | `/Users/.../packages/app/lib/contracts.ts`, `/Users/.../packages/subgraph/src/fundraiser.ts`, `/Users/.../packages/subgraph/src/pair.ts` |
| F-03 | Unbounded read-path loops in Multicall view helpers | Low | Acknowledged (Not planned) | `/Users/.../packages/hardhat/contracts/Multicall.sol` |
| F-04 | USDC LP provisioning is fixed while fundraiser quote token is independently supplied | Informational / Design | Acknowledged design boundary | `/Users/.../packages/hardhat/contracts/Core.sol`, `/Users/.../packages/hardhat/contracts/Multicall.sol`, `/Users/.../packages/hardhat/contracts/interfaces/ICore.sol` |

## Confirmed finding details: F-01

- **Title:** Multicall assumes exact-input transfer semantics for non-standard ERC20 tokens
- **Status:** Confirmed (docs-only, no contract patches applied)
- **Likelihood:** Medium under non-standard token support
- **Impact:** Medium
- **Relevant evidence (exact files/lines):**
  - `Fundraiser.fund` uses user-provided `amount` for splits and state updates after pulling from `msg.sender`: `packages/hardhat/contracts/Fundraiser.sol:173-210`
  - `Multicall.fund` pulls then approves exact `amount` from caller: `packages/hardhat/contracts/Multicall.sol:111-115`
  - `Multicall.launch` pulls then approves exact `params.usdcAmount` toward `Core.launch`: `packages/hardhat/contracts/Multicall.sol:196-201`
  - `Core.launch` pulls exact `params.usdcAmount` from caller: `packages/hardhat/contracts/Core.sol:179-184`
  - `Multicall.buy` pulls then approves exact `price`: `packages/hardhat/contracts/Multicall.sol:168-179`
  - `Auction.buy` consumes exact payment from `msg.sender` (`IAuction` caller): `packages/hardhat/contracts/Auction.sol:123-128`
- **Exploit/failure sequence:**
  1. Attacker/actor uses a quote or LP token with transfer fee/rebase behavior.
  2. `Multicall.fund`, `Multicall.launch`, or `Multicall.buy` calls `safeTransferFrom` into helper and assumes full `amount` was received.
  3. Downstream contract (`Fundraiser.fund`, `Core.launch`, or `Auction.buy`) consumes the approved `amount` exactly.
  4. Transfer under-collateralized by token mechanics; downstream pull/consume reverts.
  5. Transaction fails (denial of expected action), with potential donor/admin UX breakage.
- **Why it works (root cause):**
  - No on-chain `balanceOf` delta accounting is used at forwarding boundaries.
  - Approval is set to the requested `amount`, not the observed received amount.
- **Patch direction (documented in):**
  - `/Users/.../audit/FIXES.md`
  - Measure actual token delta at each `Multicall` entrypoint and in `Fundraiser.fund`.
  - Forward only observed deltas and reject below minimum.

## Acknowledged design constraints: F-02/F-03/F-04

### F-02
- Not a contract exploit in current USDC-only policy.
- Off-chain UI/subgraph components assume 6-decimal USDC scaling in several paths.
- Kept as policy-constrained integration risk.

### F-03
- Potential read-path gas exhaustion when callers request large ranges in `getClaimableEpochs` and `getTotalPendingRewards`.
- No direct fund-loss impact.
- Accepted as low-priority operational hardening, currently out-of-scope.

### F-04
- Intentional architecture split: launch liquidity uses immutable USDC path, while fundraiser quote token is supplied as launch parameter.
- Not exploitable as protocol bug under current architecture, but flagged for future scope changes.

## Final status matrix

- `F-01` → **Unfixed in code** (documentation-only pass, patch proposal available)
- `F-02` → **Acknowledged by policy** (off-chain/design)
- `F-03` → **Acknowledged / not planned** (read-path hardening)
- `F-04` → **Acknowledged design boundary** (architecture decision)

## Deliverables

- `audit/FINAL_AUDIT_REPORT.md` (this file)
- `audit/REPORT.md` (updated summary + expanded F-04 classification)
- `audit/FINDINGS_DRAFT.md` (working set + classification updates)
- `audit/FIXES.md` (non-deploying patch proposals and test strategy)
- `audit/REPRODUCE.md` and `audit/TOOLS.md` (tooling and command notes)

## Recommended next actions

1. If you want to move F-01 from report-only to code-level hardening:
   - implement deltas/received-amount checks in:
     - `packages/hardhat/contracts/Fundraiser.sol:173-210`
     - `packages/hardhat/contracts/Multicall.sol:102-115`
     - `packages/hardhat/contracts/Multicall.sol:168-179`
     - `packages/hardhat/contracts/Multicall.sol:196-201`
   - add regression PoCs in `packages/hardhat/test/foundry` as listed in `audit/FIXES.md`.
2. If scope expands beyond USDC-only:
   - revisit `F-02/F-03/F-04` as security obligations and convert to confirmed findings.
