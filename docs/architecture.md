# System Architecture

## Overview

give.fun is composed of layered smart contracts that separate concerns between orchestration (Core), deployment (Factories), token distribution (Fundraiser), token representation (Coins), and treasury management (Auctions). All contracts are non-upgradeable and deployed on Base.

## Contract Relationship Diagram

```
                     +--------+--------+
                     |      Core       |
                     | (launch         |
                     |  orchestrator)  |
                     +--------+--------+
                              |
                              |   uses
                              |
               +--------------+--------------+--------------+
               |              |              |
      +--------v--------+  +-v-----------+  +--------v--------+
      |   CoinFactory   |  | Fundraiser  |  | AuctionFactory  |
      | (deploys Coin   |  | Factory     |  | (deploys Auction|
      |  ERC20 tokens)  |  | (deploys    |  |  contracts)     |
      +-----------------+  | Fundraisers)|  +-----------------+
                           +-------------+
```

Core holds references to CoinFactory, FundraiserFactory, and AuctionFactory.
When a launch is triggered, the Core calls all three factories to create
the full set of per-launch contracts.

Each launch creates an isolated set of contracts:

```
Per-Launch Contract Set:
+-------------------------------------------------------------------+
|                                                                   |
|  Coin (ERC20)  <--- mint only by --->  Fundraiser                 |
|       |                                     |                     |
|       +--- paired with USDC --->  LP Token  |  fees flow to:     |
|                                      |      |   - Auction (treasury) |
|                                      |      |   - Team (launcher)    |
|                                  burned to  |   - Protocol           |
|                                  dead addr  |   - Recipient (50%)    |
|                                             |                     |
|  Auction  <--- treasury fees from ----------+                     |
|    |                                                              |
|    +--- sells accumulated tokens for LP tokens                   |
|    +--- LP payment burned to dead address                        |
|                                                                   |
+-------------------------------------------------------------------+
```

## Contract Hierarchy

### Core

The Core contract is the entry point for launching new fundraisers. It orchestrates the full launch sequence and maintains its own registry of deployed fundraisers.

Responsibilities:

- Validate launch parameters (fail fast before any state changes).
- Transfer USDC from the launcher.
- Deploy a Coin token via CoinFactory.
- Create and seed the Uniswap V2 liquidity pool.
- Burn the LP tokens to the dead address.
- Deploy an Auction contract via AuctionFactory.
- Deploy a Fundraiser contract via FundraiserFactory.
- Transfer Coin minting rights to the Fundraiser (permanent, one-time lock).
- Set initial metadata URI on the fundraiser.
- Transfer fundraiser ownership to the launcher.

Core maintains its own registry of deployed fundraisers with mappings to their associated Auction contracts and LP token addresses. The Core owner can update the protocol fee address and the minimum USDC required to launch.

### Factories (CoinFactory, AuctionFactory, FundraiserFactory)

Factories are thin deployment contracts. Their sole purpose is to deploy new instances of their respective contracts.

| Factory | Deploys | Called By |
|---|---|---|
| CoinFactory | Coin (ERC20 token) | Core |
| AuctionFactory | Auction (Dutch auction) | Core |
| FundraiserFactory | Fundraiser (donation pool) | Core |

### Fundraiser

The Fundraiser contract is the donation-based distribution mechanism. Key traits:

- **Epoch emission pools.** Donors contribute USDC to epoch pools and earn proportional token emissions at the end of each epoch.
- **Halving emission schedule.** Token emissions decrease over time according to an epoch-based halving schedule with a configurable minimum floor.
- **Fee splits.** Each donation generates fees that are split between recipient (50%), treasury (Auction contract), team (launcher), and protocol.
- **Sole minting authority.** The fundraiser is the only address that can mint its Coin token. This is enforced by the `setMinter()` one-time lock on the Coin contract.

Fundraisers are owned by the launcher after deployment. The owner can adjust operational parameters (treasury address, team address, recipient address, metadata URI), but core mechanics (emission rates, halving schedule) are immutable.

### Coin

The Coin contract is an ERC20 token with ERC20Permit (gasless approvals) and ERC20Votes (on-chain governance) capabilities. Each launch creates a new Coin token.

Key design decisions:

- **One-time minting authority transfer.** The Coin is initially deployed with Core as the minter. The Core mints the initial supply for LP seeding, then calls `setMinter()` to permanently transfer minting authority to the Fundraiser. The `minterLocked` flag ensures this can only happen once.
- **No admin mint.** Once `setMinter()` is called, only the Fundraiser contract can mint tokens.
- **Burn capability.** Any token holder can burn their own tokens. There is no admin burn.

### Auction

The Auction contract implements a Dutch auction for selling accumulated treasury assets. Fundraiser fees designated for the treasury are sent to the Auction contract, which accumulate until a buyer purchases the entire batch.

How it works:

1. Fee tokens (USDC or the fundraiser's quote token) accumulate in the Auction contract over time.
2. The Dutch auction price starts at `initPrice` and decays linearly to zero over `epochPeriod`.
3. A buyer calls `buy()`, paying the current price in LP tokens. The buyer receives all accumulated assets. The LP tokens are sent to the dead address (burned).
4. A new epoch begins with a starting price of `lastPaidPrice * priceMultiplier`, clamped between `minInitPrice` and the absolute maximum.

## Launch Flow

When a user calls `Core.launch()`, the following steps execute atomically in a single transaction:

### Step 1: Validate Parameters

The Core contract validates all launcher-provided parameters: non-zero addresses, non-empty strings, minimum USDC requirement, and valid ranges for all numeric values. Fundraiser-specific and Auction-specific parameter validation is additionally enforced by the respective constructors.

### Step 2: Transfer USDC from Launcher

```solidity
IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), params.usdcAmount);
```

### Step 3: Deploy Coin Token

```solidity
coin = ICoinFactory(coinFactory).deploy(params.tokenName, params.tokenSymbol);
```

### Step 4: Mint Coin Tokens for LP

```solidity
ICoin(coin).mint(address(this), params.coinAmount);
```

### Step 5: Create Uniswap V2 LP

```solidity
IUniswapV2Router(uniswapV2Router).addLiquidity(
    coin, usdcToken,
    params.coinAmount, params.usdcAmount,
    params.coinAmount, params.usdcAmount,
    address(this),
    block.timestamp + 20 minutes
);
```

### Step 6: Burn LP Tokens

```solidity
lpToken = IUniswapV2Factory(uniswapV2Factory).getPair(coin, usdcToken);
IERC20(lpToken).safeTransfer(DEAD_ADDRESS, liquidity);
```

### Step 7: Deploy Auction

```solidity
auction = IAuctionFactory(auctionFactory).deploy(
    lpToken,
    DEAD_ADDRESS,
    params.auctionInitPrice,
    params.auctionEpochPeriod,
    params.auctionPriceMultiplier,
    params.auctionMinInitPrice
);
```

### Step 8: Deploy Fundraiser

The Fundraiser is deployed via FundraiserFactory. The constructor receives the core parameters, with treasury set to the Auction contract, team set to the launcher's address.

```solidity
fundraiser = IFundraiserFactory(fundraiserFactory).deploy(
    coin, params.quoteToken, address(this),
    auction, params.launcher, params.recipient,
    fundraiserConfig, params.uri
);
```

### Step 9: Transfer Coin Minting Rights

```solidity
ICoin(coin).setMinter(fundraiser);
```

### Step 10: Transfer Ownership to Launcher

```solidity
IFundraiser(fundraiser).transferOwnership(params.launcher);
```

## Fee Architecture

Fundraiser donations generate fees denominated in the quote token (typically USDC). The split is:

| Recipient | Share | Description |
|---|---|---|
| Recipient | 50% | The designated donation recipient |
| Treasury (Auction) | 45% | Accumulates for periodic Dutch auction sale |
| Team (launcher) | 4% | Sent directly to the team address |
| Protocol | 1% | Sent directly to the protocol fee address |

If the team address is set to zero, the team's 4% share is redirected to treasury.

### Treasury Fee Flow

Treasury fees accumulate in the Auction contract. Periodically, a buyer purchases the entire accumulated balance by paying the current Dutch auction price in LP tokens. Those LP tokens are burned (sent to the dead address), reducing the circulating LP token supply.

```
Donation --> Fee split --> Treasury share --> Auction contract
                                                  |
Buyer pays LP tokens --> LP burned --> Buyer gets treasury assets
```

## Token Lifecycle

### Fundraiser

1. **Emission.** The Fundraiser emits a fixed number of Coin tokens per epoch. The emission halves every `halvingPeriod` epochs, floored at `minEmission`.
2. **Donation tracking.** Each epoch accumulates donation totals per user. The donation amounts determine proportional shares but the donated funds are distributed instantly (not held by the fundraiser).
3. **Claiming.** After an epoch ends, any address can call `claim(account, epoch)` to mint and transfer that account's proportional share of the epoch's emission. Claims are per-epoch and can only be made after the epoch has concluded.
4. **Distribution.** If an epoch has 10,000 USDC in total donations and a user contributed 1,000 USDC (10%), that user can claim 10% of that epoch's Coin emission.
