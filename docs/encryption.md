# Encryption Status

## Status: Not end-to-end encrypted

PRIVATECHAT currently has no client-side Signal Protocol implementation, device identity keys, authenticated key exchange, forward secrecy, key rotation, recovery flow, or safety-number verification. The UI disables sending messages and warns that transport encryption is not E2EE. The API schema stores opaque `encryptedPayload` and `encryptionMetadata` fields, but a field name does not prove that the contents are encrypted.

Do not advertise this build as private from the server or use it for sensitive messages. HTTPS/WSS protects traffic in transit; it does not prevent the application server or realtime provider from seeing data if a client sends plaintext.

## Required work before enabling messages

1. Select and verify a maintained, licensed, browser-compatible Signal Protocol implementation with a documented security review.
2. Generate identity and session keys on each client device; persist private material only in an appropriate local secure store and never upload it.
3. Add authenticated device registration and public pre-key publishing/claiming, with replay protection and server-side abuse controls.
4. Encrypt and authenticate message bodies client-side before API submission and Ably publication. Bind conversation, sender, and message identifiers as authenticated associated data.
5. Add multi-device delivery, key changes, recovery limitations, identity fingerprints, and explicit verification UX.
6. Add cryptographic test vectors, tamper/replay tests, browser integration tests, and an independent protocol/security review. Only then enable the composer and change this status.

No custom cryptographic algorithm should be introduced to shortcut this work.