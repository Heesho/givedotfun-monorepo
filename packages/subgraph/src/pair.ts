import { BigDecimal, BigInt, Address } from '@graphprotocol/graph-ts'
import {
  Swap as SwapEvent,
  Sync as SyncEvent,
  UniswapV2Pair,
} from '../generated/templates/UniswapV2Pair/UniswapV2Pair'
import {
  Coin,
  CoinMinuteData,
  CoinHourData,
  CoinDayData,
  Swap,
  Account,
  Protocol,
} from '../generated/schema'
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  BI_18,
  BI_6,
  PROTOCOL_ID,
} from './constants'
import {
  convertTokenToDecimal,
  getOrCreateProtocol,
  getOrCreateAccount,
  getOrCreateCoinMinuteData,
  getOrCreateCoinHourData,
  getOrCreateCoinDayData,
  updateCoinPrice,
} from './helpers'

// Helper to find Coin by LP pair address
function getCoinByLpPair(pairAddress: Address): Coin | null {
  // We need to find which Coin has this LP pair
  // The Coin entity stores lpPair as Bytes, and the id is the coin token address
  // We'll use the pair contract to get token0 and token1, then check which is the Coin
  let pair = UniswapV2Pair.bind(pairAddress)

  let token0Result = pair.try_token0()
  let token1Result = pair.try_token1()

  if (token0Result.reverted || token1Result.reverted) {
    return null
  }

  let token0 = token0Result.value
  let token1 = token1Result.value

  // Try loading Coin by token0 first, then token1
  let coin = Coin.load(token0.toHexString())
  if (coin !== null) {
    return coin
  }

  coin = Coin.load(token1.toHexString())
  return coin
}

export function handleSync(event: SyncEvent): void {
  let pairAddress = event.address
  let coin = getCoinByLpPair(pairAddress)
  if (coin === null) return

  let previousLiquidity = coin.liquidity

  let pair = UniswapV2Pair.bind(pairAddress)
  let token0Result = pair.try_token0()
  if (token0Result.reverted) return

  let token0 = token0Result.value
  let isCoinToken0 = token0.toHexString() == coin.id

  // Parse reserves - Sync event emits reserve0 and reserve1 as uint112
  // Coin has 18 decimals, USDC has 6 decimals
  let reserve0Raw = BigDecimal.fromString(event.params.reserve0.toString())
  let reserve1Raw = BigDecimal.fromString(event.params.reserve1.toString())

  let reserveCoin: BigDecimal
  let reserveUsdc: BigDecimal

  if (isCoinToken0) {
    reserveCoin = reserve0Raw.div(BigDecimal.fromString('1000000000000000000')) // 1e18
    reserveUsdc = reserve1Raw.div(BigDecimal.fromString('1000000')) // 1e6
  } else {
    reserveCoin = reserve1Raw.div(BigDecimal.fromString('1000000000000000000')) // 1e18
    reserveUsdc = reserve0Raw.div(BigDecimal.fromString('1000000')) // 1e6
  }

  // Update Coin reserves
  coin.reserveCoin = reserveCoin
  coin.reserveUsdc = reserveUsdc

  // Calculate price: price = reserveUsdc / reserveCoin (how much USDC per Coin)
  let newPrice = ZERO_BD
  if (reserveCoin.gt(ZERO_BD)) {
    newPrice = reserveUsdc.div(reserveCoin)
  }

  // Update price and related metrics
  updateCoinPrice(coin, newPrice)

  // Update liquidity (USDC side)
  coin.liquidity = reserveUsdc
  coin.liquidityUSD = reserveUsdc

  // Update minute/hour/day data OHLC
  let minuteData = getOrCreateCoinMinuteData(coin, event)
  minuteData.close = newPrice
  if (newPrice.gt(minuteData.high)) {
    minuteData.high = newPrice
  }
  if (newPrice.lt(minuteData.low) || minuteData.low.equals(ZERO_BD)) {
    minuteData.low = newPrice
  }
  minuteData.liquidity = reserveUsdc
  minuteData.save()

  let hourData = getOrCreateCoinHourData(coin, event)
  hourData.close = newPrice
  if (newPrice.gt(hourData.high)) {
    hourData.high = newPrice
  }
  if (newPrice.lt(hourData.low) || hourData.low.equals(ZERO_BD)) {
    hourData.low = newPrice
  }
  hourData.liquidity = reserveUsdc
  hourData.save()

  let dayData = getOrCreateCoinDayData(coin, event)
  dayData.close = newPrice
  if (newPrice.gt(dayData.high)) {
    dayData.high = newPrice
  }
  if (newPrice.lt(dayData.low) || dayData.low.equals(ZERO_BD)) {
    dayData.low = newPrice
  }
  dayData.liquidity = reserveUsdc
  dayData.totalSupply = coin.totalSupply
  dayData.totalMinted = coin.totalMinted
  dayData.save()

  coin.save()

  // Update Protocol liquidity
  let protocol = getOrCreateProtocol()
  protocol.totalLiquidityUsdc = protocol.totalLiquidityUsdc
    .minus(previousLiquidity)
    .plus(reserveUsdc)
  if (protocol.totalLiquidityUsdc.lt(ZERO_BD)) {
    protocol.totalLiquidityUsdc = ZERO_BD
  }
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleSwap(event: SwapEvent): void {
  let pairAddress = event.address
  let coin = getCoinByLpPair(pairAddress)
  if (coin === null) return

  let pair = UniswapV2Pair.bind(pairAddress)
  let token0Result = pair.try_token0()
  if (token0Result.reverted) return

  let token0 = token0Result.value
  let isCoinToken0 = token0.toHexString() == coin.id

  // Parse swap amounts - Coin has 18 decimals, USDC has 6 decimals
  let amountCoinIn: BigDecimal
  let amountCoinOut: BigDecimal
  let amountUsdcIn: BigDecimal
  let amountUsdcOut: BigDecimal

  if (isCoinToken0) {
    amountCoinIn = convertTokenToDecimal(event.params.amount0In, BI_18)
    amountCoinOut = convertTokenToDecimal(event.params.amount0Out, BI_18)
    amountUsdcIn = convertTokenToDecimal(event.params.amount1In, BI_6)
    amountUsdcOut = convertTokenToDecimal(event.params.amount1Out, BI_6)
  } else {
    amountCoinIn = convertTokenToDecimal(event.params.amount1In, BI_18)
    amountCoinOut = convertTokenToDecimal(event.params.amount1Out, BI_18)
    amountUsdcIn = convertTokenToDecimal(event.params.amount0In, BI_6)
    amountUsdcOut = convertTokenToDecimal(event.params.amount0Out, BI_6)
  }

  // Determine swap type: buy or sell
  // Buy = USDC in, Coin out (user buying Coin with USDC)
  // Sell = Coin in, USDC out (user selling Coin for USDC)
  let isBuy = amountUsdcIn.gt(ZERO_BD) && amountCoinOut.gt(ZERO_BD)
  let swapType = isBuy ? 'buy' : 'sell'

  // Calculate amounts for the swap
  let amountCoin = isBuy ? amountCoinOut : amountCoinIn
  let amountUsdc = isBuy ? amountUsdcIn : amountUsdcOut

  // Calculate execution price
  let price = ZERO_BD
  if (amountCoin.gt(ZERO_BD)) {
    price = amountUsdc.div(amountCoin)
  }

  // Get or create account
  let account = getOrCreateAccount(event.params.to)
  account.totalSwapVolume = account.totalSwapVolume.plus(amountUsdc)
  account.lastActivityAt = event.block.timestamp
  account.save()

  // Create Swap entity
  let swapId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let swap = new Swap(swapId)
  swap.coin = coin.id
  swap.account = account.id
  swap.type = swapType
  swap.amountCoin = amountCoin
  swap.amountUsdc = amountUsdc
  swap.price = price
  swap.timestamp = event.block.timestamp
  swap.blockNumber = event.block.number
  swap.txHash = event.transaction.hash
  swap.logIndex = event.logIndex
  swap.save()

  // Update Coin volume stats
  coin.volumeTotal = coin.volumeTotal.plus(amountUsdc)
  coin.txCount = coin.txCount.plus(ONE_BI)
  coin.lastSwapAt = event.block.timestamp
  coin.lastActivityAt = event.block.timestamp
  coin.save()

  // Update minute data
  let minuteData = getOrCreateCoinMinuteData(coin, event)
  minuteData.volumeCoin = minuteData.volumeCoin.plus(amountCoin)
  minuteData.volumeUsdc = minuteData.volumeUsdc.plus(amountUsdc)
  minuteData.txCount = minuteData.txCount.plus(ONE_BI)
  minuteData.save()

  // Update hour data
  let hourData = getOrCreateCoinHourData(coin, event)
  hourData.volumeCoin = hourData.volumeCoin.plus(amountCoin)
  hourData.volumeUsdc = hourData.volumeUsdc.plus(amountUsdc)
  hourData.txCount = hourData.txCount.plus(ONE_BI)
  hourData.save()

  // Update day data
  let dayData = getOrCreateCoinDayData(coin, event)
  dayData.volumeCoin = dayData.volumeCoin.plus(amountCoin)
  dayData.volumeUsdc = dayData.volumeUsdc.plus(amountUsdc)
  dayData.txCount = dayData.txCount.plus(ONE_BI)
  dayData.save()

  // Keep convenience aggregates in sync for API consumers.
  coin.volume24h = dayData.volumeUsdc
  coin.txCount24h = dayData.txCount
  coin.save()

  // Update Protocol volume
  let protocol = getOrCreateProtocol()
  protocol.totalVolumeUsdc = protocol.totalVolumeUsdc.plus(amountUsdc)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}
