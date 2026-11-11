import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { createConversationTokenRequest } from '../services/realtime.js'
import { getAuthorizedConversation } from '../utils/conversationAccess.js'

const router = Router()
router.post('/token', requireUser, async (request, response) => {
  const parsed = z.object({ conversationId: z.string().min(1) }).strict().safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Conversation is required.' })
  const conversation = await getAuthorizedConversation(parsed.data.conversationId, request.user.id)
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' })
  try {
    const tokenRequest = await createConversationTokenRequest({ conversationId: conversation.id, userId: request.user.userId })
    response.set('Cache-Control', 'no-store')
    return response.json(tokenRequest)
  } catch (error) {
    if (error?.message === 'REALTIME_NOT_CONFIGURED') return response.status(503).json({ error: 'Realtime delivery is not configured.' })
    throw error
  }
})

export default router