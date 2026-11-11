# PRIVATECHAT

PRIVATECHAT is an existing Vite + React application extended with a Vercel-hosted Express API, MongoDB Atlas persistence, and Ably-managed realtime channels. Signup uses a username and password without requiring an email address; successful registration allocates a `PC####` ID. The app implements user search, contacts, conversations, profile/settings, server-side sessions, and encrypted-envelope persistence. Message composition remains disabled because end-to-end encryption is not yet implemented.

## Architecture

```text
Browser (React/Vite) -> Vercel CDN
        | same-origin /api
        v
Vercel Function (Express) -> MongoDB Atlas
        | server-published envelopes / short-lived scoped tokens
        v
Ably-managed WebSockets -> authorized browser subscribers
```

The API source is under `server/src/`; Vercel's Function entry is `api/[...path].js`. Vercel Functions may scale to different instances and have duration-bounded WebSockets. Ably supplies managed connections and cross-instance fan-out; MongoDB remains the durable message history.

## Local setup

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and configure MongoDB Atlas, a 32+ character session secret, an email provider, and an Ably API key. Keep all secrets server-side; never prefix them with `VITE_`.
4. Start Vite with `npm run dev`. The API's production entry uses Vercel Functions; run the Vercel CLI with `vercel dev` to exercise API routing locally.
5. Run checks with `npm test`, `npm run lint`, and `npm run build`.

Password reset emails are available only for legacy accounts that have an email address stored. New accounts do not require or collect email, so users must keep their password secure.

## Vercel deployment

1. Create a MongoDB Atlas cluster and database user with only the required database permissions. Restrict network access according to your Vercel plan and Atlas networking setup; use TLS and encrypted backups.
2. Create an Ably app/API key. Use a key that can issue tokens and publish server events. The key must remain a Vercel server environment variable.
3. Configure the Vercel project from this repository root. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`. `vercel.json` already configures the SPA rewrite, API Function, security headers, and Fluid Compute.
4. Enable Fluid Compute in Vercel Function settings. WebSocket support on Vercel is plan-wide but duration-bounded; this build uses Ably-managed sockets so the app does not rely on a process-local Socket.IO room.
5. Add the following server variables in Vercel Project Settings for Production and Preview as appropriate:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Atlas connection string; server-only |
| `SESSION_SECRET` | Random session signing secret, at least 32 characters |
| `ABLY_API_KEY` | Server-only Ably API key |
| `CLIENT_ORIGIN` | Exact deployed frontend origin, such as `https://privatechat.example` |
| `APP_URL` | Exact origin used in email verification/reset links |
| `COOKIE_SECURE` | Set to `true` in production |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Account email delivery |

6. Set Atlas network access, verify the origin matches the final deployment hostname, and deploy with `vercel --prod`.
7. Test `/api/health`, registration plus email verification, login/logout, search/contact creation, and realtime delivery using two accounts on the deployed site. Verify the browser never receives `ABLY_API_KEY`, `SESSION_SECRET`, or `MONGODB_URI`.

Vercel Marketplace integrations may inject service variables automatically; verify their names before relying on them. `.env.example` contains placeholders only and must never contain live credentials.

## Current limitations

- End-to-end encryption is **not implemented**. Sending is disabled, and the app must not be used for sensitive communication.
- Live services cannot be integration-tested until Atlas, SMTP, and Ably credentials are supplied.
- Presence, typing indicators, attachments, safety numbers, device enrollment, and production-grade shared rate limiting remain future work.

Read `docs/architecture.md`, `docs/security.md`, `docs/encryption.md`, and `docs/api.md` before deployment.# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
