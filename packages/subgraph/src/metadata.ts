import { Bytes, JSONValue, JSONValueKind, TypedMap, dataSource, json } from '@graphprotocol/graph-ts'
import { FundraiserMetadata } from '../generated/schema'

function getStringField(object: TypedMap<string, JSONValue>, key: string): string | null {
  let value = object.get(key)
  if (value === null || value.kind != JSONValueKind.STRING) {
    return null
  }

  return value.toString()
}

function getStringArrayField(object: TypedMap<string, JSONValue>, key: string): Array<string> | null {
  let value = object.get(key)
  if (value === null || value.kind != JSONValueKind.ARRAY) {
    return null
  }

  let items = value.toArray()
  let result = new Array<string>()

  for (let i = 0; i < items.length; i++) {
    if (items[i].kind == JSONValueKind.STRING) {
      result.push(items[i].toString())
    }
  }

  return result
}

export function handleFundraiserMetadata(content: Bytes): void {
  let context = dataSource.context()
  let metadataId = context.getString('metadataId')
  let fundraiserId = context.getString('fundraiserId')
  let uri = context.getString('uri')

  let metadata = new FundraiserMetadata(metadataId)
  metadata.fundraiserId = fundraiserId
  metadata.uri = uri

  let value = json.fromBytes(content)
  if (value.kind != JSONValueKind.OBJECT) {
    metadata.save()
    return
  }

  let object = value.toObject()
  metadata.image = getStringField(object, 'image')
  metadata.name = getStringField(object, 'name')
  metadata.symbol = getStringField(object, 'symbol')
  metadata.description = getStringField(object, 'description')
  metadata.defaultMessage = getStringField(object, 'defaultMessage')
  metadata.recipientName = getStringField(object, 'recipientName')

  let links = getStringArrayField(object, 'links')
  if (links !== null) {
    metadata.links = links
  }

  metadata.save()
}
