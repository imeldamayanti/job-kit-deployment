// Everything specific to the Tripay payment gateway lives here, so replacing the gateway touches this file and the wiring only.
// Free of any runtime: WebCrypto and fetch exist in Node (tests) and in the Edge Function runtime alike.

export type TripayEnv = {
  apiKey: string
  privateKey: string
  merchantCode: string
  mode: 'sandbox' | 'production'
  // The public URL of the `tripay-callback` function.
  callbackUrl: string
}

export const tripayBase = (mode: TripayEnv['mode']) => (mode === 'production' ? 'https://tripay.co.id/api' : 'https://tripay.co.id/api-sandbox')

// What one package is called on the payment page. Tripay lists it as the order item.
const ITEM_NAME = 'job-kit 50 kredit'

const encoder = new TextEncoder()

// HMAC-SHA256 as lowercase hex.
export async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Compares in time that does not depend on where the strings first differ.
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// A callback is genuine when X-Callback-Signature equals HMAC-SHA256(raw body, private key). The RAW text is signed: never a re-serialised body.
export async function verifyCallback(rawBody: string, signature: string | null, privateKey: string): Promise<boolean> {
  if (!signature) return false
  return sameText(await hmacHex(privateKey, rawBody), signature.toLowerCase())
}

// Creates a QRIS transaction. Throws with the gateway's message when it refuses; the message never holds a key.
export async function createQris(
  env: TripayEnv,
  input: { merchantRef: string; amount: number; email: string; expiresAt: Date },
  fetchImpl: typeof fetch = (url, init) => fetch(url, init),
): Promise<{ reference: string; qrUrl: string }> {
  const body = {
    method: 'QRIS',
    merchant_ref: input.merchantRef,
    amount: input.amount,
    customer_name: input.email.split('@')[0],
    customer_email: input.email,
    order_items: [{ name: ITEM_NAME, price: input.amount, quantity: 1 }],
    callback_url: env.callbackUrl,
    expired_time: Math.floor(input.expiresAt.getTime() / 1000),
    signature: await hmacHex(env.privateKey, env.merchantCode + input.merchantRef + input.amount),
  }
  const response = await fetchImpl(`${tripayBase(env.mode)}/transaction/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const answer = (await response.json().catch(() => null)) as { success?: unknown; message?: unknown; data?: { reference?: unknown; qr_url?: unknown } } | null
  if (!response.ok || answer?.success !== true) {
    throw new Error(`Tripay refused the transaction (${response.status}): ${typeof answer?.message === 'string' ? answer.message : 'no detail'}`)
  }
  const { reference, qr_url: qrUrl } = answer.data ?? {}
  if (typeof reference !== 'string' || typeof qrUrl !== 'string' || !reference || !qrUrl) throw new Error('Tripay answered without a reference or a QR')
  return { reference, qrUrl }
}
