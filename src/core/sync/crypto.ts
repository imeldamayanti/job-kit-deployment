// Client-side encryption for sync (PRD §4.3, RFC D17): the server only ever sees what `encrypt` returns.
// AES-256-GCM, key from the sync password by PBKDF2-SHA256. WebCrypto only, no dependency.

export const PBKDF2_ITERATIONS = 600_000
const CHECK_TEXT = 'job-kit-sync-v1'

export type CryptoFailure = 'wrong-key' | 'bad-data'
export class SyncCryptoError extends Error {
  constructor(readonly reason: CryptoFailure) {
    super(reason)
  }
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

export const newSalt = (): Uint8Array => crypto.getRandomValues(new Uint8Array(16))
export const saltToText = toBase64
export const saltFromText = fromBase64

export async function deriveKey(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, 256)
  return importKey(toBase64(new Uint8Array(bits)))
}

// The key as text, so it can live in `storage.session` (gone when the browser closes). The password itself is never kept.
export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}

export const importKey = (text: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', fromBase64(text) as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt'])

// "iv.ciphertext", both base64. A fresh random IV every time.
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return `${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`
}

export async function decrypt(key: CryptoKey, envelope: string): Promise<string> {
  const parts = envelope.split('.')
  let iv: Uint8Array
  let body: Uint8Array
  try {
    if (parts.length !== 2) throw new Error('shape')
    iv = fromBase64(parts[0]!)
    body = fromBase64(parts[1]!)
    if (iv.length !== 12) throw new Error('iv')
  } catch {
    throw new SyncCryptoError('bad-data')
  }
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, body as BufferSource))
  } catch {
    // GCM cannot tell a wrong key from damaged data; a wrong password is by far the likelier cause.
    throw new SyncCryptoError('wrong-key')
  }
}

// Stored next to the salt so a new device can tell a wrong password from the start, before it touches any data.
export const makeCheck = (key: CryptoKey): Promise<string> => encrypt(key, CHECK_TEXT)
export async function verifyCheck(key: CryptoKey, check: string): Promise<boolean> {
  try {
    return (await decrypt(key, check)) === CHECK_TEXT
  } catch {
    return false
  }
}
