# give.fun

A perpetual funding platform on Base -- crypto GoFundMe. Communities create fundraisers for creators, charities, and projects. Donors contribute USDC and earn proportional Unit token emissions. Initial liquidity is permanently locked.

## Overview

give.fun enables permissionless fundraiser creation. When someone launches a fundraiser on give.fun:

1. A new **Unit** token is created with minting controlled by a Fundraiser contract
2. Initial liquidity is created by pairing the Unit with USDC on Uniswap V2
3. **The LP tokens are permanently burned** - liquidity can never be pulled
4. Donors contribute USDC to daily pools and earn proportional token emissions

This creates a fair launch environment where tokens are distributed based on participation and community support.

## How It Works

### The Basic Flow

```
Creator provides USDC -> Unit token created -> LP created & burned -> Fundraiser deployed -> Users donate to earn tokens
```

1. **Launch**: A creator provides USDC to launch. The system mints initial Unit tokens, creates a Unit/USDC liquidity pool, and burns the LP tokens forever.

2. **Donating**: Users donate USDC to daily pools via the Fundraiser contract. Donations are split immediately: 50% to the recipient, 45% to treasury, 4% to team, 1% to protocol.

3. **Emissions**: Unit tokens are emitted daily according to a halving schedule. Each day's emission is split proportionally among that day's donors.

4. **Claiming**: After a day ends, donors claim their proportional share of that day's Unit token emission.

## Fundraiser

**Mechanic**: Donation-based daily pools with proportional distribution

Users donate payment tokens to daily pools. At the end of each day, donors claim their proportional share of that day's Unit emission:

```
Your reward = (your donation / total daily donations) x daily emission
```

**Fee Split on Donations**:
- **50%** to recipient
- **45%** to Treasury (remainder)
- **4%** to Team
- **1%** to Protocol

**Emission Schedule**: Halves every `halvingPeriod` days down to a configurable floor.

## Core Concepts

### Token Emissions

Unit tokens are minted by Fundraiser contracts daily. The emission rate determines how many tokens are available:

```
userReward = (userDonation * dayEmission) / dayTotalDonated
```

### Halving Schedule

Similar to Bitcoin, emission rates decrease over time (day-based halvings):

```
halvings = day / halvingPeriod
currentEmission = initialEmission >> halvings  // divide by 2^halvings
if (currentEmission < minEmission) currentEmission = minEmission
```

### Permanent Liquidity

When a token is launched:
1. Creator's USDC + minted Units create initial LP on Uniswap V2
2. LP tokens are sent to the dead address (`0x...dEaD`)
3. **Liquidity can never be removed**

This provides permanent trading liquidity and prevents rug pulls.

## Architecture

```
                                    +-------------------+
                                    |     Registry      |
                                    | (all fundraisers) |
                                    +--------+----------+
                                             |
                                    +--------v----------+
                                    | FundraiserCore    |
                                    +--------+----------+
                                             |
                                    +--------v----------+
                                    |   Fundraiser      |
                                    +--------+----------+
                                             |
                                        +----v----+
                                        |  Unit   |
                                        | (ERC20) |
                                        +---------+
```

### Key Contracts

| Contract | Description |
|----------|-------------|
| `Registry` | Central registry for all fundraisers, enables discovery |
| `Unit` | ERC20 token with mint rights controlled by its Fundraiser |
| `Auction` | Dutch auction for treasury fee collection, burns LP tokens |
| `Fundraiser` | Daily donation pools with proportional distribution |
| `FundraiserCore` | Factory/launchpad for fundraisers |
| `FundraiserMulticall` | Batch operations and view helpers |

## Fee Distribution

| Recipient | Percentage |
|-----------|-----------|
| Donation Recipient | 50% |
| Treasury (remainder) | 45% |
| Team | 4% |
| Protocol | 1% |

### Treasury Auctions

Treasury fees accumulate in an Auction contract. Users can buy all accumulated fees by paying LP tokens, which are then burned. This creates a deflationary mechanism for the LP supply.

## Technical Details

### Token Properties

**Unit Token**:
- ERC20 with ERC20Permit (gasless approvals)
- ERC20Votes (governance compatible)
- Mint rights exclusively controlled by Fundraiser contract
- Anyone can burn their own tokens

### Security Features

- Reentrancy guards on all state-changing functions
- Frontrun protection via epoch IDs and deadlines
- Slippage protection via max price parameters
- Input validation with bounds checking

### Parameter Bounds

| Parameter | Min | Max |
|-----------|-----|-----|
| Initial Emission | 1e18 | 1e30 |
| Min Emission | 1 | initialEmission |
| Halving Period | 7 days | 365 days |

## Development

### Tech Stack

- **Monorepo**: Yarn workspaces
- **Frontend**: Next.js, React, TypeScript, TailwindCSS, wagmi/viem
- **Contracts**: Solidity 0.8.19, Hardhat, OpenZeppelin, Solmate
- **Indexing**: The Graph (AssemblyScript)
- **Chain**: Base
- **Integration**: Farcaster mini-app

### Project Structure

```
packages/
├── app/              # Next.js frontend (Farcaster mini-app)
│   ├── app/          # App router pages
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   └── lib/          # Utilities, constants, ABIs
├── hardhat/          # Solidity smart contracts
│   ├── contracts/    # Core contracts
│   │   ├── rigs/
│   │   │   └── fundraiser/  # Fundraiser implementations
│   │   ├── interfaces/
│   │   └── mocks/
│   ├── scripts/      # Deployment scripts
│   └── tests/        # Contract test suites
└── subgraph/         # The Graph indexer
    ├── src/          # Mapping handlers
    └── schema.graphql
```

### Commands

```bash
# Install dependencies
yarn install

# Frontend development
cd packages/app && npm run dev

# Contract compilation
cd packages/hardhat && npx hardhat compile

# Run tests
cd packages/hardhat && npx hardhat test

# Deploy contracts
cd packages/hardhat && npm run deploy

# Subgraph
cd packages/subgraph && yarn codegen && yarn build
```

### Testing

The test suite includes:
- Unit tests for all contract functions
- Invariant tests for economic properties
- Business logic tests for fee distributions
- Edge case coverage for bounds and errors

```bash
cd packages/hardhat
npx hardhat test                           # Run all tests
npx hardhat test tests/fund/*             # Run fundraiser tests
```

---

## License

MIT
