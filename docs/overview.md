# give.fun Overview

## What is give.fun?

give.fun is a perpetual funding platform on Base -- crypto GoFundMe. Communities can create fundraisers for creators, charities, or projects. Donors contribute USDC and earn proportional Coin token emissions in return. 50% of every donation goes directly to the designated recipient.

The platform runs as a Farcaster mini-app. Anyone can launch a fundraiser by pairing it with USDC to create initial liquidity on Uniswap V2. That initial liquidity is permanently locked: LP tokens are burned to the dead address (`0x000000000000000000000000000000000000dEaD`), meaning liquidity can never be withdrawn by anyone.

All contracts are deployed on Base (chain ID 8453) and are non-upgradeable. Once a fundraiser is launched, its distribution parameters are immutable.

## How It Works

Every fundraiser launch on give.fun creates three interconnected contracts:

- **Fundraiser** -- The distribution mechanism that emits tokens through epoch-based donation pools. Donors contribute USDC and earn proportional token emissions.
- **Coin** -- The ERC20 token itself. Each launch creates a new token with permit and voting (ERC20Votes) capabilities. Only the fundraiser can mint new tokens, and this minting authority is permanently locked at launch.
- **Auction** -- A Dutch auction contract that accumulates treasury fees from the fundraiser and sells them to buyers in exchange for LP tokens, which are then burned.

### The Launch Flow

1. A launcher provides USDC and specifies their token parameters (name, symbol, initial supply, emission schedule, recipient).
2. A Coin token is deployed and paired with the launcher's USDC to create a Uniswap V2 liquidity pool.
3. The LP tokens from that pool are burned permanently -- no one can pull the liquidity.
4. A Fundraiser is deployed with the chosen parameters. The fundraiser becomes the sole minter of the Coin token.
5. An Auction contract is deployed to handle treasury fee distribution.
6. Ownership of the fundraiser transfers to the launcher, who can adjust operational parameters (treasury address, team address, metadata) but cannot change the core mechanics.

From that point forward, the fundraiser distributes tokens according to its programmed rules. Donors contribute USDC to epoch pools and earn Coin tokens proportional to their contribution.

## Key Properties

- **Immutable mechanics.** Once a fundraiser is deployed, its core parameters (emission rate, halving schedule) cannot be changed. The launcher chooses these at creation time and they are locked forever.

- **Permanently locked liquidity.** Initial LP tokens are burned to the dead address. There is no admin key, no timelock, and no mechanism to withdraw the liquidity.

- **Permissionless launches.** Anyone can launch a fundraiser by providing the minimum required USDC. There is no approval process, whitelist, or governance vote required.

- **Non-upgradeable contracts.** All contracts (Core, Fundraiser, Coin, Auction, Factories) are deployed without proxy patterns.

- **Fair distribution through donations.** Tokens are not pre-sold or airdropped. They are earned through participation -- donating to fund a cause and receiving tokens proportional to your contribution.

## Fundraiser (Donations)

Users donate a payment token into epoch pools. After each epoch ends, donors claim their proportional share of that epoch's Coin emission based on how much they contributed relative to total donations. Donations are split instantly: 50% to the recipient, 45% to treasury, 4% to team, 1% to protocol. Emissions halve on a configurable schedule measured in epochs.

[Read more: Fundraiser](./fundraiser.md)
