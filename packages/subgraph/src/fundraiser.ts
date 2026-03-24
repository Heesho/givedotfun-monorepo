import { BigDecimal, BigInt, Address, DataSourceContext } from '@graphprotocol/graph-ts'
import {
  Fundraiser__Funded as FundedEvent,
  Fundraiser__Claimed as ClaimedEvent,
  Fundraiser__TreasuryFee as FundTreasuryFeeEvent,
  Fundraiser__TeamFee as FundTeamFeeEvent,
  Fundraiser__ProtocolFee as ProtocolFeeEvent,
  Fundraiser__RecipientFee as RecipientFeeEvent,
  Fundraiser__RecipientSet as RecipientSetEvent,
  Fundraiser__UriSet as UriSetEvent,
  Fundraiser__TreasurySet as TreasurySetEvent,
  Fundraiser__TeamSet as TeamSetEvent,
  Fundraiser as FundraiserContract,
} from '../generated/templates/Fundraiser/Fundraiser'
import { Core as CoreContract } from '../generated/templates/Fundraiser/Core'
import { FundraiserMetadataFile as FundraiserMetadataTemplate } from '../generated/templates'
import {
  Fundraiser,
  Recipient,
  FundraiserDayData,
  Donation,
  Claim,
  Donor,
  DayDonor,
  Account,
  Coin,
  Protocol,
} from '../generated/schema'
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  BI_18,
  BI_6,
  ADDRESS_ZERO,
} from './constants'
import {
  convertTokenToDecimal,
  getOrCreateProtocol,
  getOrCreateAccount,
} from './helpers'
import { buildFundraiserMetadataId, getIpfsPathFromUri } from './metadata-utils'

// Fee constants for Fundraiser (basis points)
const RECIPIENT_BPS = BigInt.fromI32(5000) // 50%
const TEAM_BPS = BigInt.fromI32(400) // 4%
const PROTOCOL_BPS = BigInt.fromI32(100) // 1%
const DIVISOR = BigInt.fromI32(10000)

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

function calculateFee(amount: BigDecimal, feeBps: BigInt): BigDecimal {
  return amount.times(feeBps.toBigDecimal()).div(DIVISOR.toBigDecimal())
}

function isZeroAddress(address: Address): bool {
  return address.toHexString() == ADDRESS_ZERO
}

function getDonorId(fundraiserId: string, donorId: string): string {
  return fundraiserId + '-' + donorId
}

function getDayDonorId(fundraiserId: string, day: BigInt, donorId: string): string {
  return fundraiserId + '-' + day.toString() + '-' + donorId
}

// Helper to get or create FundraiserDayData
function getOrCreateFundraiserDayData(fundraiser: Fundraiser, day: BigInt, timestamp: BigInt): FundraiserDayData {
  let id = fundraiser.id + '-' + day.toString()
  let dayData = FundraiserDayData.load(id)
  if (dayData === null) {
    dayData = new FundraiserDayData(id)
    dayData.fundraiser = fundraiser.id
    dayData.day = day
    dayData.totalDonated = ZERO_BD
    dayData.donorCount = ZERO_BI
    dayData.emission = ZERO_BD
    dayData.timestamp = timestamp
  }
  return dayData
}

export function handleFunded(event: FundedEvent): void {
  let fundraiserAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  let coin = Coin.load(fundraiser.coin)
  if (coin === null) return

  // Event params: sender, funder (indexed), amount, day
  let donorAddress = event.params.funder
  let amount = convertTokenToDecimal(event.params.amount, BI_6)
  let day = event.params.epoch

  // Get or create donor account
  let donor = getOrCreateAccount(donorAddress)
  donor.totalFundraiserSpend = donor.totalFundraiserSpend.plus(amount)
  donor.lastActivityAt = event.block.timestamp
  donor.save()

  let fundraiserContract = FundraiserContract.bind(event.address)

  // Resolve dynamic fee toggles (recipient/team/protocol can be disabled by setting address(0))
  let recipientResult = fundraiserContract.try_recipient()
  let hasRecipient = !recipientResult.reverted && !isZeroAddress(recipientResult.value)

  let teamResult = fundraiserContract.try_team()
  let hasTeam = !teamResult.reverted && !isZeroAddress(teamResult.value)

  let hasProtocol = false
  let coreResult = fundraiserContract.try_core()
  if (!coreResult.reverted) {
    let coreContract = CoreContract.bind(coreResult.value)
    let protocolResult = coreContract.try_protocolFeeAddress()
    hasProtocol = !protocolResult.reverted && !isZeroAddress(protocolResult.value)
  }

  // Calculate fee splits to match contract logic.
  // When recipient is address(0), the 50% goes to treasury instead.
  let recipientAmount = hasRecipient ? calculateFee(amount, RECIPIENT_BPS) : ZERO_BD
  let teamAmount = hasTeam ? calculateFee(amount, TEAM_BPS) : ZERO_BD
  let protocolAmount = hasProtocol ? calculateFee(amount, PROTOCOL_BPS) : ZERO_BD
  let treasuryAmount = amount.minus(recipientAmount).minus(teamAmount).minus(protocolAmount)

  // Create Donation entity
  let donationId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let donation = new Donation(donationId)
  donation.fundraiser = fundraiser.id
  donation.donor = donor.id
  if (hasRecipient) {
    donation.recipient = recipientResult.value
  }
  donation.day = day
  donation.amount = amount
  donation.uri = event.params.uri
  donation.recipientAmount = recipientAmount
  donation.treasuryAmount = treasuryAmount
  donation.teamAmount = teamAmount
  donation.timestamp = event.block.timestamp
  donation.blockNumber = event.block.number
  donation.txHash = event.transaction.hash
  donation.save()

  // Update FundraiserDayData
  let dayData = getOrCreateFundraiserDayData(fundraiser, day, event.block.timestamp)
  let dayEmissionResult = fundraiserContract.try_getEpochEmission(day)
  if (!dayEmissionResult.reverted) {
    dayData.emission = convertTokenToDecimal(dayEmissionResult.value, BI_18)
  }

  // Track unique donor for this day.
  let dayDonorId = getDayDonorId(fundraiser.id, day, donor.id)
  let dayDonor = DayDonor.load(dayDonorId)
  if (dayDonor === null) {
    dayDonor = new DayDonor(dayDonorId)
    dayDonor.fundraiser = fundraiser.id
    dayDonor.day = day
    dayDonor.donor = donor.id
    dayDonor.firstDonationAt = event.block.timestamp
    dayDonor.save()
    dayData.donorCount = dayData.donorCount.plus(ONE_BI)
  }

  dayData.totalDonated = dayData.totalDonated.plus(amount)
  dayData.save()

  // Update Fundraiser state
  fundraiser.currentDay = day
  fundraiser.totalDonated = fundraiser.totalDonated.plus(amount)
  let donorEntityId = getDonorId(fundraiser.id, donor.id)
  let donorEntity = Donor.load(donorEntityId)
  if (donorEntity === null) {
    donorEntity = new Donor(donorEntityId)
    donorEntity.fundraiser = fundraiser.id
    donorEntity.donor = donor.id
    donorEntity.firstDonationAt = event.block.timestamp
    donorEntity.save()
    fundraiser.uniqueDonors = fundraiser.uniqueDonors.plus(ONE_BI)
  }
  fundraiser.lastActivityAt = event.block.timestamp
  fundraiser.save()

  // Update Coin activity
  coin.lastFundraiserActivityAt = event.block.timestamp
  coin.lastActivityAt = event.block.timestamp
  coin.save()
}

export function handleFundClaimed(event: ClaimedEvent): void {
  let fundraiserAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  let coin = Coin.load(fundraiser.coin)
  if (coin === null) return

  // Event params: account (indexed), amount, day
  let claimerAddress = event.params.account
  let amount = convertTokenToDecimal(event.params.amount, BI_18)
  let day = event.params.epoch

  // Get claimer account
  let claimer = getOrCreateAccount(claimerAddress)
  claimer.totalMined = claimer.totalMined.plus(amount)
  claimer.lastActivityAt = event.block.timestamp
  claimer.save()

  // Create Claim entity
  let claimId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let claim = new Claim(claimId)
  claim.fundraiser = fundraiser.id
  claim.claimer = claimer.id
  claim.day = day
  claim.amount = amount
  claim.timestamp = event.block.timestamp
  claim.blockNumber = event.block.number
  claim.txHash = event.transaction.hash
  claim.save()

  // Update Fundraiser total minted
  fundraiser.totalMinted = fundraiser.totalMinted.plus(amount)
  fundraiser.lastActivityAt = event.block.timestamp
  fundraiser.save()

  // Update Coin total minted
  coin.totalMinted = coin.totalMinted.plus(amount)
  coin.lastFundraiserActivityAt = event.block.timestamp
  coin.lastActivityAt = event.block.timestamp
  coin.save()

  // Update Protocol total minted
  let protocol = getOrCreateProtocol()
  protocol.totalMinted = protocol.totalMinted.plus(amount)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleFundTreasuryFee(event: FundTreasuryFeeEvent): void {
  // Event params: treasury (indexed), day (indexed), amount
  let fundraiserAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.treasuryRevenue = fundraiser.treasuryRevenue.plus(amount)
  fundraiser.save()

  // Update Protocol treasury revenue
  let protocol = getOrCreateProtocol()
  protocol.totalTreasuryRevenue = protocol.totalTreasuryRevenue.plus(amount)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleFundTeamFee(event: FundTeamFeeEvent): void {
  // Event params: team (indexed), day (indexed), amount
  let fundraiserAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.teamRevenue = fundraiser.teamRevenue.plus(amount)
  fundraiser.save()
}

export function handleFundProtocolFee(event: ProtocolFeeEvent): void {
  // Event params: protocol (indexed), day (indexed), amount
  let fundraiserAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.protocolRevenue = fundraiser.protocolRevenue.plus(amount)
  fundraiser.save()

  // Update Protocol total revenue
  let protocol = getOrCreateProtocol()
  protocol.totalProtocolRevenue = protocol.totalProtocolRevenue.plus(amount)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleFundRecipientFee(event: RecipientFeeEvent): void {
  // Event params: recipient (indexed), epoch (indexed), amount
  let fundraiserAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.recipientRevenue = fundraiser.recipientRevenue.plus(amount)
  fundraiser.save()

  // Update Recipient entity totalReceived
  let recipientId = fundraiserAddress + '-' + event.params.recipient.toHexString()
  let recipient = Recipient.load(recipientId)
  if (recipient !== null) {
    recipient.totalReceived = recipient.totalReceived.plus(amount)
    recipient.save()
  }
}

export function handleFundRecipientSet(event: RecipientSetEvent): void {
  let fundraiserAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  let recipientId = fundraiserAddress + '-' + event.params.recipient.toHexString()
  let recipient = Recipient.load(recipientId)
  if (recipient === null) {
    recipient = new Recipient(recipientId)
    recipient.fundraiser = fundraiser.id
    recipient.recipient = event.params.recipient
    recipient.totalReceived = ZERO_BD
    recipient.addedAt = event.block.timestamp
  }
  recipient.isActive = true
  recipient.save()
}

export function handleFundUriSet(event: UriSetEvent): void {
  let fundraiserAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.uri = event.params.uri
  let metadataId = indexFundraiserMetadata(fundraiser.id, fundraiser.uri)
  if (metadataId !== null) {
    fundraiser.metadata = metadataId
  }
  fundraiser.save()
}

export function handleFundTreasurySet(event: TreasurySetEvent): void {
  let fundraiserAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.treasury = event.params.treasury
  fundraiser.save()
}

export function handleFundTeamSet(event: TeamSetEvent): void {
  let fundraiserAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(fundraiserAddress)
  if (fundraiser === null) return

  fundraiser.team = event.params.team
  fundraiser.save()
}
