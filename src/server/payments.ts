import type { CreatePaymentResponse } from '../core/generate/protocol'
import type { PaymentDb } from './ports'
import { createQris, verifyCallback, type TripayEnv } from './tripay'

export type { CreatePaymentResponse }

// The bodies of the `create-payment` and `tripay-callback` Edge Functions, free of any runtime (spec §5.4, §6).
// The handlers never credit anything themselves: the balance only changes inside `apply_payment`, which decides by the amount it has on file.

const PACKAGE_ID = 'basic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type CreatePaymentDeps = {
  db: PaymentDb
  tripay: TripayEnv
  fetchImpl?: typeof fetch
  // Told which stage failed and with what error, so the Edge Function can log it. Never receives a key.
  report?: (stage: 'gateway', error: unknown) => void
}

export type CallbackDeps = {
  db: PaymentDb
  privateKey: string
  // Told which stage failed and with what error. Never receives the callback body.
  report?: (stage: 'apply' | 'mismatch', error: unknown) => void
}

const refuse = (status: number, error: 'unauthenticated' | 'invalid-request' | 'gateway', message: string): { status: number; body: CreatePaymentResponse } => ({
  status,
  body: { ok: false, error, message },
})

export async function handleCreatePayment(
  input: { userId: string | null; email: string | null; body: unknown },
  deps: CreatePaymentDeps,
): Promise<{ status: number; body: CreatePaymentResponse }> {
  if (!input.userId) return refuse(401, 'unauthenticated', 'Masuk dulu untuk membeli kredit.')
  const { body } = input
  if (typeof body !== 'object' || body === null || (body as { packageId?: unknown }).packageId !== PACKAGE_ID) return refuse(400, 'invalid-request', 'Paket tidak dikenal.')
  if (!input.email) return refuse(400, 'invalid-request', 'Akunmu tidak punya email untuk pembayaran.')

  const purchase = await deps.db.createPurchase(input.userId, PACKAGE_ID)
  const answer = (qrUrl: string): { status: number; body: CreatePaymentResponse } => ({
    status: 200,
    body: { ok: true, purchaseId: purchase.id, qrUrl, amountIdr: purchase.amountIdr, credits: purchase.credits, expiresAt: purchase.expiresAt },
  })
  // The same QR is still valid: never a second one.
  if (purchase.status === 'pending' && purchase.qrUrl) return answer(purchase.qrUrl)

  let qris: Awaited<ReturnType<typeof createQris>>
  try {
    qris = await createQris(deps.tripay, { merchantRef: purchase.id, amount: purchase.amountIdr, email: input.email, expiresAt: new Date(purchase.expiresAt) }, deps.fetchImpl)
  } catch (error) {
    // The purchase stays pending and the next try reuses it.
    deps.report?.('gateway', error)
    return refuse(502, 'gateway', 'Pembayaran sedang gangguan. Coba lagi sebentar.')
  }
  await deps.db.attachTripay(purchase.id, qris.reference, qris.qrUrl)
  return answer(qris.qrUrl)
}

const callbackResult = (status: number, success: boolean, message?: string) => ({ status, body: { success, ...(message && { message }) } })

export async function handleCallback(
  input: { rawBody: string; signature: string | null; event: string | null },
  deps: CallbackDeps,
): Promise<{ status: number; body: { success: boolean; message?: string } }> {
  // The signature comes first and covers the raw text; nothing is parsed before it holds.
  if (!(await verifyCallback(input.rawBody, input.signature, deps.privateKey))) return callbackResult(401, false, 'Invalid signature')
  if (input.event !== 'payment_status') return callbackResult(400, false, 'Unknown event')

  let data: unknown
  try {
    data = JSON.parse(input.rawBody)
  } catch {
    return callbackResult(400, false, 'Invalid body')
  }
  const { reference, merchant_ref: merchantRef, status, total_amount: amount } = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  if (typeof reference !== 'string' || !reference || typeof merchantRef !== 'string' || !UUID.test(merchantRef) || typeof status !== 'string' || !status || typeof amount !== 'number' || !Number.isInteger(amount)) {
    return callbackResult(400, false, 'Invalid body')
  }

  let final: string
  try {
    final = await deps.db.applyPayment(merchantRef, reference, status, amount)
  } catch (error) {
    // A 5xx makes the gateway deliver again.
    deps.report?.('apply', error)
    return callbackResult(500, false, 'Try again')
  }
  if (final === 'not_found') return callbackResult(404, false, 'Unknown purchase')
  if (final === 'mismatch') deps.report?.('mismatch', new Error(`purchase ${merchantRef} was paid with a different amount`))
  // Also for an event seen before: apply_payment changes nothing the second time, and a 200 stops the retries.
  return callbackResult(200, true)
}
