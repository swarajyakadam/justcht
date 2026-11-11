import process from 'node:process'
import { createServer } from 'node:http'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: '.env', override: true })

const [{ default: app }, { connectDatabase }] = await Promise.all([
  import('./app.js'),
  import('./config/database.js'),
])

const port = Number(process.env.API_PORT ?? 3001)

try {
  await connectDatabase()
  console.log('MongoDB Atlas connection established.')
} catch {
  console.error('MongoDB Atlas connection failed. Check the URI, database user, and Atlas network access list.')
}

const server = createServer(app)
server.listen(port, '127.0.0.1', () => {
  console.log(`PRIVATECHAT API listening on http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await mongoose.disconnect()
    server.close(() => process.exit(0))
  })
}