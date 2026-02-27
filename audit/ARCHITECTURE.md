# System Architecture & Threat Model

## ASCII architecture diagram

```text
                    +-----------------------------+
                    |           User               |
                    |  fund/claim/launch/view      |
                    +--------------+--------------+
                                   |
                                   v
                 +-----------------+------------------+
                 |            Core                   |
                 | launch(), admin config            |
                 +-----------------+------------------+
                                   |
               +-------------------+-------------------------------+
               |                   |                               |
               v                   v                               v
         +---------+          +--------------+                +--------------+
         | Coin    |          | Fundraiser   |                | Auction      |
         | Factory |          | (per-project) |                | (per-project)|
         +----+----+          +------+-------+                +------+-------+
              |                      |                               |
              |                      | fund(), claim(), admin updates  |
              |                      v                               |
              |               +------+-------+                       |
              |               |    Coin Token  | <-------------------+
              |               | (ERC20 minting)|
              |               +--------------+
              |
    +-----------------------------+
    | UniswapV2 Router / Factory  |
    | addLiquidity + LP pairing    |
    +-----------------------------+
                |
                v
           +-------------+
           |  LP token   |
           +-------------+
                |
                v
             Burn address (Core launch)

```

## Contract-level flow

- Launcher approves USDC, calls `Core.launch`.
- `Core`:
  1) Validates params
  2) pulls USDC
  3) deploys Coin
  4) mints initial Coin into itself
  5) creates Uniswap pair/liquidity and burns LP
  6) deploys Auction and Fundraiser
  7) transfers Coin minter to Fundraiser
  8) stores fundraiser mappings and emits launch event
- Donor calls `Fundraiser.fund` or `Multicall.fund`:
  - tokens are pulled and split into recipient/treasury/team/protocol
  - `epoch` donation bookkeeping updated with credited account
- At epoch end, account can call `Fundraiser.claim` (or `Multicall.claimMultiple`) to mint reward `Coin`.
- Treasury share held by Auction, then anyone can `Auction.buy` to absorb all accumulated assets for LP payment.

## State machine

### Launch lifecycle

1. `Core` constructs launch parameters.
2. All deployment subcalls succeed atomically or the entire launch reverts.
3. Fundraiser and auction become immutable once deployed.

### Donation lifecycle

1. `Fundraiser.fund`: `account` (credit target) + `amount` + epoch calculation.
2. immediate split and transfer out of donation.
3. accounting state updated for `epochToTotalDonated` and per-account mapping.
4. `claim` allowed only when `epoch < currentEpoch`.
5. each `(epoch, account)` can be claimed once.

### Treasury lifecycle

1. `Fundraiser` sends treasury split to `Auction`.
2. `Auction.buy` can be called with epoch lock, deadline, and max payment constraints.
3. on buy, assets moved to caller-receiver and LP burns to dead address.

## Actors and trust boundaries

- Donors: fund/claim; can fund on behalf of any `account`.
- Fundraiser owners: control payout destinations and metadata; cannot alter emission schedule.
- Protocol owner (`Core` owner): controls protocol fee address and launch minimum.
- Attackers/MEV:
  - can reorder/mempool-monitor transactions.
  - can exploit timing assumptions around epoch/time windows.
- Token contracts:
  - quote token behavior assumptions (transfer semantics and decimals).
- Frontend/indexer:
  - consume contract state/events; should be treated as advisory unless cross-checked on-chain.

## Non-contract trust assumptions

- Quote token is expected to be standard ERC20 with deterministic transfer semantics.
- L2/base timestamp assumptions for epoch and auction timing.
- Router and pair contracts in launch path behave as expected and are not adversarial.
- Admin private keys are assumed secure; key compromise is out of scope as key-management risk.

## Threat categories to validate next

- Funds handling:
  - non-standard token behavior in direct transfer-and-account flows.
- Reentrancy/CEI:
  - `fund`, `claim`, and `buy` paths.
- Access control:
  - owner updates redirecting fees/treasury/recipient.
- Arithmetic/state consistency:
  - per-epoch totals, rounding, zero-division, and epoch gating.
- MEV:
  - transaction-ordering effects around epoch transitions and Dutch auction price decay.
- Integration risks:
  - frontend hardcoded addresses and ABI assumptions.
  - indexer derivations for decimals and token math.
