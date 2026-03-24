import { ByteArray, crypto } from '@graphprotocol/graph-ts'

export function getIpfsPathFromUri(uri: string): string | null {
  if (!uri.startsWith('ipfs://')) {
    return null
  }

  let path = uri.slice(7)
  if (path.startsWith('ipfs/')) {
    path = path.slice(5)
  }

  if (path.length == 0) {
    return null
  }

  return path
}

export function buildFundraiserMetadataId(fundraiserId: string, uri: string): string {
  let digest = crypto.keccak256(ByteArray.fromUTF8(uri)).toHexString()
  return fundraiserId.concat('-').concat(digest)
}
