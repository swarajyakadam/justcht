import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { Message } from '../models/Message.js'
import { Conversation } from '../models/Conversation.js'
import { publishConversationMessage } from '../services/realtime.js'
import { getAuthorizedConversation } from '../utils/conversationAccess.js'

const router = Router()
router.use(requireUser)
const envelopeSchema = z.object({
  conversationId: z.string().min(1),
  encryptedPayload: z.string().min(1).max(100_000),
  encryptionMetadata: z.object({ protocol: z.string().min(1).max(64), version: z.string().min(1).max(32) }).passthrough(),
  messageType: z.enum(['text', 'image', 'document']).default('text'),
  clientMessageId: z.string().uuid(),
}).strict()

router.get('/:conversationId', async (request, response) => {
  const conversation = await getAuthorizedConversation(request.params.conversationId, request.user.id)
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })
  const query = z.object({ before: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(50).default(30) }).safeParse(request.query)
  if (!query.success) return response.status(400).json({ error: 'Message page parameters are invalid.' })
  const filter = {
    conversationId: conversation.id,
    deletedFor: { $ne: request.user.id },
    ...(query.data.before ? { messageTimestamp: { $lt: new Date(query.data.before) } } : {}),
  }
  const messages = await Message.find(filter).sort({ messageTimestamp: -1 }).limit(query.data.limit + 1)
  const hasMore = messages.length > query.data.limit
  if (hasMore) messages.pop()
  return response.json({ messages: messages.reverse(), hasMore })
})

router.post('/', async (request, response) => {
  const parsed = envelopeSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Message envelope is invalid.' })
  const conversation = await getAuthorizedConversation(parsed.data.conversationId, request.user.id)
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })

  let message
  try {
    message = await Message.findOneAndUpdate(
      { conversationId: conversation.id, senderId: request.user.id, clientMessageId: parsed.data.clientMessageId },
      { $setOnInsert: { ...parsed.data, senderId: request.user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    if (error?.code !== 11000) throw error
    message = await Message.findOne({ conversationId: conversation.id, senderId: request.user.id, clientMessageId: parsed.data.clientMessageId })
  }
  await Conversation.updateOne({ _id: conversation.id }, { $set: { lastMessageAt: message.messageTimestamp } })

  let realtimePublished = false
  try {
    await publishConversationMessage({ conversationId: conversation.id, message })
    realtimePublished = true
  } catch (error) {
    if (error?.message !== 'REALTIME_NOT_CONFIGURED') console.error('Realtime publish failed')
  }
  return response.status(201).json({ message, realtimePublished })
})

router.patch('/:messageId/read', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.messageId)) return response.status(404).json({ error: 'Message not found.' })
  const message = await Message.findById(request.params.messageId)
  if (!message || !(await getAuthorizedConversation(message.conversationId, request.user.id))) return response.status(404).json({ error: 'Message not found.' })
  if (message.senderId.toString() === request.user.id) return response.json({ ok: true })
  const updated = await Message.findByIdAndUpdate(message.id, {
    $addToSet: { readBy: request.user.id },
    $set: { deliveryStatus: 'read' },
  }, { new: true }).select('id deliveryStatus readBy')
  return response.json({ message: updated })
})

router.delete('/:messageId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.messageId)) return response.status(404).json({ error: 'Message not found.' })
  const mode = z.enum(['me', 'everyone']).safeParse(request.query.mode ?? 'me')
  if (!mode.success) return response.status(400).json({ error: 'Delete mode is invalid.' })
  const message = await Message.findById(request.params.messageId)
  if (!message || !(await getAuthorizedConversation(message.conversationId, request.user.id))) return response.status(404).json({ error: 'Message not found.' })

  if (mode.data === 'everyone') {
    if (message.senderId.toString() !== request.user.id) return response.status(403).json({ error: 'You can only delete your own messages for everyone.' })
    await Message.deleteOne({ _id: message.id })
  } else {
    await Message.updateOne({ _id: message.id }, { $addToSet: { deletedFor: request.user.id } })
  }
  return response.status(204).end()
})

export default router