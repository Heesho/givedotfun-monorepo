import { Address, BigInt, DataSourceContext } from '@graphprotocol/graph-ts'
import { Core__Launched as CoreLaunchedEvent } from '../../generated/Core/Core'
import { Fundraiser as FundraiserContract } from '../../generated/Core/Fundraiser'
import {
  UniswapV2Pair as PairTemplate,
  Fundraiser as FundraiserTemplate,
  Coin as CoinTemplate,
  FundraiserMetadataFile as FundraiserMetadataTemplate,
} from '../../generated/templates'
import { Protocol, Coin, Fundraiser, Account } from '../../generated/schema'
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  PROTOCOL_ID,
  BI_6,
  BI_18,
} from '../constants'
import {
  getOrCreateProtocol,
  getOrCreateAccount,
  createCoin,
  convertTokenToDecimal,
} from '../helpers'
import { buildFundraiserMetadataId, getIpfsPathFromUri } from '../metadata-utils'

const DEFAULT_MIN_DONATION = BigInt.fromI32(10_000)

function indexFundraiserMetadata(fundraiserId: string, uri: string): string | null {
  let ipfsPath = getIpfsPathFromUri(uri)
  if (ipfsPath === null) {
    return null
  }

  let metadataId = buildFundraiserMetadataId(fundraiserId, uri)
  let context = new DataSourceContext()
  context.setString('metadataId', metadataId)
  context.setString('fundraiserId', fundraiserId)
  context.setString('uri', uri)
  FundraiserMetadataTemplate.createWithContext(ipfsPath, context)

  return metadataId
}

export function handleCoreLaunched(event: CoreLaunchedEvent): void {
  // Load or create Protocol entity (singleton)
  let protocol = getOrCreateProtocol()
  protocol.totalCoins = protocol.totalCoins.plus(ONE_BI)
  protocol.totalFundraisers = protocol.totalFundraisers.plus(ONE_BI)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()

  // Load or create launcher Account
  let launcher = getOrCreateAccount(event.params.launcher)

  let coinAddress = event.params.coin
  let fundraiserAddress = event.params.fundraiser
  let lpPairAddress = event.params.lpToken
  let quoteToken = event.params.quoteToken
  let recipientAddress = event.params.recipient

  // Create Coin entity
  let coin = createCoin(
    coinAddress,
    lpPairAddress,
    quoteToken,
    launcher,
    event.params.tokenName,
    event.params.tokenSymbol,
    event
  )

  // Create merged Fundraiser entity (combines old Rig + old Fundraiser)
  let fundraiser = new Fundraiser(fundraiserAddress.toHexString())
  fundraiser.coin = coin.id
  fundraiser.launcher = launcher.id
  fundraiser.auction = event.params.auction
  fundraiser.quoteToken = quoteToken
  fundraiser.uri = event.params.uri
  fundraiser.usdcAmount = convertTokenToDecimal(event.params.usdcAmount, BI_6)
  fundraiser.coinAmount = convertTokenToDecimal(event.params.coinAmount, BI_18)
  fundraiser.initialUps = event.params.initialEmission
  fundraiser.tailUps = event.params.minEmission
  fundraiser.halvingPeriod = event.params.halvingPeriod
  fundraiser.recipientRevenue = ZERO_BD
  fundraiser.treasuryRevenue = ZERO_BD
  fundraiser.teamRevenue = ZERO_BD
  fundraiser.protocolRevenue = ZERO_BD
  fundraiser.totalMinted = ZERO_BD
  fundraiser.lastActivityAt = event.block.timestamp
  fundraiser.createdAt = event.block.timestamp
  fundraiser.createdAtBlock = event.block.number

  // Fundraiser-specific fields (was separate Fundraiser entity)
  fundraiser.initialEmission = event.params.initialEmission
  fundraiser.minEmission = event.params.minEmission
  let fundraiserContract = FundraiserContract.bind(fundraiserAddress)
  let minDonationResult = fundraiserContract.try_MIN_DONATION()
  fundraiser.minDonation = minDonationResult.reverted ? DEFAULT_MIN_DONATION : minDonationResult.value
  fundraiser.epochDuration = event.params.epochDuration
  let treasuryResult = fundraiserContract.try_treasury()
  fundraiser.treasury = treasuryResult.reverted ? Address.zero() : treasuryResult.value
  let teamResult = fundraiserContract.try_team()
  fundraiser.team = teamResult.reverted ? Address.zero() : teamResult.value
  fundraiser.currentDay = ZERO_BI
  fundraiser.totalDonated = ZERO_BD
  fundraiser.uniqueDonors = ZERO_BI

  let metadataId = indexFundraiserMetadata(fundraiser.id, fundraiser.uri)
  if (metadataId !== null) {
    fundraiser.metadata = metadataId
  }

  fundraiser.save()

  // Link coin to fundraiser
  // Set initial totalSupply from launch coinAmount — Transfer events fire before
  // the Coin template is active, so the initial LP mint is missed by handleCoinTransfer
  coin.fundraiser = fundraiser.id
  coin.totalSupply = convertTokenToDecimal(event.params.coinAmount, BI_18)
  coin.save()

  // Start indexing events from the new contracts
  PairTemplate.create(lpPairAddress)
  FundraiserTemplate.create(fundraiserAddress)
  CoinTemplate.create(coinAddress)
}
