// Everything specific to the Midtrans payment gateway lives here, so replacing the gateway touches this file and the wiring only.
// Free of any runtime: WebCrypto and fetch exist in Node (tests) and in the Edge Function runtime alike.
// Facts below come from docs.midtrans.com (Core API charge for QRIS, HTTP notification).

export type MidtransEnv = {
  serverKey: string
  mode: 'sandbox' | 'production'
}

export type PaymentStatus = 'PAID' | 'EXPIRED' | 'FAILED' | 'UNPAID' | 'REFUND'

export const midtransBase = (mode: MidtransEnv['mode']) => (mode === 'production' ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com')

const encoder = new TextEncoder()

// SHA-512 as lowercase hex.
export async function sha512Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', encoder.encode(message))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Compares in time that does not depend on where the strings first differ.
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// A notification is genuine when signature_key equals SHA512(order_id + status_code + gross_amount + server key). The three
// fields are used exactly as Midtrans sent them (gross_amount is the string, e.g. "10800.00").
export async function verifyNotification(
  n: { order_id: string; status_code: string; gross_amount: string; signature_key: string },
  serverKey: string,
): Promise<boolean> {
  if (!serverKey || !n.signature_key) return false
  return sameText(await sha512Hex(n.order_id + n.status_code + n.gross_amount + serverKey), n.signature_key.toLowerCase())
}

// The order_id of one attempt: the purchase id, an underscore and a base36 timestamp. Midtrans refuses a repeated order_id (406), so a
// retry after a failed charge needs a new one. It stays within 50 characters of [A-Za-z0-9-_~.].
export const orderIdFor = (purchaseId: string, at: Date) => `${purchaseId}_${at.getTime().toString(36)}`

const KNOWN_STATUSES = new Set(['settlement', 'capture', 'pending', 'expire', 'cancel', 'deny', 'failure', 'refund', 'partial_refund', 'chargeback', 'authorize'])
export const isKnownTransactionStatus = (transactionStatus: string) => KNOWN_STATUSES.has(transactionStatus)

// Midtrans transaction_status (and fraud_status) to the vocabulary of apply_payment. Anything unknown is 'UNPAID', which changes nothing.
export function mapStatus(transactionStatus: string, fraudStatus?: string): PaymentStatus {
  switch (transactionStatus) {
    case 'settlement':
      return 'PAID'
    case 'capture':
      if (fraudStatus === 'accept') return 'PAID'
      return fraudStatus === 'deny' ? 'FAILED' : 'UNPAID'
    case 'expire':
      return 'EXPIRED'
    case 'cancel':
    case 'deny':
    case 'failure':
      return 'FAILED'
    case 'refund':
    case 'partial_refund':
    case 'chargeback':
      return 'REFUND'
    default:
      return 'UNPAID'
  }
}

type ChargeAnswer = { status_code?: unknown; status_message?: unknown; transaction_id?: unknown; actions?: unknown }

// The QR image: the ASPI image with its border when Midtrans gives it, else the plain one.
function qrImageUrl(actions: unknown): string | null {
  if (!Array.isArray(actions)) return null
  const urlOf = (name: string) => {
    const action = actions.find((a: unknown) => typeof a === 'object' && a !== null && (a as { name?: unknown }).name === name) as { url?: unknown } | undefined
    return typeof action?.url === 'string' && action.url ? action.url : null
  }
  return urlOf('generate-qr-code-v2') ?? urlOf('generate-qr-code')
}

// Creates a QRIS transaction. The reference is Midtrans's transaction_id. Throws with the gateway's message when it refuses; the message never holds the key.
export async function createQris(
  env: MidtransEnv,
  input: { orderId: string; amount: number; email: string; expiresAt: Date },
  fetchImpl: typeof fetch = (url, init) => fetch(url, init),
): Promise<{ reference: string; qrUrl: string }> {
  const body = {
    payment_type: 'qris',
    transaction_details: { order_id: input.orderId, gross_amount: input.amount },
    customer_details: { first_name: input.email.split('@')[0], email: input.email },
    qris: { acquirer: 'gopay' },
    // Whole minutes left, counted from the moment the charge is made (no order_time).
    custom_expiry: { expiry_duration: Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60_000)), unit: 'minute' },
  }
  const response = await fetchImpl(`${midtransBase(env.mode)}/v2/charge`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.serverKey}:`)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const answer = (await response.json().catch(() => null)) as ChargeAnswer | null
  // Midtrans can answer HTTP 200 with the real status_code in the body.
  const code = typeof answer?.status_code === 'string' ? Number(answer.status_code) : NaN
  if (!response.ok || (Number.isFinite(code) && (code < 200 || code >= 300))) {
    throw new Error(`Midtrans refused the transaction (${response.status}): ${typeof answer?.status_message === 'string' ? answer.status_message : 'no detail'}`)
  }
  const reference = answer?.transaction_id
  const qrUrl = qrImageUrl(answer?.actions)
  if (typeof reference !== 'string' || !reference || !qrUrl) throw new Error('Midtrans answered without a transaction id or a QR')
  return { reference, qrUrl }
}
