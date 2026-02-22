import { BigInt, BigDecimal, Address, ethereum } from '@graphprotocol/graph-ts'
import { Protocol, Coin, Account, CoinMinuteData, CoinHourData, CoinDayData } from '../generated/schema'
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  PROTOCOL_ID,
  ADDRESS_ZERO,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_DAY,
} from './constants'

// ============================================================================
// DECIMAL CONVERSION
// ============================================================================

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

// ============================================================================
// ENTITY LOADERS / CREATORS
// ============================================================================

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID)
  if (protocol === null) {
    protocol = new Protocol(PROTOCOL_ID)
    protocol.totalCoins = ZERO_BI
    protocol.totalFundraisers = ZERO_BI
    protocol.totalVolumeUsdc = ZERO_BD
    protocol.totalVolume24h = ZERO_BD
    protocol.totalLiquidityUsdc = ZERO_BD
    protocol.totalTreasuryRevenue = ZERO_BD
    protocol.totalProtocolRevenue = ZERO_BD
    protocol.totalMinted = ZERO_BD
    protocol.lastUpdated = ZERO_BI
    protocol.save()
  }
  return protocol
}

export function getOrCreateAccount(address: Address): Account {
  let id = address.toHexString()
  let account = Account.load(id)
  if (account === null) {
    account = new Account(id)
    account.totalSwapVolume = ZERO_BD
    account.totalFundraiserSpend = ZERO_BD
    account.totalMined = ZERO_BD
    account.totalWon = ZERO_BD
    account.lastActivityAt = ZERO_BI
    account.save()
  }
  return account
}

export function createCoin(
  coinAddress: Address,
  lpPairAddress: Address,
  usdcAddress: Address,
  launcher: Account,
  name: string,
  symbol: string,
  event: ethereum.Event
): Coin {
  let coin = new Coin(coinAddress.toHexString())

  // Basic info
  coin.name = name
  coin.symbol = symbol
  coin.decimals = 18

  // Supply
  coin.totalSupply = ZERO_BD
  coin.totalMinted = ZERO_BD

  // Contracts
  coin.lpPair = lpPairAddress
  coin.usdcToken = usdcAddress
  coin.launcher = launcher.id

  // Price data (will be updated on first Sync)
  coin.price = ZERO_BD
  coin.priceUSD = ZERO_BD
  coin.marketCap = ZERO_BD
  coin.marketCapUSD = ZERO_BD
  coin.liquidity = ZERO_BD
  coin.liquidityUSD = ZERO_BD
  coin.reserveCoin = ZERO_BD
  coin.reserveUsdc = ZERO_BD

  // Volume
  coin.volume24h = ZERO_BD
  coin.volume7d = ZERO_BD
  coin.volumeTotal = ZERO_BD
  coin.txCount = ZERO_BI
  coin.txCount24h = ZERO_BI

  // Price changes
  coin.priceChange1h = ZERO_BD
  coin.priceChange24h = ZERO_BD
  coin.priceChange7d = ZERO_BD
  coin.priceHigh24h = ZERO_BD
  coin.priceLow24h = ZERO_BD
  coin.price1hAgo = ZERO_BD
  coin.price24hAgo = ZERO_BD
  coin.price7dAgo = ZERO_BD

  // Activity
  coin.lastSwapAt = ZERO_BI
  coin.lastFundraiserActivityAt = ZERO_BI
  coin.lastActivityAt = ZERO_BI

  // Holders
  coin.holderCount = ZERO_BI

  // Timestamps
  coin.createdAt = event.block.timestamp
  coin.createdAtBlock = event.block.number

  return coin
}

// ============================================================================
// HOUR / DAY DATA HELPERS
// ============================================================================

export function getMinuteIndex(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_MINUTE
}

export function getHourIndex(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_HOUR
}

export function getDayIndex(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_DAY
}

export function getMinuteStartTimestamp(minuteIndex: i32): BigInt {
  return BigInt.fromI32(minuteIndex * SECONDS_PER_MINUTE)
}

export function getHourStartTimestamp(hourIndex: i32): BigInt {
  return BigInt.fromI32(hourIndex * SECONDS_PER_HOUR)
}

export function getDayStartTimestamp(dayIndex: i32): BigInt {
  return BigInt.fromI32(dayIndex * SECONDS_PER_DAY)
}

export function getOrCreateCoinMinuteData(coin: Coin, event: ethereum.Event): CoinMinuteData {
  let minuteIndex = getMinuteIndex(event.block.timestamp)
  let id = coin.id.concat('-').concat(minuteIndex.toString())

  let minuteData = CoinMinuteData.load(id)
  if (minuteData === null) {
    minuteData = new CoinMinuteData(id)
    minuteData.coin = coin.id
    minuteData.timestamp = getMinuteStartTimestamp(minuteIndex)
    minuteData.minuteIndex = minuteIndex

    // Initialize OHLC with current price
    minuteData.open = coin.price
    minuteData.high = coin.price
    minuteData.low = coin.price
    minuteData.close = coin.price

    // Volume
    minuteData.volumeCoin = ZERO_BD
    minuteData.volumeUsdc = ZERO_BD
    minuteData.txCount = ZERO_BI

    // Liquidity
    minuteData.liquidity = coin.liquidity
  }

  return minuteData
}

export function getOrCreateCoinHourData(coin: Coin, event: ethereum.Event): CoinHourData {
  let hourIndex = getHourIndex(event.block.timestamp)
  let id = coin.id.concat('-').concat(hourIndex.toString())

  let hourData = CoinHourData.load(id)
  if (hourData === null) {
    hourData = new CoinHourData(id)
    hourData.coin = coin.id
    hourData.timestamp = getHourStartTimestamp(hourIndex)
    hourData.hourIndex = hourIndex

    // Initialize OHLC with current price
    hourData.open = coin.price
    hourData.high = coin.price
    hourData.low = coin.price
    hourData.close = coin.price

    // Volume
    hourData.volumeCoin = ZERO_BD
    hourData.volumeUsdc = ZERO_BD
    hourData.txCount = ZERO_BI

    // Liquidity
    hourData.liquidity = coin.liquidity
  }

  return hourData
}

export function getOrCreateCoinDayData(coin: Coin, event: ethereum.Event): CoinDayData {
  let dayIndex = getDayIndex(event.block.timestamp)
  let id = coin.id.concat('-').concat(dayIndex.toString())

  let dayData = CoinDayData.load(id)
  if (dayData === null) {
    dayData = new CoinDayData(id)
    dayData.coin = coin.id
    dayData.timestamp = getDayStartTimestamp(dayIndex)
    dayData.dayIndex = dayIndex

    // Initialize OHLC with current price
    dayData.open = coin.price
    dayData.high = coin.price
    dayData.low = coin.price
    dayData.close = coin.price

    // Volume
    dayData.volumeCoin = ZERO_BD
    dayData.volumeUsdc = ZERO_BD
    dayData.txCount = ZERO_BI

    // Snapshots
    dayData.liquidity = coin.liquidity
    dayData.totalSupply = coin.totalSupply
    dayData.totalMinted = coin.totalMinted
  }

  return dayData
}

// ============================================================================
// PRICE HELPERS
// ============================================================================

export function updateCoinPrice(coin: Coin, newPrice: BigDecimal): void {
  // Update high/low
  if (newPrice.gt(coin.priceHigh24h)) {
    coin.priceHigh24h = newPrice
  }
  if (coin.priceLow24h.equals(ZERO_BD) || newPrice.lt(coin.priceLow24h)) {
    coin.priceLow24h = newPrice
  }

  // Update current price
  coin.price = newPrice
  coin.priceUSD = newPrice

  // Update market cap
  coin.marketCap = newPrice.times(coin.totalSupply)
  coin.marketCapUSD = coin.marketCap
}

export function calculatePriceChange(currentPrice: BigDecimal, oldPrice: BigDecimal): BigDecimal {
  if (oldPrice.equals(ZERO_BD)) {
    return ZERO_BD
  }
  return currentPrice.minus(oldPrice).div(oldPrice).times(BigDecimal.fromString('100'))
}
