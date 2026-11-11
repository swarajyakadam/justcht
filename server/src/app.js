import process from 'node:process'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { connectDatabase } from './config/database.js'
import { getSessionMiddleware } from './middleware/session.js'
import authRouter from './routes/auth.js'
import contactsRouter from './routes/contacts.js'
import conversationsRouter from './routes/conversations.js'
import messagesRouter from './routes/messages.js'
import realtimeRouter from './routes/realtime.js'
import usersRouter from './routes/users.js'

const app = express()
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean))

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({ frameguard: { action: 'deny' } }))
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, origin || '*')
    return callback(new Error('CORS_ORIGIN_DENIED'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '64kb' }))
app.use(rateLimit({ windowMs: 60_000, limit: process.env.NODE_ENV === 'production' ? 120 : 10_000, standardHeaders: 'draft-8', legacyHeaders: false }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'privatechat-api' })
})

app.use('/api', (request, response, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.get('origin')
    if (origin && !allowedOrigins.has(origin)) {
      return response.status(403).json({ error: 'Request origin is not allowed.' })
    }
  }
  connectDatabase()
    .then(() => getSessionMiddleware()(request, response, next))
    .catch(next)
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/realtime', realtimeRouter)

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error)
  if (error?.type === 'entity.too.large') return response.status(413).json({ error: 'Request body is too large.' })
  if (error?.message === 'CORS_ORIGIN_DENIED') return response.status(403).json({ error: 'Request origin is not allowed.' })
  if (['DATABASE_NOT_CONFIGURED', 'SESSION_SECRET_NOT_CONFIGURED'].includes(error?.message)) {
    return response.status(503).json({ error: 'The API is not fully configured.' })
  }
  console.error('API request failed')
  return response.status(500).json({ error: 'An unexpected server error occurred.' })
})

export default app