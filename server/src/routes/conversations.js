import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { Contact } from '../models/Contact.js'
import { Conversation } from '../models/Conversation.js'
import { Message } from '../models/Message.js'
import { User } from '../models/User.js'

const router = Router()
router.use(requireUser)

const publicParticipant = (user) => ({ id: user.id, userId: user.userId, username: user.username, fullName: user.fullName, profilePicture: user.profilePicture })

router.get('/', async (request, response) => {
  const conversations = await Conversation.find({ participants: request.user.id })
    .populate('participants', 'userId username fullName profilePicture')
    .sort({ updatedAt: -1 })
  const items = await Promise.all(conversations.map(async (conversation) => {
    const other = conversation.participants.find((participant) => participant.id !== request.user.id)
    const lastMessage = await Message.findOne({ conversationId: conversation.id, deletedFor: { $ne: request.user.id } })
      .sort({ messageTimestamp: -1 }).select('encryptedPayload messageType deliveryStatus messageTimestamp senderId')
    const unreadCount = await Message.countDocuments({
      conversationId: conversation.id,
      senderId: { $ne: request.user.id },
      readBy: { $ne: request.user.id },
      deletedFor: { $ne: request.user.id },
    })
    return { id: conversation.id, participant: other ? publicParticipant(other) : null, lastMessage, unreadCount, updatedAt: conversation.updatedAt }
  }))
  return response.json({ conversations: items })
})

router.post('/', async (request, response) => {
  const parsed = z.object({ userId: z.string().trim().min(3).max(24) }).strict().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid User ID or username.' })
  const identifier = parsed.data.userId.toLowerCase()
  const participant = await User.findOne({ accountStatus: 'active', $or: [{ userId: identifier.toUpperCase() }, { username: identifier }] })
  if (!participant) return response.status(404).json({ error: 'No matching user was found.' })
  if (participant.id === request.user.id) return response.status(400).json({ error: 'You cannot start a conversation with yourself.' })

  const pair = [request.user.id, participant.id].sort()
  const conversation = await Conversation.findOneAndUpdate(
    { pairKey: pair.join(':') },
    { $setOnInsert: { participants: pair, pairKey: pair.join(':'), conversationType: 'personal' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  await Contact.findOneAndUpdate(
    { userId: request.user.id, contactUserId: participant.id },
    { $setOnInsert: { userId: request.user.id, contactUserId: participant.id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return response.status(201).json({ conversation: { id: conversation.id, participant: publicParticipant(participant), updatedAt: conversation.updatedAt } })
})

router.get('/:conversationId', async (request, response) => {
  const conversation = await Conversation.findOne({ _id: request.params.conversationId, participants: request.user.id })
    .populate('participants', 'userId username fullName profilePicture')
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })
  const participant = conversation.participants.find((item) => item.id !== request.user.id)
  return response.json({ conversation: { id: conversation.id, participant: participant ? publicParticipant(participant) : null, updatedAt: conversation.updatedAt } })
})

router.delete('/:conversationId', async (request, response) => {
  const mode = z.enum(['me', 'everyone']).safeParse(request.query.mode ?? 'me')
  if (!mode.success) return response.status(400).json({ error: 'Invalid mode.' })
  const conversation = await Conversation.findOne({ _id: request.params.conversationId, participants: request.user.id })
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })
  if (mode.data === 'everyone') {
    await Message.deleteMany({ conversationId: conversation.id })
    await Conversation.deleteOne({ _id: conversation.id })
  } else {
    await Message.updateMany({ conversationId: conversation.id }, { $addToSet: { deletedFor: request.user.id } })
  }
  return response.status(204).end()
})

export default router