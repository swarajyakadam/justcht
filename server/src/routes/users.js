import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { User } from '../models/User.js'

const router = Router()
const toPublicUser = (user) => ({
  id: user.id,
  userId: user.userId,
  username: user.username,
  fullName: user.fullName,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
})

router.use(requireUser)
router.get('/me', (request, response) => response.json({ user: toPublicUser(request.user) }))

router.get('/search/:userId', async (request, response) => {
  const query = z.string().trim().min(3).max(24).safeParse(request.params.userId)
  if (!query.success) return response.status(400).json({ error: 'Enter a User ID or username.' })
  const value = query.data.toLowerCase()
  const user = await User.findOne({
    accountStatus: 'active',
    $or: [{ userId: value.toUpperCase() }, { username: value }],
  }).select('userId username fullName profilePicture createdAt')
  if (!user || user.id === request.user.id) return response.json({ user: null })
  return response.json({ user: toPublicUser(user) })
})

router.patch('/profile', async (request, response) => {
  const parsed = z.object({
    fullName: z.string().trim().min(1).max(80).optional(),
    username: z.string().trim().regex(/^[a-zA-Z0-9._]{3,24}$/).optional(),
    profilePicture: z.string().url().max(500).or(z.literal('')).optional(),
  }).strict().safeParse(request.body)
  if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return response.status(400).json({ error: 'Profile details are invalid.' })
  try {
    const updated = await User.findByIdAndUpdate(request.user.id, { $set: parsed.data }, { new: true, runValidators: true })
    return response.json({ user: toPublicUser(updated) })
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ error: 'That username is already in use.' })
    throw error
  }
})

export default router