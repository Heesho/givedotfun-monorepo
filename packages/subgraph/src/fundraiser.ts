import { BigDecimal, BigInt, Address } from '@graphprotocol/graph-ts'
import {
  Fundraiser__Funded as FundedEvent,
  Fundraiser__Claimed as ClaimedEvent,
  Fundraiser__TreasuryFee as FundTreasuryFeeEvent,
  Fundraiser__TeamFee as FundTeamFeeEvent,
  Fundraiser__ProtocolFee as ProtocolFeeEvent,
  Fundraiser__RecipientSet as RecipientSetEvent,
  Fundraiser__UriSet as UriSetEvent,
  Fundraiser__TreasurySet as TreasurySetEvent,
  Fundraiser__TeamSet as TeamSetEvent,
  Fundraiser as FundraiserContract,
} from '../generated/templates/Fundraiser/Fundraiser'
import { Core as CoreContract } from '../generated/templates/Fundraiser/Core'
import {
  Rig,
  Fundraiser,
  Recipient,
  FundraiserDayData,
  Donation,
  Claim,
  Donor,
  DayDonor,
  Account,
  Unit,
  Protocol,
} from '../generated/schema'
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  BI_18,
  BI_6,
  ADDRESS_ZERO,
} from '../constants'
import {
  convertTokenToDecimal,
  getOrCreateProtocol,
  getOrCreateAccount,
} from '../helpers'

// Fee constants for Fundraiser (basis points)
const RECIPIENT_BPS = BigInt.fromI32(5000) // 50%
const TEAM_BPS = BigInt.fromI32(400) // 4%
const PROTOCOL_BPS = BigInt.fromI32(100) // 1%
const DIVISOR = BigInt.fromI32(10000)

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
    dayData.emission = ZERO_BD // Could calculate from contract params
    dayData.timestamp = timestamp
  }
  return dayData
}

export function handleFunded(event: FundedEvent): void {
  let rigAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(rigAddress)
  if (fundraiser === null) return

  let rig = Rig.load(rigAddress)
  if (rig === null) return

  let unit = Unit.load(rig.unit)
  if (unit === null) return

  // Event params: sender, funder (indexed), amount, day
  let donorAddress = event.params.funder
  let amount = convertTokenToDecimal(event.params.amount, BI_6)
  let day = event.params.epoch

  // Get or create donor account
  let donor = getOrCreateAccount(donorAddress)
  donor.totalRigSpend = donor.totalRigSpend.plus(amount)
  donor.lastActivityAt = event.block.timestamp
  donor.save()

  let fundraiserContract = FundraiserContract.bind(event.address)

  // Resolve dynamic fee toggles (team/protocol can be disabled by setting address(0))
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
  let recipientAmount = calculateFee(amount, RECIPIENT_BPS)
  let teamAmount = hasTeam ? calculateFee(amount, TEAM_BPS) : ZERO_BD
  let protocolAmount = hasProtocol ? calculateFee(amount, PROTOCOL_BPS) : ZERO_BD
  let treasuryAmount = amount.minus(recipientAmount).minus(teamAmount).minus(protocolAmount)

  // Create Donation entity
  let donationId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
  let donation = new Donation(donationId)
  donation.fundraiser = fundraiser.id
  donation.donor = donor.id
  donation.recipient = event.params.recipient
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
  fundraiser.save()

  // Update Rig activity (revenue tracking handled by TreasuryFee/TeamFee event handlers)
  rig.lastActivityAt = event.block.timestamp
  rig.save()

  // Update Unit activity
  unit.lastRigActivityAt = event.block.timestamp
  unit.lastActivityAt = event.block.timestamp
  unit.save()
}

export function handleFundClaimed(event: ClaimedEvent): void {
  let rigAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(rigAddress)
  if (fundraiser === null) return

  let rig = Rig.load(rigAddress)
  if (rig === null) return

  let unit = Unit.load(rig.unit)
  if (unit === null) return

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
  fundraiser.save()

  // Update Rig total minted
  rig.totalMinted = rig.totalMinted.plus(amount)
  rig.lastActivityAt = event.block.timestamp
  rig.save()

  // Update Unit total minted
  unit.totalMinted = unit.totalMinted.plus(amount)
  unit.lastRigActivityAt = event.block.timestamp
  unit.lastActivityAt = event.block.timestamp
  unit.save()

  // Update Protocol total minted
  let protocol = getOrCreateProtocol()
  protocol.totalMinted = protocol.totalMinted.plus(amount)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleFundTreasuryFee(event: FundTreasuryFeeEvent): void {
  // Event params: treasury (indexed), day (indexed), amount
  let rigAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let rig = Rig.load(rigAddress)
  if (rig === null) return

  rig.treasuryRevenue = rig.treasuryRevenue.plus(amount)
  rig.save()

  // Update Protocol treasury revenue
  let protocol = getOrCreateProtocol()
  protocol.totalTreasuryRevenue = protocol.totalTreasuryRevenue.plus(amount)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleFundTeamFee(event: FundTeamFeeEvent): void {
  // Event params: team (indexed), day (indexed), amount
  let rigAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let rig = Rig.load(rigAddress)
  if (rig === null) return

  rig.teamRevenue = rig.teamRevenue.plus(amount)
  rig.save()
}

export function handleFundProtocolFee(event: ProtocolFeeEvent): void {
  // Event params: protocol (indexed), day (indexed), amount
  let rigAddress = event.address.toHexString()
  let amount = convertTokenToDecimal(event.params.amount, BI_6)

  let rig = Rig.load(rigAddress)
  if (rig === null) return

  rig.protocolRevenue = rig.protocolRevenue.plus(amount)
  rig.save()

  // Update Protocol total revenue
  let protocol = getOrCreateProtocol()
  protocol.totalProtocolRevenue = protocol.totalProtocolRevenue.plus(amount)
  protocol.lastUpdated = event.block.timestamp
  protocol.save()
}

export function handleFundRecipientSet(event: RecipientSetEvent): void {
  let rigAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(rigAddress)
  if (fundraiser === null) return

  let recipientId = rigAddress + '-' + event.params.recipient.toHexString()
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
  let rigAddress = event.address.toHexString()
  let rig = Rig.load(rigAddress)
  if (rig === null) return

  rig.uri = event.params.uri
  rig.save()
}

export function handleFundTreasurySet(event: TreasurySetEvent): void {
  let rigAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(rigAddress)
  if (fundraiser === null) return

  fundraiser.treasury = event.params.treasury
  fundraiser.save()
}

export function handleFundTeamSet(event: TeamSetEvent): void {
  let rigAddress = event.address.toHexString()
  let fundraiser = Fundraiser.load(rigAddress)
  if (fundraiser === null) return

  fundraiser.team = event.params.team
  fundraiser.save()
}
