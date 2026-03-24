# GiveDotFun Production Smart Contract Audit

Date: 2026-03-23

## Executive Summary

I reviewed the launchpad contracts in `packages/hardhat/contracts`, the Hardhat deployment path, and the app surfaces that directly affect contract trust assumptions.

This pass did not find an unprivileged critical drain in the core `Core` / `Fundraiser` / `Auction` / `Coin` flow under the current USDC-first model. It did find one high-severity trust issue, one medium-severity token-semantics issue, two low-severity read-path issues, and two production blockers outside the Solidity source.

Most important conclusion before mainnet launch:

1. A fundraiser launcher can still redirect future donation flows after launch.
2. The app currently tells users fundraisers are immutable, which is not true for payout routing.
3. The checked-in production config still points at mock USDC and still exposes a mock mint path.

No contract code was changed during this review. The only file added in this pass is this report.

## Scope

Reviewed contracts:

- `packages/hardhat/contracts/Core.sol`
- `packages/hardhat/contracts/Fundraiser.sol`
- `packages/hardhat/contracts/Auction.sol`
- `packages/hardhat/contracts/Multicall.sol`
- `packages/hardhat/contracts/Coin.sol`
- `packages/hardhat/contracts/CoinFactory.sol`
- `packages/hardhat/contracts/FundraiserFactory.sol`
- `packages/hardhat/contracts/AuctionFactory.sol`
- `packages/hardhat/contracts/interfaces/*`

Also reviewed because they materially affect production safety:

- `packages/hardhat/scripts/deploy.js`
- `packages/app/lib/contracts.ts`
- `packages/app/app/info/page.tsx`
- `packages/app/components/admin-modal.tsx`
- `packages/app/app/fundraiser/[address]/client-page.tsx`
- `packages/app/components/auction-modal.tsx`
- `packages/app/app/profile/page.tsx`

## Method

- Manual line-by-line review of contract logic and trust boundaries.
- Review of the existing Hardhat test suite and hostile-token tests.
- Local execution of `npx hardhat test` in `packages/hardhat`.
- Result: `183 passing`.

I did not modify contracts or attempt live on-chain verification in this pass.

## Findings Summary

| ID | Severity | Title |
|---|---|---|
| H-01 | High | Launcher can redirect future donations and bypass the auction path after launch |
| M-01 | Medium | Exact-amount token assumptions break unsupported ERC20 and LP token flows |
| L-01 | Low | Multicall price helpers use raw pair balances and can be manipulated in the UI |
| L-02 | Low | Unbounded multicall range reads are gas-fragile |
| O-01 | Production blocker | App and deploy config still point at mock USDC and expose a mint flow |
| O-02 | Production blocker | Core ownership transfer to multisig is optional and currently commented out |

## Detailed Findings

### H-01: Launcher can redirect future donations and bypass the auction path after launch

Severity: High

Affected code:

- `packages/hardhat/contracts/Fundraiser.sol:249-272`
- `packages/hardhat/contracts/FundraiserFactory.sol:35-39`
- `packages/hardhat/contracts/Core.sol:230-239`
- `packages/app/components/admin-modal.tsx:214-240`
- `packages/app/app/info/page.tsx:11-14`
- `packages/app/app/info/page.tsx:61-69`

Why this matters:

`Core.launch()` sets the fundraiser owner to `params.launcher`. That owner can later call:

- `setRecipient(...)`
- `setTreasury(...)`
- `setTeam(...)`

Those three setters let the launcher change where future donations go. In practice, the launcher can do all of the following after users have already been told the fundraiser is live:

1. Set `recipient = address(0)`, which redirects the 50% recipient share into treasury.
2. Set `treasury = attacker-controlled address`, bypassing the auction entirely.
3. Set `team = attacker-controlled address`.

After that change, future donations route as:

- 95% to the new treasury address
- 4% to the new team address
- 1% to protocol

That means the launcher can redirect 99% of future donor funds with a single owner key.

Why this is worse than a normal "owner can change config" note:

- The app currently says "All contracts are immutable — nobody can change the rules" and "Everything is configured at launch and locked forever — fully immutable".
- The admin UI already exposes `setTreasury`, `setTeam`, and `setRecipient`, so this is not theoretical.

Impact:

- Donors cannot safely assume the advertised payout routing remains fixed after launch.
- The 45% treasury-to-auction path can be disabled for future donations.
- Metadata can be changed at the same time, which makes social concealment easier even though the on-chain events exist.

Recommendation:

- If the intended model is trustless, make `recipient`, `treasury`, and `team` immutable after launch.
- If the intended model is launcher-administered, add a timelock or two-step delayed update flow and surface pending changes prominently in the UI.
- At minimum, remove all "fully immutable" language anywhere donors or launchers will see it.

### M-01: Exact-amount token assumptions break unsupported ERC20 and LP token flows

Severity: Medium

Affected code:

- `packages/hardhat/contracts/Fundraiser.sol:173-209`
- `packages/hardhat/contracts/Multicall.sol:102-115`
- `packages/hardhat/contracts/Multicall.sol:162-179`
- `packages/hardhat/contracts/Multicall.sol:191-220`
- `packages/hardhat/contracts/Core.sol:179-192`
- `packages/hardhat/contracts/Auction.sol:118-123`
- `docs/security.md:59-67`
- `packages/app/app/launch/page.tsx:274-280`

Why this matters:

The contracts consistently treat the requested transfer amount as canonical. They do not measure actual received balances before continuing.

Examples:

- `Fundraiser.fund()` pulls `amount`, calculates splits from `amount`, and records `amount`.
- `Multicall.fund()` pulls `amount` into the helper, then approves and forwards exactly `amount`.
- `Multicall.launch()` does the same with `params.usdcAmount`.
- `Multicall.buy()` does the same with the current LP token `price`.
- `Auction.buy()` and `Core.launch()` also consume exact stated amounts.

If any quote token or payment token is fee-on-transfer, rebasing, blocklisted, or otherwise non-standard, these paths can:

- revert unexpectedly
- mis-account requested vs received value
- under-deliver payouts
- block launch, donation, or auction execution

Current exploitability:

- The current app hardcodes `quoteToken = USDC`, which reduces the surface in the shipped UI.
- The contracts themselves do not enforce that boundary, so direct callers and future integrations can still hit it.
- Your own docs already acknowledge that non-standard tokens are unsupported. The code currently relies on that assumption rather than enforcing it.

Recommendation:

- Enforce the supported token policy on-chain if that policy is intended to remain strict.
- If flexibility is intended, switch all forwarding paths to balance-delta accounting and use observed received amounts rather than requested amounts.

### L-01: Multicall price helpers use raw pair balances and can be manipulated in the UI

Severity: Low

Affected code:

- `packages/hardhat/contracts/Multicall.sol:246-250`
- `packages/hardhat/contracts/Multicall.sol:391-393`
- `packages/app/app/fundraiser/[address]/client-page.tsx:245-260`
- `packages/app/components/auction-modal.tsx:96-102`
- `packages/app/app/profile/page.tsx:146-156`

Why this matters:

`Multicall.getFundraiser()` computes `coinPrice` from:

- `IERC20(usdc).balanceOf(lpToken)`
- `IERC20(coin).balanceOf(lpToken)`

`Multicall.getAuction()` computes `lpTokenPrice` from:

- `IERC20(usdc).balanceOf(state.lpToken)`
- `IERC20(state.lpToken).totalSupply()`

Those are raw token balances, not Uniswap V2 reserves.

On a real Uniswap V2 pair, raw balances can be skewed temporarily by direct token transfers to the pair. The app then uses those values to display:

- coin price
- market cap
- position value
- LP cost in the auction modal

That creates a cheap UI-manipulation path. A motivated actor can distort displayed valuation without changing the real reserve state used by swaps.

Impact:

- Misleading price and market-cap display.
- Misleading auction LP-cost display.
- Higher social-engineering risk around trending/profile/fundraiser pages.

Recommendation:

- Read pair reserves from the LP pair instead of raw balances.
- If reserve reads are not available in this helper, do not present the output as canonical price data.
- Prefer subgraph or reserve-based pricing over helper-balance pricing for anything user-facing.

### L-02: Unbounded multicall range reads are gas-fragile

Severity: Low

Affected code:

- `packages/hardhat/contracts/Multicall.sol:274-340`

Why this matters:

`getClaimableEpochs()` and `getTotalPendingRewards()` both allocate arrays proportional to the caller-supplied range and loop linearly across the full span.

Large ranges can cause view calls to fail in RPC environments or front-end clients even though on-chain state is fine.

Impact:

- Front-end and indexing instability for accounts with long fundraiser histories.
- Easy self-DoS through overly large query windows.

Recommendation:

- Paginate in the app and indexer.
- Add a maximum range if these helpers are meant for direct public consumption.

## Production Blockers

### O-01: App and deploy config still point at mock USDC and expose a mint flow

Severity: Production blocker

Affected code:

- `packages/hardhat/scripts/deploy.js:20-27`
- `packages/hardhat/scripts/deploy.js:50-54`
- `packages/app/lib/contracts.ts:1-6`
- `packages/app/app/profile/page.tsx:303-422`

Why this matters:

The checked-in deployment config still uses:

- `MOCK_USDC`
- `USDC_ADDRESS = MOCK_USDC`

The app also points its canonical `usdc` address at the same mock contract, and the profile page still renders a public "Mint 1000" action against the mock mint ABI.

This is not a Solidity vulnerability. It is a launch blocker.

Recommendation:

- Replace the mock token address with real Base USDC everywhere before production.
- Remove the mock mint path from any production bundle.
- Independently verify `core.usdcToken()` on the deployed contract before launch.

### O-02: Core ownership transfer to multisig is optional and currently commented out

Severity: Production blocker

Affected code:

- `packages/hardhat/scripts/deploy.js:33`
- `packages/hardhat/scripts/deploy.js:422-425`
- `packages/hardhat/scripts/deploy.js:547-550`

Why this matters:

The script defines `MULTISIG_ADDRESS`, and it includes a helper to transfer `Core` ownership, but the actual ownership-transfer call is commented out.

If the script is run as checked in, `Core` ownership stays with the deployer wallet unless someone performs a manual follow-up step.

That owner can still call:

- `setProtocolFeeAddress(...)`
- `setMinUsdcForLaunch(...)`

I did not verify the live owner on-chain in this pass, so treat this as a deployment-process blocker rather than a confirmed state of the current deployed address.

Recommendation:

- Make the ownership transfer mandatory in the deployment process.
- Verify `owner()` after deployment and before announcing production readiness.
- Use the multisig, not a hot deployer EOA, for protocol controls.

## Positive Notes

Areas that looked sound in this pass:

- No obvious unprivileged reentrancy in the core state-changing flows.
- `Coin` minter handoff is one-time and behaves as intended.
- Launch flow reverts atomically if a downstream deployment step fails.
- The test suite is materially better than average for a repo at this stage, including hostile-token and fuzz coverage.

## Launch Recommendation

I would not call this production-ready yet.

Minimum items I would clear before launch:

1. Resolve H-01 explicitly: either remove the payout-routing mutability or disclose and gate it clearly.
2. Remove all mock-USDC and mint-only staging paths from production config.
3. Make multisig ownership transfer mandatory and verify it.
4. Fix or stop using balance-based `coinPrice` / `lpTokenPrice` in the UI.

