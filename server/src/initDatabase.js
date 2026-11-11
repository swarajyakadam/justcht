import process from 'node:process'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { User } from './models/User.js'
import { Contact } from './models/Contact.js'
import { Conversation } from './models/Conversation.js'
import { Message } from './models/Message.js'

dotenv.config({ path: '.env', override: true })

const configuredUri = process.env.MONGODB_URI
const requiredModels = [User, Contact, Conversation, Message]
const requiredCollections = ['devices', 'sessions']

function safeUriCheck(value) {
  if (!value) return 'MONGODB_URI is missing.'
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return 'MONGODB_URI is malformed.'
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) return 'MONGODB_URI must use mongodb:// or mongodb+srv://.'
  if (/<[^>]+>|your[-_ ]?password|username:password/i.test(value)) return 'MONGODB_URI still contains template placeholders.'
  if (!decodeURIComponent(parsed.username) || !decodeURIComponent(parsed.password)) return 'MONGODB_URI must include the Atlas database username and password.'
  return null
}

const validationError = safeUriCheck(configuredUri)
if (validationError) {
  console.error(validationError)
  process.exit(1)
}

const uri = new URL(configuredUri)
if (!uri.pathname || uri.pathname === '/') uri.pathname = '/privatechat'

try {
  await mongoose.connect(uri.toString(), { serverSelectionTimeoutMS: 12_000, maxPoolSize: 2 })
  await mongoose.connection.db.admin().command({ ping: 1 })
  const db = mongoose.connection.db
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name))

  for (const model of requiredModels) {
    if (!existing.has(model.collection.collectionName)) await model.createCollection()
    if (model === User) {
      const emailIndex = (await User.collection.indexes()).find((index) => index.name === 'email_1')
      if (emailIndex && emailIndex.unique && emailIndex.sparse !== true) await User.collection.dropIndex('email_1')
    }
    await model.createIndexes()
  }

  for (const name of requiredCollections) {
    if (!existing.has(name)) await db.createCollection(name)
  }
  await db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 })

  console.log(JSON.stringify({
    result: 'success',
    database: db.databaseName,
    collections: [...requiredModels.map((model) => model.collection.collectionName), ...requiredCollections],
    indexes: 'created or verified',
  }))
} catch (error) {
  console.error(JSON.stringify({
    result: 'failed',
    errorType: error.name,
    code: error.code ?? null,
    codeName: error.codeName ?? null,
    action: error.code === 8000 ? 'Check Atlas database username/password and database-user permissions.' : 'Check the Atlas network access list and connection URI.',
  }))
  process.exitCode = 1
} finally {
  await mongoose.disconnect().catch(() => {})
}