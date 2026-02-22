import { BigDecimal, BigInt, Address } from '@graphprotocol/graph-ts'
import { Transfer as TransferEvent, ERC20 } from '../generated/templates/Coin/ERC20'
import { Coin, Account } from '../generated/schema'
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  BI_18,
  ADDRESS_ZERO,
} from './constants'
import {
  convertTokenToDecimal,
  getOrCreateAccount,
} from './helpers'

export function handleCoinTransfer(event: TransferEvent): void {
  let coinAddress = event.address.toHexString()
  let coin = Coin.load(coinAddress)
  if (coin === null) return

  let from = event.params.from.toHexString()
  let to = event.params.to.toHexString()
  let value = convertTokenToDecimal(event.params.value, BI_18)

  // Track mints (from zero address)
  if (from == ADDRESS_ZERO) {
    coin.totalSupply = coin.totalSupply.plus(value)
    coin.marketCap = coin.price.times(coin.totalSupply)
  }

  // Track burns (to zero address)
  if (to == ADDRESS_ZERO) {
    coin.totalSupply = coin.totalSupply.minus(value)
    coin.marketCap = coin.price.times(coin.totalSupply)
  }

  // Holder tracking via balanceOf
  let contract = ERC20.bind(event.address)

  // Check if receiver is a new holder (balance == transfer amount means they had 0 before)
  if (to != ADDRESS_ZERO) {
    let toAccount = getOrCreateAccount(Address.fromString(to))
    toAccount.lastActivityAt = event.block.timestamp
    toAccount.save()

    let toBalanceResult = contract.try_balanceOf(Address.fromString(to))
    if (!toBalanceResult.reverted && toBalanceResult.value.equals(event.params.value)) {
      coin.holderCount = coin.holderCount.plus(ONE_BI)
    }
  }

  // Check if sender no longer holds any tokens
  if (from != ADDRESS_ZERO) {
    let fromAccount = getOrCreateAccount(Address.fromString(from))
    fromAccount.lastActivityAt = event.block.timestamp
    fromAccount.save()

    let fromBalanceResult = contract.try_balanceOf(Address.fromString(from))
    if (!fromBalanceResult.reverted && fromBalanceResult.value.isZero()) {
      if (coin.holderCount.gt(ZERO_BI)) {
        coin.holderCount = coin.holderCount.minus(ONE_BI)
      }
    }
  }

  coin.save()
}
