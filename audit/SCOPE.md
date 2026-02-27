# Audit Scope

## In-scope

Primary scope:

- `packages/hardhat/contracts/Core.sol`
- `packages/hardhat/contracts/Fundraiser.sol`
- `packages/hardhat/contracts/Multicall.sol`
- `packages/hardhat/contracts/Auction.sol`
- `packages/hardhat/contracts/Coin.sol`
- `packages/hardhat/contracts/CoinFactory.sol`
- `packages/hardhat/contracts/FundraiserFactory.sol`
- `packages/hardhat/contracts/AuctionFactory.sol`
- `packages/hardhat/contracts/interfaces/*`

Out-of-scope:

- Off-chain indexers and frontend business logic are in-scope for integration-risk review only, not core protocol correctness.
- Third-party chains, RPC infrastructure, and wallet software are excluded unless they are directly called by audited contracts.

## Contract inventory

| Contract | Purpose | Key state | External calls | Privileged functions | Upgradeable? | Funds at risk |
|---|---|---|---|---|---|---|
| `Core.sol` | Launch orchestrator | `protocolFeeAddress`, `minUsdcForLaunch`, `fundraisers`, `isFundraiser`, `fundraiserToAuction`, `fundraiserToLP`, `fundraiserToIndex` | Uniswap addLiquidity; factory deploy calls; USDC transfer in launch; Coin approval/mint/minter transfer | `setProtocolFeeAddress`, `setMinUsdcForLaunch` (`Ownable`) | No | USDC collected during launch | 
| `Fundraiser.sol` | Donation pool + reward minting | `recipient`, `treasury`, `team`, epoch mappings, immutables (`coin`, `quote`, `core`, emissions, timing) | Quote token transferFrom and transfers; `ICoin.mint` | `setRecipient`, `setTreasury`, `setTeam`, `setUri` (`Ownable`) | No | Donation token in immediate split path |
| `Multicall.sol` | Batch operations and aggregated views | `core`, `usdc` | Funds forwarding to fundraiser/auction, call-throughs to Core launch, fundraiser claim/fund/buy | None | No | Transient quote-token/LP balances held only during a call |
| `Auction.sol` | Dutch treasury auction | `epochId`, `initPrice`, `startTime` | LP transferFrom from buyer, transfers all accrued assets to recipient | None | No | Auction-held assets/liquidity-payment tokens |
| `Coin.sol` | ERC20 reward token | `minter`, `minterLocked` | Standard ERC20 internals | `setMinter`, `mint` | No | Inflation risk via mint rights |
| `CoinFactory.sol` | Factory deployer | none | Deploy `Coin` | none | No | none |
| `FundraiserFactory.sol` | Fundraiser deployer | none | Deploy `Fundraiser`, transfer ownership | none | No | none |
| `AuctionFactory.sol` | Auction deployer | none | Deploy `Auction` | none | No | none |

## Function inventory (high value entry points)

- `Core.launch(LaunchParams)` (`packages/hardhat/contracts/Core.sol:171`)
- `Core.setProtocolFeeAddress` (`packages/hardhat/contracts/Core.sol:285`)
- `Core.setMinUsdcForLaunch` (`packages/hardhat/contracts/Core.sol:294`)
- `Fundraiser.fund` (`packages/hardhat/contracts/Fundraiser.sol:173`)
- `Fundraiser.claim` (`packages/hardhat/contracts/Fundraiser.sol:223`)
- `Fundraiser.setRecipient` (`packages/hardhat/contracts/Fundraiser.sol:253`)
- `Fundraiser.setTreasury` (`packages/hardhat/contracts/Fundraiser.sol:263`)
- `Fundraiser.setTeam` (`packages/hardhat/contracts/Fundraiser.sol:274`)
- `Fundraiser.setUri` (`packages/hardhat/contracts/Fundraiser.sol:283`)
- `Auction.buy` (`packages/hardhat/contracts/Auction.sol:107`)
- `Multicall.fund` (`packages/hardhat/contracts/Multicall.sol:102`)
- `Multicall.claim` (`packages/hardhat/contracts/Multicall.sol:123`)
- `Multicall.claimMultiple` (`packages/hardhat/contracts/Multicall.sol:135`)
- `Multicall.buy` (`packages/hardhat/contracts/Multicall.sol:162`)
- `Multicall.launch` (`packages/hardhat/contracts/Multicall.sol:191`)

## External dependencies in-scope

- `@openzeppelin/contracts@^4.8.0`:
  - `Ownable`, `ReentrancyGuard`, `SafeERC20`, ERC20 modules in `Coin`.
- `solmate@^6.8.0`: currently not directly referenced by audited contracts after reading `packages/hardhat/contracts`, but present in dependency manifest.
- External DEX interfaces:
  - UniswapV2-like router/factory in `IUniswapV2.sol`.

## Protocol safety boundaries

- Launch-time trust:
  - `Core` assumes deployed/untrusted quote token assumptions only through `Core.launch` preconditions and fundraiser config.
- Per-user funds:
  - `Fundraiser.fund` accounting and split logic plus immediate transfer semantics.
- Economic controls:
  - Emission parameters are immutable once `Fundraiser` is deployed.
- Upgrade risk:
  - No `proxy` or upgrade hooks are used in contract set.
