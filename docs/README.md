# give.fun Documentation

give.fun is a perpetual funding platform on Base -- crypto GoFundMe. Instead of traditional token sales, tokens are distributed through donation-based fundraisers where communities fund recipients and earn proportional token emissions.

## Table of Contents

### Getting Started

- [Overview](./overview.md) -- What is give.fun, how it works, key properties
- [Architecture](./architecture.md) -- System design, contract hierarchy, launch flow, fee architecture
- [Launch Guide](./launch-guide.md) -- Parameter reference and recommendations for launching a fundraiser

### Reference

- [Fundraiser](./fundraiser.md) -- Donation-based distribution with epoch emission pools
- [Auction](./auction.md) -- Treasury Dutch auction for selling accumulated tokens
- [Security](./security.md) -- Trust assumptions, known trade-offs, and security measures

## Quick Links

| Topic | Description |
|---|---|
| [Fee Splits](./architecture.md#fee-architecture) | How fees are distributed |
| [Halving Schedules](./fundraiser.md#emission-schedule) | Epoch-based emission halvings |
| [Owner Controls](./security.md#owner-capabilities) | What fundraiser owners can and cannot change post-deployment |
| [Parameter Recommendations](./launch-guide.md#parameter-recommendations) | Guidance on choosing good launch parameters |

## Tech Stack

- **Chain**: Base (chain ID 8453)
- **Contracts**: Solidity 0.8.19, Hardhat, OpenZeppelin, Solmate
- **Frontend**: Next.js, React, TypeScript, wagmi/viem
- **Indexing**: The Graph (AssemblyScript)
- **Integration**: Farcaster mini-app
