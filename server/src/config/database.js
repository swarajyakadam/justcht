import process from 'node:process'
import mongoose from 'mongoose'

let connectionPromise

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!process.env.MONGODB_URI) throw new Error('DATABASE_NOT_CONFIGURED')
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
      autoIndex: process.env.NODE_ENV !== 'production',
    }).catch((error) => {
      connectionPromise = undefined
      throw error
    })
  }
  await connectionPromise
  return mongoose.connection
}