// X25519 ECDH key exchange + AES-256-GCM per-message encryption
// Private keys are generated in the browser and NEVER leave the device.
// Only the public key is uploaded to the server.
// The server stores and forwards ciphertext only — it cannot read messages.

const DB_NAME = 'privatechat-keys'
const DB_STORE = 'keypairs'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(DB_STORE)
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    const req = tx.objectStore(DB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Generate or load this device's X25519 ECDH keypair
export async function getOrCreateIdentityKeypair() {
  const stored = await dbGet('identity')
  if (stored) {
    const privateKey = await crypto.subtle.importKey('pkcs8', stored.privateKeyRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
    const publicKey = await crypto.subtle.importKey('spki', stored.publicKeyRaw, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
    return { privateKey, publicKey, publicKeyRaw: stored.publicKeyRaw }
  }
  const keypair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keypair.privateKey)
  const publicKeyRaw = await crypto.subtle.exportKey('spki', keypair.publicKey)
  await dbPut('identity', { privateKeyRaw, publicKeyRaw })
  return { privateKey: keypair.privateKey, publicKey: keypair.publicKey, publicKeyRaw }
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Export public key as base64 for server storage
export function exportPublicKey(publicKeyRaw) {
  return toBase64(publicKeyRaw)
}

// Import a base64 public key from the server
export async function importPublicKey(b64) {
  const raw = fromBase64(b64)
  return crypto.subtle.importKey('spki', raw, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
}

// Derive a shared AES-256-GCM key from our private key + their public key
async function deriveSharedKey(privateKey, theirPublicKey) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// Encrypt plaintext → base64 envelope: "<iv_b64>.<ciphertext_b64>"
export async function encryptMessage(plaintext, myPrivateKey, theirPublicKey) {
  const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded)
  return `${toBase64(iv)}.${toBase64(ciphertext)}`
}

// Decrypt base64 envelope → plaintext
export async function decryptMessage(envelope, myPrivateKey, theirPublicKey) {
  try {
    const dot = envelope.indexOf('.')
    if (dot === -1) return envelope // plaintext legacy message
    const iv = fromBase64(envelope.slice(0, dot))
    const ciphertext = fromBase64(envelope.slice(dot + 1))
    const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKey)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, ciphertext)
    return new TextDecoder().decode(plain)
  } catch {
    return '🔒 Unable to decrypt'
  }
}
