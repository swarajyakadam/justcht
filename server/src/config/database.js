import process from 'node:process'
import mongoose from 'mongoose'

let connectionPromise

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!process.env.MONGODB_URI) throw new Error('DATABASE_NOT_CONFIGURED')
  if (!connectionPromise) {
    const uri = new URL(process.env.MONGODB_URI)
    if (!uri.pathname || uri.pathname === '/') uri.pathname = '/privatechat'
    connectionPromise = mongoose.connect(uri.toString(), {
      serverSelectionTimeoutMS: 15_000,
      maxPoolSize: 5,
      autoIndex: true,
    }).catch((error) => {
      connectionPromise = undefined
      throw error
    })
  }
  await connectionPromise
  return mongoose.connection
}