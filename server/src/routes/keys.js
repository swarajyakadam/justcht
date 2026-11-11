import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { UserKey } from '../models/UserKey.js'
import { User } from '../models/User.js'

const router = Router()
router.use(requireUser)

// Publish or update own public key
router.post('/', async (request, response) => {
  const parsed = z.object({ publicKey: z.string().min(10).max(200) }).strict().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Invalid public key.' })
  await UserKey.findOneAndUpdate(
    { userId: request.user.id },
    { $set: { publicKey: parsed.data.publicKey } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return response.status(204).end()
})

// Fetch another user's public key by their userId (PC####)
router.get('/:userId', async (request, response) => {
  const user = await User.findOne({ userId: request.params.userId.toUpperCase(), accountStatus: 'active' }).select('_id')
  if (!user) return response.status(404).json({ error: 'User not found.' })
  const key = await UserKey.findOne({ userId: user._id }).select('publicKey')
  if (!key) return response.status(404).json({ error: 'No key published for this user.' })
  return response.json({ publicKey: key.publicKey })
})

export default router
