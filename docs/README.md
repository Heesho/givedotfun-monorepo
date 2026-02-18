# Farplace Documentation

Farplace is a gamified token launchpad on Base. Instead of traditional token sales, tokens are distributed through interactive mechanisms -- mining, spinning, and funding.

## Table of Contents

### Getting Started

- [Overview](./overview.md) -- What is Farplace, how it works, key properties
- [Architecture](./architecture.md) -- System design, contract hierarchy, launch flow, fee architecture
- [Launch Guide](./launch-guide.md) -- Parameter reference and recommendations for launching a token

### Rig Types

- [MineRig](./mine-rig.md) -- Competitive slot mining with Dutch auction pricing and Bitcoin-like halvings
- [SpinRig](./spin-rig.md) -- Slot machine with VRF-powered payouts from a growing prize pool
- [FundRig](./fund-rig.md) -- Donation-based distribution with daily emission pools

### Reference

- [Auction](./auction.md) -- Treasury Dutch auction for selling accumulated tokens
- [Security](./security.md) -- Trust assumptions, known trade-offs, and security measures

## Quick Links

| Topic | Description |
|---|---|
| [Fee Splits](./architecture.md#fee-architecture) | How fees are distributed for each rig type |
| [Halving Schedules](./mine-rig.md#halving-schedule) | MineRig supply-based vs SpinRig/FundRig time-based halvings |
| [VRF Integration](./mine-rig.md#ups-multipliers-vrf) | Pyth Entropy randomness for multipliers and spin payouts |
| [Owner Controls](./security.md#owner-capabilities) | What rig owners can and cannot change post-deployment |
| [Parameter Recommendations](./launch-guide.md#parameter-recommendations) | Guidance on choosing good launch parameters |

## Tech Stack

- **Chain**: Base (chain ID 8453)
- **Contracts**: Solidity 0.8.19, Hardhat, OpenZeppelin, Solmate, Pyth Entropy
- **Frontend**: Next.js, React, TypeScript, wagmi/viem
- **Indexing**: The Graph (AssemblyScript)
- **Integration**: Farcaster mini-app
