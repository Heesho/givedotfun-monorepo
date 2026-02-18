# give.fun (givedotfun) - Adaptation Design

**Date:** 2026-02-18
**Source:** [farplace-monorepo](https://github.com/Heesho/farplace-monorepo)
**Approach:** Fork & Strip - clone farplace, remove Mine/Spin, rename to givedotfun

## Overview

give.fun is the crypto version of GoFundMe, focused on perpetual funding for charities, projects, people, agents, and other causes. Built as a Farcaster mini-app on Base.

Each "Fundraiser" deploys an ERC20 token with permanent Uniswap V2 liquidity. Donors contribute to daily pools and receive proportional token emissions. The token has a built-in halving schedule for deflationary emissions.

## Decisions

| Decision | Choice |
|----------|--------|
| Fee split | 50% recipient, 45% treasury, 4% team, 1% protocol |
| Platform | Farcaster mini-app |
| Core entity name | "Fundraiser" (not Rig/Fund/Give) |
| Chain | Base |
| Launch flow | Simplified, no type selection (only one type) |
| Contract deployment | Fresh deploy on Base |
| App pages | All kept (Browse, Create, Detail, Profile, Auctions, Info) |

## Smart Contracts

### Keep (renamed)

| Original | New Name | Purpose |
|----------|----------|---------|
| `FundRig.sol` | `Fundraiser.sol` | Core donation + emission logic |
| `FundCore.sol` | `FundraiserCore.sol` | Factory that launches fundraisers |
| `FundMulticall.sol` | `FundraiserMulticall.sol` | Batch read helper |
| `Unit.sol` | `Unit.sol` | ERC20 token per fundraiser |
| `UnitFactory.sol` | `UnitFactory.sol` | Deploys Unit tokens |
| `Auction.sol` | `Auction.sol` | Treasury fee auctions |
| `AuctionFactory.sol` | `AuctionFactory.sol` | Deploys Auction contracts |
| `Registry.sol` | `Registry.sol` | Simplified, one factory, protocol ID = "givedotfun" |

### Remove

- Entire `rigs/mine/` directory (MineRig, MineCore, MineMulticall + interfaces)
- Entire `rigs/spin/` directory (SpinRig, SpinCore, SpinMulticall + interfaces)
- `MockEntropy.sol` (Pyth VRF - only needed by Spin)
- Mine/Spin-specific interfaces

### Keep (unchanged)

- `MockCore.sol`, `MockUSDC.sol`, `MockUniswapV2.sol`, `MockWETH.sol` (test mocks)
- All Fund-related interfaces (renamed)

## Subgraph

### Data Sources

| Original | New | Purpose |
|----------|-----|---------|
| FundCore | FundraiserCore | Indexes `FundraiserCore__Launched` events |

### Templates

| Original | New | Purpose |
|----------|-----|---------|
| FundRig | Fundraiser | Tracks donations, claims |
| UniswapV2Pair | UniswapV2Pair | Tracks token price/swaps |

### Remove

- `MineCore` data source + `MineRig` template
- `SpinCore` data source + `SpinRig` template
- All Mine entities (MineRig, MineSlot, MineAction, MineClaim)
- All Spin entities (SpinRig, Spin)
- Handler files: `mineCore.ts`, `spinCore.ts`, `mineRig.ts`, `spinRig.ts`
- Generic `Rig` entity (merged into `Fundraiser`)

### Entity Renames

| Original | New |
|----------|-----|
| Protocol (id: "farplace") | Protocol (id: "givedotfun") |
| FundRig | Fundraiser |
| FundDayData | FundraiserDayData |
| FundDonor | Donor |
| FundDayDonor | DayDonor |
| FundRecipient | Recipient |

### Keep (unchanged)

- Unit, Account, Swap
- UnitMinuteData, UnitHourData, UnitDayData
- Donation

## Frontend App

### Pages

| Route | Name | Notes |
|-------|------|-------|
| `/` | Redirect | Redirects to `/explore` |
| `/explore` | Browse Fundraisers | List/search/sort fundraisers |
| `/launch` | Create Fundraiser | Simplified form, no type selection |
| `/fundraiser/[address]` | Fundraiser Detail | Donation UI, chart, leaderboard |
| `/profile` | My Profile | User's donations and fundraisers |
| `/auctions` | Auctions | Treasury fee auctions |
| `/info` | About | Info about give.fun |

### Components

**Remove:**
- `mine-modal.tsx`, `spin-modal.tsx`
- `mine-history-item.tsx`, `spin-history-item.tsx`
- Any rig-type selection UI

**Rename:**
- `fund-modal.tsx` -> `donate-modal.tsx`
- Route `/rig/[address]` -> `/fundraiser/[address]`

**Keep:**
- `trade-modal.tsx`, `price-chart.tsx`, `leaderboard.tsx`, `nav-bar.tsx`

### Hooks

**Remove:** `useRigType.ts`, `useSpinRigState.ts`
**Rename:** `useFundRigState.ts` -> `useFundraiserState.ts`
**Keep:** metadata, Farcaster, DexScreener, price history hooks

### Branding

- App name: "give.fun"
- All "Farplace" -> "give.fun"
- Farcaster manifest updated
- Meta tags, descriptions updated
- Protocol ID in GraphQL: "givedotfun"
