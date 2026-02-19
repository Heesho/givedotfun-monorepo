# give.fun (givedotfun)

## Project Overview

give.fun is a crypto GoFundMe -- a perpetual funding platform on Base. Communities can create fundraisers for creators, charities, or projects, where donors contribute USDC and earn proportional Unit token emissions in return. 50% of every donation goes directly to the recipient, with the rest split among treasury, team, and protocol. The platform runs as a Farcaster mini-app.

Each fundraiser launch creates a **Fundraiser** (the distribution mechanism), a **Unit** (the ERC20 token), and an **Auction** (for treasury sales). Initial liquidity is permanently locked (LP tokens burned to dead address).

## How It Works

Users donate a payment token (USDC) into daily pools via a Fundraiser contract. Donations are split immediately: 50% to the designated recipient, 45% to treasury, 4% to team, 1% to protocol. After each day ends, donors claim their proportional share of that day's Unit token emission based on their contribution relative to total donations. Emissions halve on a configurable schedule.

## Tech Stack

- **Monorepo**: Yarn workspaces
- **Frontend** (`packages/app`): Next.js 16, React 19, TypeScript, TailwindCSS, Radix UI, wagmi/viem
- **Smart Contracts** (`packages/hardhat`): Solidity 0.8.19, Hardhat, OpenZeppelin, Solmate
- **Indexing** (`packages/subgraph`): The Graph (AssemblyScript)
- **Target Chain**: Base (chain ID 8453)
- **Integration**: Farcaster mini-app (via @farcaster/miniapp-sdk)

## Coding Conventions

- TypeScript for frontend, Solidity for contracts
- Use yarn for package management
- Frontend uses shadcn/ui components with Radix primitives
- Contract tests use Hardhat with Chai matchers

## Project Structure

```
packages/
├── app/              # Next.js frontend (Farcaster mini-app)
│   ├── app/          # App router pages
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   └── lib/          # Utilities, constants, contract ABIs
├── hardhat/          # Solidity smart contracts
│   ├── contracts/
│   │   ├── Registry.sol          # Central registry for all fundraisers
│   │   ├── Unit.sol              # ERC20 token created per launch
│   │   ├── UnitFactory.sol       # Deploys Unit tokens
│   │   ├── Auction.sol           # Dutch auction for treasury sales
│   │   ├── AuctionFactory.sol    # Deploys Auctions
│   │   └── rigs/
│   │       └── fundraiser/       # FundraiserCore, Fundraiser, FundraiserFactory, FundraiserMulticall
│   ├── scripts/      # Deployment and verification scripts
│   └── tests/        # Contract test suites
└── subgraph/         # The Graph indexer
    ├── src/
    │   ├── cores/    # FundraiserCore launch handlers
    │   ├── rigs/     # Fundraiser event handlers
    │   ├── pair.ts   # Uniswap V2 pair price/volume tracking
    │   └── unit.ts   # ERC20 transfer tracking
    ├── abis/         # Contract ABIs
    └── schema.graphql
```

## Key Contracts

- **Registry.sol**: Central registry for all fundraisers. Only approved factories (Core contracts) can register fundraisers.
- **FundraiserCore.sol**: Entry point for launching fundraisers. Handles token creation, LP setup, and fundraiser deployment. Approved as a factory in the Registry.
- **Fundraiser.sol**: The donation-based distribution mechanism. Handles daily pools, emissions, and fee splits.
- **Unit.sol**: ERC20 token created for each launch. Mintable only by its parent fundraiser.
- **Auction.sol**: Dutch auction for treasury token sales (separate from the fundraiser mechanism).
- **FundraiserMulticall.sol**: Read helper for batched frontend queries.
- **Factories**: UnitFactory, AuctionFactory, FundraiserFactory deploy child contracts.

## Development Commands

```bash
# Frontend
cd packages/app && npm run dev

# Contracts
cd packages/hardhat && npx hardhat test
cd packages/hardhat && npm run deploy

# Subgraph
cd packages/subgraph && yarn codegen && yarn build
cd packages/subgraph && yarn deploy
```

## Development Notes

- Payments are in USDC (configurable quote token per fundraiser), tokens are paired with USDC for LP
- Initial LP tokens are burned (sent to dead address) - liquidity cannot be pulled
- Launchers must provide a minimum amount of USDC to create a fundraiser
- Emission rates halve on a schedule until hitting a configurable floor
- Fee splits go to: recipient (50%), treasury (45%), team (4%), and protocol (1%)
- This is a Farcaster mini-app deployed on Base
