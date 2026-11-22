import type { CreatePaymentResponse } from '../core/generate/protocol'
import type { PaymentDb } from './ports'
import { createQris, isKnownTransactionStatus, mapStatus, orderIdFor, verifyNotification, type MidtransEnv } from './midtrans'

export type { CreatePaymentResponse }

// The bodies of the `create-payment` and `midtrans-callback` Edge Functions, free of any runtime (spec §5.4, §6).
// The handlers never credit anything themselves: the balance only changes inside `apply_payment`, which decides by the amount it has on file.

const PACKAGE_ID = 'basic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type CreatePaymentDeps = {
  db: PaymentDb
  midtrans: MidtransEnv
  fetchImpl?: typeof fetch
  // Told which stage failed and with what error, so the Edge Function can log it. Never receives a key.
  report?: (stage: 'gateway', error: unknown) => void
}

export type CallbackDeps = {
  db: PaymentDb
  serverKey: string
  // Told which stage failed and with what error. Never receives the callback body.
  report?: (stage: 'apply' | 'mismatch' | 'paid-not-credited' | 'duplicate-payment' | 'status', error: unknown) => void
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
    // A new order_id per attempt: Midtrans refuses a repeated one, and a retry after a failed charge must not be refused.
    qris = await createQris(deps.midtrans, { orderId: orderIdFor(purchase.id, new Date()), amount: purchase.amountIdr, email: input.email, expiresAt: new Date(purchase.expiresAt) }, deps.fetchImpl)
  } catch (error) {
    // The purchase stays pending and the next try reuses it.
    deps.report?.('gateway', error)
    return refuse(502, 'gateway', 'Pembayaran sedang gangguan. Coba lagi sebentar.')
  }
  // First writer wins in the database: show the QR it recorded, which is ours only when no concurrent call attached one before.
  return answer(await deps.db.attachGateway(purchase.id, qris.reference, qris.qrUrl))
}

const callbackResult = (status: number, success: boolean, message?: string) => ({ status, body: { success, ...(message && { message }) } })

// "10800.00" and "10800" are whole rupiah; anything with a fraction is refused.
const WHOLE_RUPIAH = /^\d+(\.0+)?$/

export async function handleCallback(input: { rawBody: string }, deps: CallbackDeps): Promise<{ status: number; body: { success: boolean; message?: string } }> {
  let data: unknown
  try {
    data = JSON.parse(input.rawBody)
  } catch {
    return callbackResult(400, false, 'Invalid body')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return callbackResult(400, false, 'Invalid body')
  const fields = data as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' ? value : '')

  // The signature comes before the database and before any other check; a missing one fails like a wrong one.
  const signed = { order_id: text(fields.order_id), status_code: text(fields.status_code), gross_amount: text(fields.gross_amount), signature_key: text(fields.signature_key) }
  if (!(await verifyNotification(signed, deps.serverKey))) return callbackResult(401, false, 'Invalid signature')

  const purchaseId = signed.order_id.split('_')[0] ?? ''
  const reference = text(fields.transaction_id)
  const transactionStatus = text(fields.transaction_status)
  if (!UUID.test(purchaseId) || !reference || !transactionStatus || !WHOLE_RUPIAH.test(signed.gross_amount)) return callbackResult(400, false, 'Invalid body')
  const amount = Number(signed.gross_amount)
  if (!Number.isSafeInteger(amount)) return callbackResult(400, false, 'Invalid body')

  let status = mapStatus(transactionStatus, typeof fields.fraud_status === 'string' ? fields.fraud_status : undefined)
  if (!isKnownTransactionStatus(transactionStatus)) deps.report?.('status', new Error(`purchase ${purchaseId} got an unknown transaction_status (${transactionStatus.slice(0, 40)})`))
  // transaction_status is not covered by the signature, status_code is: a payment only counts when the signed code says success.
  if (status === 'PAID' && signed.status_code !== '200') {
    deps.report?.('status', new Error(`purchase ${purchaseId} has a paid transaction_status but the signed status_code is ${signed.status_code.slice(0, 10)}`))
    status = 'UNPAID'
  }

  let final: string
  try {
    final = await deps.db.applyPayment(purchaseId, reference, status, amount)
  } catch (error) {
    // A 5xx makes the gateway deliver again.
    deps.report?.('apply', error)
    return callbackResult(500, false, 'Try again')
  }
  if (final === 'mismatch') {
    deps.report?.('mismatch', new Error(`purchase ${purchaseId} was paid with a different amount`))
  } else if (final === 'duplicate') {
    // A second charge of the same purchase was paid: nothing is credited, and the money must not go unnoticed. A 200 stops the retries.
    deps.report?.('duplicate-payment', new Error(`purchase ${purchaseId} was paid a second time by another transaction`))
  } else if (status === 'PAID' && final !== 'paid') {
    // Money came in but the purchase is not credited (not found, or already failed): somebody has to look at it.
    deps.report?.('paid-not-credited', new Error(`purchase ${purchaseId} was paid but the result is ${final}`))
  }
  if (final === 'not_found') return callbackResult(404, false, 'Unknown purchase')
  // Also for an event seen before: apply_payment changes nothing the second time, and a 200 stops the retries.
  return callbackResult(200, true)
}
