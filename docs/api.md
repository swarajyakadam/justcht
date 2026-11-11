# API Surface

All routes are same-origin under `/api`. Authenticated requests use the HttpOnly `privatechat.sid` cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create pending account and send email verification |
| POST | `/auth/verify-email` | Verify email, allocate unique `PC####` ID, and start a session |
| POST | `/auth/login` | Sign in by User ID or username |
| POST | `/auth/logout` | Revoke current session |
| POST | `/auth/logout-all` | Increment account auth version and revoke all sessions |
| POST | `/auth/refresh` | Validate current session |
| POST | `/auth/forgot-password` | Request generic password-reset response |
| POST | `/auth/reset-password` | Set a new password and invalidate existing sessions |
| GET | `/auth/me`, `/users/me` | Read current public profile |
| GET | `/users/search/:userId` | Search public profile by User ID or username |
| PATCH | `/users/profile` | Update full name, username, or image URL |
| GET/POST | `/contacts` | List or add a contact |
| DELETE | `/contacts/:contactId` | Remove an owned contact |
| GET/POST | `/conversations` | List or create/retrieve a personal conversation |
| GET | `/conversations/:conversationId` | Read an authorized conversation |
| GET | `/messages/:conversationId` | Read a paginated encrypted-envelope history |
| POST | `/messages` | Idempotently persist an opaque message envelope, then publish it |
| PATCH | `/messages/:messageId/read` | Mark an authorized message read |
| DELETE | `/messages/:messageId?mode=me\|everyone` | Delete for self or sender-only within 15 minutes for everyone |
| POST | `/realtime/token` | Issue authorized subscribe-only Ably TokenRequest |
| GET | `/health` | Function health check |

Message POST requires `conversationId`, a client-generated UUID `clientMessageId`, a bounded `encryptedPayload`, and versioned `encryptionMetadata`. The UI does not currently submit messages because a reviewed E2EE client is not yet present.