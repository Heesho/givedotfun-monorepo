# give.fun Smart Contracts Audit Working Notes

Scope snapshot (before further patching):
- Repository: `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo`
- Commit: `d2bc5b5`
- Tooling baseline: Solidity `0.8.19`, Hardhat config with optimizer enabled (`runs:200`, `viaIR: true`), OpenZeppelin `^4.8.0`

## 1) Contract Inventory

## Scope contracts (non-upgradeable)
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Core.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Fundraiser.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Multicall.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Auction.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/Coin.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/CoinFactory.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/FundraiserFactory.sol`
- `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/AuctionFactory.sol`
- Interface contracts under `/Users/hishamel-husseini/Documents/projects/givedotfun-monorepo/packages/hardhat/contracts/interfaces/`

## Contract summary table

| Contract | Purpose | Key state | External calls | Privileged functions | Upgradeable? | Funds at risk |
|---|---|---|---|---|---|---|
| `packages/hardhat/contracts/Core.sol` | Launch orchestrator for new fundraisers (deploys Coin/LP/Auction/Fundraiser) | `protocolFeeAddress`, `minUsdcForLaunch`, registry mappings (`fundraisers`, `isFundraiser`, `fundraiserToAuction`, `fundraiserToLP`, `fundraiserToIndex`) | SafeERC20 transfers/approvals, Uniswap V2 addLiquidity, factory deploy calls, Coin minter transfer (`safeTransferFrom`, `safeApprove`, `addLiquidity`, `ICoinFactory.deploy`, `IAuctionFactory.deploy`, `IFundraiserFactory.deploy`, `ICoin.setMinter`) | `setProtocolFeeAddress`, `setMinUsdcForLaunch` (`Ownable`) | No | USDC collected during launch, temporary custody in Core during setup |
| `packages/hardhat/contracts/Fundraiser.sol` | Epoch-based donation accounting + reward minting; donation split logic | `recipient`, `treasury`, `team`, epoch mappings (`epochToTotalDonated`, `epochAccountToDonation`, `epochAccountToHasClaimed`), immutable emission parameters | ERC20 transferFrom / transfer, `ICoin.mint` | `setRecipient`, `setTreasury`, `setTeam`, `setUri` (`Ownable`) | No | Donation token flows on each `fund`, no long-lived fundraiser treasury |
| `packages/hardhat/contracts/Multicall.sol` | Batched entrypoint/read helper for fundraiser and auction ops | `core`, `usdc` | SafeERC20 transfers/approvals, fundraiser/auction call-throughs, core launch call-through | No role-restricted privileged setters | No | Transient custody in helper contract during `fund`/`launch` |
| `packages/hardhat/contracts/Auction.sol` | Dutch auction for treasury asset liquidation | `epochId`, `initPrice`, `startTime`, immutable auction params | SafeERC20 transferFrom, SafeERC20 transfers of accumulated assets | None | No | LP token payment + treasury asset transfer-out on `buy` |
| `packages/hardhat/contracts/Coin.sol` | Reward token with permit/votes and one-time minter transfer | `minter`, `minterLocked` | ERC20 internals only | `setMinter`, `mint` | No | No pool treasury at contract level; mint-right critical for inflation control |
| `packages/hardhat/contracts/CoinFactory.sol` | Deploys Coin |
| None |
| none |
| None |
| No |
| No dedicated treasury |
| `packages/hardhat/contracts/FundraiserFactory.sol` | Deploys Fundraiser and transfers ownership |
| None |
| none |
| `new Fundraiser` then `transferOwnership` |
| None |
| No |
| No dedicated treasury |
| `packages/hardhat/contracts/AuctionFactory.sol` | Deploys Auction |
| None |
| none |
| `new Auction` |
| None |
| No |
| No dedicated treasury |

## 2) Threat Model (draft)

### Actors
- Donors, funders, third-party claimers
- Fundraiser owners (launchers)
- Core protocol owner/admin
- Attacker/MEV searcher
- Off-chain consumers (frontend, subgraph indexer)

### Trust assumptions
- Quote token is standards-compliant ERC20 (no hidden transfer mechanics unless explicitly expected)
- Uniswap V2 router/factory are canonical and behave as expected
- Admin keys are kept secure
- Off-chain indexers and frontend are for UX only and must not be trusted for truth

### Entry points & surfaces
- Admin controls: `Core.setProtocolFeeAddress`, `Core.setMinUsdcForLaunch`, fundraiser mutables in `Fundraiser`
- Donation/claim lifecycle: `Fundraiser.fund`, `Fundraiser.claim`, `Multicall.fund`, `Multicall.claim`, `Multicall.claimMultiple`
- Launch path: `Core.launch`, `Multicall.launch`
- Auction path: `Auction.buy`, `Multicall.buy`

### Critical assets
- Donation flows in fundraiser quote token
- Emission schedule and immutable parameters
- Coin minting authority and recipient routing
- Launch registry integrity (`isFundraiser`, fundraiser ↔ LP/Auction mappings)

## 3) Invariants to enforce during audit
1) No historical claim before epoch completion (fundraiser epoch math).
2) Claim-at-most-once per account per epoch.
3) Donation accounting totals and per-account shares remain internally consistent.
4) No admin function can arbitrarily mint/unback rewards or alter emission constants.
5) Auction payment protections (`deadline`, `_epochId`, `maxPaymentTokenAmount`) remain unbroken.
6) Launch flow atomicity: minted LP + registry wiring + ownership/minter transfer stay coherent.

## 4) Initial notes (from code/docs scan)
- Docs state “standard ERC20 only” for quote token in launch/funding flows.
- Current implementation includes no pausability and no upgrade pattern.
- Non-owner users cannot mint coins directly; minting is via fundraiser in `Fundraiser.claim`.

