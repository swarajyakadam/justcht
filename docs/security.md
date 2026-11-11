# Security Notes

## Implemented controls

- Argon2id password hashes; password reset and email verification tokens are random, stored as SHA-256 digests, and expire after one hour.
- HTTP-only, SameSite=Strict session cookies are backed by MongoDB and regenerated after login/email verification. A per-user authorization version invalidates all sessions after password reset or logout-all.
- Helmet headers, request-size limits, schema validation with Zod, per-process request throttling, strict configured-origin checks on mutations, generic credential errors, and sanitized server errors.
- Unique indexes protect username, email, user ID, contact pairs, conversation pairs, and per-sender client message IDs.
- Conversation/message access and realtime-token issuance require database membership checks. Public user results omit email and password data.
- Realtime tokens are short-lived and receive subscribe-only capability for one conversation channel. Ably credentials and MongoDB connection strings are server environment variables, never Vite `VITE_*` variables.

## Deployment requirements

- Use MongoDB Atlas network access rules limited to the required Vercel egress strategy for the selected plan, a least-privilege database user, TLS, and encrypted backups.
- Set a long random `SESSION_SECRET`; rotate it deliberately because rotation invalidates sessions.
- Configure production `CLIENT_ORIGIN`, `APP_URL`, `COOKIE_SECURE=true`, SMTP credentials, and the private `ABLY_API_KEY` in Vercel Project Settings. Add values to Production and Preview environments intentionally.
- Never log passwords, tokens, cookies, message payloads, or database credentials. Restrict Vercel logs and provider dashboards to authorized operators.
- Rate limiting uses an in-process store and is not globally coordinated across Function instances. Add a managed shared limiter before production traffic or rely on tested Vercel Firewall rules in addition to this baseline.

## Residual risk

This is not a security certification. The app is not end-to-end encrypted, public four-digit IDs are enumerable in principle, uploaded file handling is not implemented, and shared/global abuse limits and operational monitoring need deployment-specific review. Do not use it for sensitive communications until E2EE is implemented, independently reviewed, and tested.