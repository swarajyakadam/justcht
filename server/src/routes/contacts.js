import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { Contact } from '../models/Contact.js'
import { User } from '../models/User.js'

const router = Router()
router.use(requireUser)

router.get('/', async (request, response) => {
  const contacts = await Contact.find({ userId: request.user.id })
    .populate('contactUserId', 'userId username fullName profilePicture')
    .sort({ createdAt: -1 })
  return response.json({ contacts: contacts.map((contact) => ({ id: contact.id, user: contact.contactUserId, createdAt: contact.createdAt })) })
})

router.post('/', async (request, response) => {
  const parsed = z.object({ userId: z.string().trim().min(3).max(24) }).strict().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid User ID or username.' })
  const identifier = parsed.data.userId.toLowerCase()
  const contactUser = await User.findOne({ accountStatus: 'active', $or: [{ userId: identifier.toUpperCase() }, { username: identifier }] })
  if (!contactUser) return response.status(404).json({ error: 'No matching user was found.' })
  if (contactUser.id === request.user.id) return response.status(400).json({ error: 'You cannot add yourself.' })
  const contact = await Contact.findOneAndUpdate(
    { userId: request.user.id, contactUserId: contactUser.id },
    { $setOnInsert: { userId: request.user.id, contactUserId: contactUser.id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return response.status(201).json({ contact: { id: contact.id, user: { id: contactUser.id, userId: contactUser.userId, username: contactUser.username, fullName: contactUser.fullName, profilePicture: contactUser.profilePicture } } })
})

router.delete('/:contactId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.contactId)) return response.status(404).json({ error: 'Contact not found.' })
  const removed = await Contact.findOneAndDelete({ _id: request.params.contactId, userId: request.user.id })
  if (!removed) return response.status(404).json({ error: 'Contact not found.' })
  return response.status(204).end()
})

export default router