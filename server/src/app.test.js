import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { afterEach, test } from 'node:test'
import app from './app.js'

let server
let baseUrl

async function startServer() {
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
}

afterEach(async () => {
  if (!server) return
  await new Promise((resolve) => server.close(resolve))
  server = undefined
})

test('health endpoint is available without database secrets and includes security headers', async () => {
  await startServer()
  const response = await fetch(`${baseUrl}/api/health`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'privatechat-api' })
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
})

test('cookie-authenticated mutations reject requests without an allowed browser origin', async () => {
  await startServer()
  const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'Request origin is not allowed.' })
})

test('API fails closed with a sanitized configuration response when Atlas is unavailable', async () => {
  await startServer()
  const response = await fetch(`${baseUrl}/api/users/me`, { headers: { origin: 'http://localhost:5173' } })

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'The API is not fully configured.' })
})

test('oversized request bodies are rejected', async () => {
  await startServer()
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ payload: 'x'.repeat(70_000) }),
  })

  assert.equal(response.status, 413)
  assert.deepEqual(await response.json(), { error: 'Request body is too large.' })
})