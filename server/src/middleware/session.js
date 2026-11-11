import process from 'node:process'
import MongoStore from 'connect-mongo'
import session from 'express-session'
import mongoose from 'mongoose'

let sessionMiddleware

export function getSessionMiddleware() {
  if (sessionMiddleware) return sessionMiddleware
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET_NOT_CONFIGURED')
  const isProd = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'

  sessionMiddleware = session({
    name: 'privatechat.sid',
    secret,
    store: MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'sessions', ttl: 30 * 24 * 60 * 60 }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'strict',
      secure: isProd,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    },
  })
  return sessionMiddleware
}