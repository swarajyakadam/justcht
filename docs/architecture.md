# PRIVATECHAT Architecture

## Runtime

- The existing React/Vite application builds to `dist/` and is served by Vercel's static CDN.
- `api/[...path].js` exports the Express application as one Vercel Function. `vercel.json` sends `/api/*` to that function and all non-API routes to the Vite SPA entry.
- `server/src/` owns Express middleware, route modules, Mongoose models, session configuration, and realtime token issuance. It does not start a listener or depend on a separately hosted application server.
- MongoDB Atlas stores users, contacts, conversations, encrypted message envelopes, and server-side sessions.
- Ably supplies managed WebSocket connections and cross-instance message fan-out. A browser receives only short-lived TokenRequests restricted to subscribe to one conversation channel. The server persists each message envelope to Atlas before publishing it.

## Request flow

1. The browser sends same-origin API requests with its HttpOnly session cookie.
2. Express checks the request origin, connects to Atlas using a warm-instance cached Mongoose connection, and resolves the Mongo-backed session.
3. Route middleware authenticates the user. Conversation reads, writes, and realtime-token requests independently verify participant membership.
4. The message API stores only the encrypted payload and metadata supplied by the client, keyed idempotently by sender and client message ID.
5. After persistence, the server publishes the same opaque envelope to the conversation's Ably channel. Reconnecting clients reload history from Atlas.

## Realtime deployment behavior

Vercel Functions support WebSockets in beta and pin a connection to one function instance until its configured duration expires. A reconnect may land on a different instance; process memory cannot provide cross-instance fan-out. This deployment therefore uses Ably-managed WebSockets rather than a persistent Socket.IO server or a Redis blocking-read loop inside a Function. The Ably API key remains server-only. Configure the Vercel project with Fluid Compute enabled.

## Current limitations

- End-to-end encryption is not implemented. Message sending is intentionally disabled in the UI; the API accepts only opaque envelope fields but cannot prove they are ciphertext.
- Registration and password reset require a real SMTP provider. They do not auto-verify accounts or expose verification tokens in API responses.
- Atlas and Ably production behavior require configured credentials and have not been tested against live services from this workspace.
- Presence, typing indicators, delivery receipts, attachments, device-key registration, and safety numbers are not implemented yet.