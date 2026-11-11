import process from 'node:process'
import Ably from 'ably'
import { conversationChannel } from '../utils/conversationAccess.js'

let realtimeClient

function getClient() {
  if (!process.env.ABLY_API_KEY) throw new Error('REALTIME_NOT_CONFIGURED')
  if (!realtimeClient) realtimeClient = new Ably.Rest({ key: process.env.ABLY_API_KEY })
  return realtimeClient
}

export async function createConversationTokenRequest({ conversationId, userId }) {
  const channel = conversationChannel(conversationId)
  return getClient().auth.createTokenRequest({
    clientId: userId,
    capability: JSON.stringify({ [channel]: ['subscribe'] }),
    ttl: 60 * 60_000,
  })
}

export async function publishConversationMessage({ conversationId, message }) {
  const channel = getClient().channels.get(conversationChannel(conversationId))
  await channel.publish({
    name: 'message',
    data: {
      id: message.id,
      senderId: message.senderId,
      encryptedPayload: message.encryptedPayload,
      encryptionMetadata: message.encryptionMetadata,
      messageType: message.messageType,
      clientMessageId: message.clientMessageId,
      messageTimestamp: message.messageTimestamp,
    },
  })
}