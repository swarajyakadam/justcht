import { randomBytes } from 'node:crypto'
import process from 'node:process'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: '.env', override: true })

const { User } = await import('./models/User.js')
const apiOrigin = 'http://127.0.0.1:5173'
const username = `pc_test_${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const password = 'Temporary-Flow-Test-2026!'
const result = {}
const databaseUri = new URL(process.env.MONGODB_URI)
if (!databaseUri.pathname || databaseUri.pathname === '/') databaseUri.pathname = '/privatechat'

try {
  await mongoose.connect(databaseUri.toString(), { serverSelectionTimeoutMS: 15_000, maxPoolSize: 1 })
  await User.deleteMany({
    username: /^pc_test_[a-z0-9]+$/,
    fullName: 'Temporary Signup Test',
    createdAt: { $gte: new Date(Date.now() - 60 * 60_000) },
  })
  await mongoose.disconnect()

  let response = await fetch(`${apiOrigin}/api/auth/register`, {
    method: 'POST',
    headers: { origin: apiOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: 'Temporary Signup Test', username, password, acceptedTerms: true }),
  })
  result.signupStatus = response.status
  const signup = await response.json()
  if (response.status !== 201) throw new Error('SIGNUP_FAILED')
  result.userIdGenerated = Boolean(signup.user?.userId?.startsWith('PC') && signup.user.userId.length === 6)

  response = await fetch(`${apiOrigin}/api/auth/login`, {
    method: 'POST',
    headers: { origin: apiOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: username, password }),
  })
  result.loginStatus = response.status
  if (!response.ok) throw new Error('LOGIN_FAILED')
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]
  if (!cookie) throw new Error('SESSION_COOKIE_MISSING')

  response = await fetch(`${apiOrigin}/api/auth/me`, { headers: { cookie } })
  result.sessionStatus = response.status
  if (!response.ok) throw new Error('SESSION_CHECK_FAILED')

  response = await fetch(`${apiOrigin}/api/auth/logout`, { method: 'POST', headers: { origin: apiOrigin, cookie } })
  result.logoutStatus = response.status
  if (!response.ok) throw new Error('LOGOUT_FAILED')
} catch (error) {
  result.failedStage = error.message
  process.exitCode = 1
} finally {
  try {
    if (mongoose.connection.readyState !== 1) await mongoose.connect(databaseUri.toString(), { serverSelectionTimeoutMS: 15_000, maxPoolSize: 1 })
    await User.deleteOne({ username })
    result.testAccountRemoved = true
  } catch {
    result.testAccountRemoved = false
    process.exitCode = 1
  }
  await mongoose.disconnect().catch(() => {})
  console.log(JSON.stringify(result))
}