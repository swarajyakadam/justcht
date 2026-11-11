import process from 'node:process'
import { createHash, randomBytes } from 'node:crypto'
const isProd = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
import { Router } from 'express'
import argon2 from 'argon2'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { requireUser } from '../middleware/requireUser.js'
import { User } from '../models/User.js'
import { sendAccountLink } from '../services/email.js'

const router = Router()
const createAuthLimit = (limit = 10) => rateLimit({
  windowMs: 15 * 60_000,
  limit: process.env.NODE_ENV === 'production' ? limit : 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' }),
})
const registerLimit = createAuthLimit(10)
const verifyLimit = createAuthLimit(10)
const loginLimit = createAuthLimit(10)
const logoutAllLimit = createAuthLimit(5)
const recoveryLimit = createAuthLimit(5)
const passwordSchema = z.string().min(10).max(128)
const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  username: z.string().trim().regex(/^[a-zA-Z0-9._]{3,24}$/),
  password: passwordSchema,
  acceptedTerms: z.literal(true),
}).strict()
const genericCredentials = { error: 'Sign-in failed. Check your credentials and try again.' }
const hashToken = (token) => createHash('sha256').update(token).digest('hex')
const newToken = () => {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) }
}
const safeUser = (user) => ({
  id: user.id,
  userId: user.userId,
  username: user.username,
  fullName: user.fullName,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
})
const emailLink = (path, token) => {
  const url = new URL(path, process.env.APP_URL ?? 'http://localhost:5173')
  url.searchParams.set('token', token)
  return url.toString()
}

router.post('/register', registerLimit, async (request, response) => {
  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Check the account details and try again.' })

  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const userId = `PC${String(randomBytes(2).readUInt16BE() % 10_000).padStart(4, '0')}`
    try {
      const user = await User.create({
        userId,
        fullName: parsed.data.fullName,
        username: parsed.data.username.toLowerCase(),
        passwordHash,
        emailVerified: true,
        accountStatus: 'active',
      })
      return response.status(201).json({ user: safeUser(user) })
    } catch (error) {
      if (error?.code !== 11000) throw error
      if (error.keyPattern?.userId) continue
      if (error.keyPattern?.username) return response.status(409).json({ error: 'That username is already in use.' })
      throw error
    }
  }

  return response.status(503).json({ error: 'User ID allocation is temporarily unavailable. Try again shortly.' })
})

router.post('/verify-email', verifyLimit, async (request, response) => {
  const parsed = z.string().min(32).max(128).safeParse(request.body?.token)
  if (!parsed.success) return response.status(400).json({ error: 'Verification link is invalid or expired.' })
  const user = await User.findOne({ verificationTokenHash: hashToken(parsed.data), verificationExpiresAt: { $gt: new Date() } })
    .select('+verificationTokenHash')
  if (!user) return response.status(400).json({ error: 'Verification link is invalid or expired.' })

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidateId = `PC${String(randomBytes(2).readUInt16BE() % 10_000).padStart(4, '0')}`
    try {
      await User.updateOne({ _id: user._id, emailVerified: false }, {
        $set: { userId: candidateId, emailVerified: true, accountStatus: 'active' },
        $unset: { verificationTokenHash: 1, verificationExpiresAt: 1 },
      })
      const verified = await User.findById(user._id)
      if (verified?.emailVerified) {
        await new Promise((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()))
        request.session.userId = verified.id
        request.session.authVersion = verified.authVersion
        await new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
        return response.json({ user: safeUser(verified) })
      }
      break
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
  }
  return response.status(503).json({ error: 'User ID allocation is temporarily unavailable. Try again shortly.' })
})

router.post('/login', loginLimit, async (request, response) => {
  const parsed = z.object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().optional(),
  }).safeParse(request.body)
  if (!parsed.success) return response.status(401).json(genericCredentials)

  const identifier = parsed.data.identifier.toLowerCase()
  const user = await User.findOne({ $or: [{ username: identifier }, { userId: identifier }] })
    .select('+passwordHash +loginFailures +lockedUntil')
  const locked = user?.lockedUntil && user.lockedUntil > new Date()
  const validPassword = user && !locked
    ? await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false)
    : false
  if (!user || !validPassword || !user.emailVerified || user.accountStatus !== 'active') {
    if (user && !locked) {
      const failures = (user.loginFailures ?? 0) + 1
      await User.updateOne({ _id: user._id }, {
        $set: { loginFailures: failures, ...(failures >= 5 ? { lockedUntil: new Date(Date.now() + Math.min(failures - 4, 12) * 60_000) } : {}) },
      })
    }
    return response.status(401).json(genericCredentials)
  }

  await User.updateOne({ _id: user._id }, { $set: { loginFailures: 0 }, $unset: { lockedUntil: 1 } })
  await new Promise((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()))
  request.session.userId = user.id
  request.session.authVersion = user.authVersion
  request.session.cookie.maxAge = parsed.data.rememberMe ? 30 * 24 * 60 * 60_000 : 60 * 60_000
  await new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
  return response.json({ user: safeUser(user) })
})

router.post('/logout', async (request, response) => {
  if (request.session) await new Promise((resolve) => request.session.destroy(() => resolve()))
  response.clearCookie('privatechat.sid', { httpOnly: true, sameSite: isProd ? 'none' : 'strict', secure: isProd, path: '/' })
  return response.status(204).end()
})

router.post('/logout-all', logoutAllLimit, requireUser, async (request, response) => {
  await User.updateOne({ _id: request.user.id }, { $inc: { authVersion: 1 } })
  await new Promise((resolve) => request.session.destroy(() => resolve()))
  response.clearCookie('privatechat.sid', { httpOnly: true, sameSite: isProd ? 'none' : 'strict', secure: isProd, path: '/' })
  return response.status(204).end()
})

router.post('/forgot-password', recoveryLimit, async (request, response) => {
  const parsed = z.string().email().safeParse(request.body?.email)
  if (parsed.success) {
    const user = await User.findOne({ email: parsed.data.toLowerCase(), emailVerified: true })
    if (user) {
      const reset = newToken()
      await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: reset.tokenHash, resetExpiresAt: reset.expiresAt } })
      await sendAccountLink({
        to: user.email,
        subject: 'Reset your PRIVATECHAT password',
        url: emailLink('/reset-password', reset.token),
        action: 'Reset your password:',
      }).catch(() => {})
    }
  }
  return response.json({ message: 'If an account matches that email, reset instructions will be sent.' })
})

router.post('/reset-password', recoveryLimit, async (request, response) => {
  const parsed = z.object({ token: z.string().min(32).max(128), password: passwordSchema }).safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Reset link is invalid or expired.' })
  const user = await User.findOne({ resetTokenHash: hashToken(parsed.data.token), resetExpiresAt: { $gt: new Date() } })
  if (!user) return response.status(400).json({ error: 'Reset link is invalid or expired.' })
  user.passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })
  user.resetTokenHash = undefined
  user.resetExpiresAt = undefined
  user.authVersion += 1
  await user.save()
  return response.json({ message: 'Password updated. Sign in with your new password.' })
})

router.get('/me', async (request, response) => {
  if (!request.session?.userId) return response.json({ user: null })
  const user = await User.findById(request.session.userId)
  if (!user || user.accountStatus !== 'active' || request.session.authVersion !== user.authVersion) {
    await new Promise((resolve) => request.session.destroy(() => resolve()))
    return response.json({ user: null })
  }
  return response.json({ user: safeUser(user) })
})
router.post('/refresh', requireUser, (request, response) => response.json({ user: safeUser(request.user) }))

export default router