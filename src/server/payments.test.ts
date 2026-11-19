// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { MidtransEnv } from './midtrans'
import type { PaymentDb } from './ports'
import { handleCallback, handleCreatePayment } from './payments'

const USER = '11111111-1111-1111-1111-111111111111'
const PURCHASE = '22222222-2222-2222-2222-222222222222'
const MIDTRANS: MidtransEnv = { serverKey: 'SB-Mid-server-test', mode: 'sandbox' }
const EXPIRES = new Date(Date.now() + 30 * 60_000).toISOString()
const QR = 'https://api.sandbox.midtrans.com/v2/qris/mt-1/qr-code-v2'

const row = (over: Partial<Awaited<ReturnType<PaymentDb['createPurchase']>>> = {}) => ({ id: PURCHASE, status: 'pending', amountIdr: 10800, credits: 50, qrUrl: null as string | null, expiresAt: EXPIRES, ...over })
const fakeDb = (over: Partial<PaymentDb> = {}) => {
  const db = {
    createPurchase: vi.fn(async () => row()),
    attachGateway: vi.fn(async (_id: string, _reference: string, qrUrl: string) => qrUrl),
    applyPayment: vi.fn(async () => 'paid'),
    ...over,
  }
  return db satisfies PaymentDb
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const midtransOk = () => json({ status_code: '201', transaction_id: 'mt-1', transaction_status: 'pending', actions: [{ name: 'generate-qr-code-v2', method: 'GET', url: QR }] })
const fakeFetch = (respond: () => Response | Promise<Response> = midtransOk) => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => respond()) as unknown as typeof fetch & ReturnType<typeof vi.fn>
const ask = (db: PaymentDb, fetchImpl: typeof fetch, input: Partial<Parameters<typeof handleCreatePayment>[0]> = {}, report?: (stage: string, error: unknown) => void) =>
  handleCreatePayment({ userId: USER, email: 'budi@example.com', body: { packageId: 'basic' }, ...input }, { db, midtrans: MIDTRANS, fetchImpl, report })

describe('handleCreatePayment', () => {
  it('refuses a caller without a user with 401 and touches nothing', async () => {
    const db = fakeDb()
    const fetchImpl = fakeFetch()
    const result = await ask(db, fetchImpl, { userId: null })
    expect(result.status).toBe(401)
    expect(result.body).toMatchObject({ ok: false, error: 'unauthenticated' })
    expect(db.createPurchase).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([[{ packageId: 'pro' }], [{}], [null], ['basic'], [{ packageId: 5 }]])('refuses the body %j with 400', async (body) => {
    const db = fakeDb()
    const fetchImpl = fakeFetch()
    const result = await ask(db, fetchImpl, { body })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ ok: false, error: 'invalid-request' })
    expect(db.createPurchase).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses a user without an email with 400 (the gateway needs one)', async () => {
    const result = await ask(fakeDb(), fakeFetch(), { email: null })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ ok: false, error: 'invalid-request' })
  })

  it('returns the still-valid pending purchase without calling the gateway again', async () => {
    const db = fakeDb({ createPurchase: vi.fn(async () => row({ qrUrl: 'https://api.midtrans.com/v2/qris/old/qr-code' })) })
    const fetchImpl = fakeFetch()
    const result = await ask(db, fetchImpl)
    expect(result).toEqual({ status: 200, body: { ok: true, purchaseId: PURCHASE, qrUrl: 'https://api.midtrans.com/v2/qris/old/qr-code', amountIdr: 10800, credits: 50, expiresAt: EXPIRES } })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(db.attachGateway).not.toHaveBeenCalled()
  })

  it('creates the QR for a new purchase under a unique order_id and attaches the transaction id', async () => {
    const db = fakeDb()
    const fetchImpl = fakeFetch()
    const result = await ask(db, fetchImpl)
    expect(db.createPurchase).toHaveBeenCalledWith(USER, 'basic')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body))
    expect(sent.transaction_details.order_id).toMatch(new RegExp(`^${PURCHASE}_[0-9a-z]+$`))
    expect(sent.transaction_details.gross_amount).toBe(10800)
    expect(sent.customer_details.email).toBe('budi@example.com')
    expect(db.attachGateway).toHaveBeenCalledWith(PURCHASE, 'mt-1', QR)
    expect(result).toEqual({ status: 200, body: { ok: true, purchaseId: PURCHASE, qrUrl: QR, amountIdr: 10800, credits: 50, expiresAt: EXPIRES } })
  })

  it('answers 502 gateway when Midtrans fails, leaves the purchase pending and reports without secrets', async () => {
    const db = fakeDb()
    const report = vi.fn()
    const result = await ask(db, fakeFetch(() => json({ status_message: 'boom' }, 500)), {}, report)
    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ ok: false, error: 'gateway' })
    expect(db.attachGateway).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('gateway', expect.any(Error))
    expect(JSON.stringify(result.body)).not.toContain('SB-Mid-server-test')
  })

  it('answers 502 gateway when fetch itself rejects', async () => {
    const result = await ask(fakeDb(), fakeFetch(() => Promise.reject(new Error('network'))))
    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ ok: false, error: 'gateway' })
  })

  it('lets a database error propagate', async () => {
    const db = fakeDb({ createPurchase: vi.fn(async () => { throw new Error('db down') }) })
    await expect(ask(db, fakeFetch())).rejects.toThrow('db down')
  })

  it('shows the QR the database recorded when another call attached first, never its own', async () => {
    const recorded = 'https://api.sandbox.midtrans.com/v2/qris/winner/qr-code-v2'
    const db = fakeDb({ attachGateway: vi.fn(async () => recorded) })
    const result = await ask(db, fakeFetch())
    expect(db.attachGateway).toHaveBeenCalledWith(PURCHASE, 'mt-1', QR)
    expect(result).toEqual({ status: 200, body: { ok: true, purchaseId: PURCHASE, qrUrl: recorded, amountIdr: 10800, credits: 50, expiresAt: EXPIRES } })
  })

  it('throws when attachGateway fails after the QR was made, so the entrypoint answers a generic 500', async () => {
    const db = fakeDb({ attachGateway: vi.fn(async () => { throw new Error('db down') }) })
    await expect(ask(db, fakeFetch())).rejects.toThrow('db down')
    // The purchase was never changed by the handler: it is still the pending row the database made.
    expect(db.applyPayment).not.toHaveBeenCalled()
  })
})

describe('handleCallback', () => {
  const KEY = 'SB-Mid-server-test'
  const ORDER = `${PURCHASE}_lz3k9a`
  const sign = (n: { order_id: string; status_code: string; gross_amount: string }, key = KEY) => createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + key).digest('hex')
  const make = (over: Record<string, unknown> = {}, key = KEY) => {
    const base = { order_id: ORDER, status_code: '200', gross_amount: '10800.00', transaction_id: 'mt-1', transaction_status: 'settlement', fraud_status: 'accept', payment_type: 'qris', ...over }
    return JSON.stringify({ signature_key: sign(base as { order_id: string; status_code: string; gross_amount: string }, key), ...base, ...('signature_key' in over ? { signature_key: over.signature_key } : {}) })
  }
  const call = (db: PaymentDb, rawBody: string = make(), report?: (stage: string, error: unknown) => void) => handleCallback({ rawBody }, { db, serverKey: KEY, report })

  it('rejects a wrong, empty or missing signature_key with 401 and no effect', async () => {
    const db = fakeDb()
    expect((await call(db, make({ signature_key: 'f'.repeat(128) }))).status).toBe(401)
    expect((await call(db, make({ signature_key: '' }))).status).toBe(401)
    const { signature_key: _drop, ...without } = JSON.parse(make())
    expect((await call(db, JSON.stringify(without))).status).toBe(401)
    expect((await call(db, make({}, 'another-key'))).status).toBe(401)
    // Midtrans sends gross_amount as a string; a number cannot have been signed.
    expect((await call(db, make({ gross_amount: 10800 }))).status).toBe(401)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it('rejects a body changed after signing with 401', async () => {
    const db = fakeDb()
    const forged = JSON.stringify({ ...JSON.parse(make()), gross_amount: '1.00' })
    expect((await call(db, forged)).status).toBe(401)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it.each([['not json'], ['[]'], ['null'], ['"x"']])('rejects a body that is not a JSON object with 400 (%s)', async (body) => {
    const db = fakeDb()
    expect((await call(db, body)).status).toBe(400)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it.each([
    ['order_id without a purchase uuid', { order_id: 'order-1_abc' }],
    ['order_id with a malformed uuid', { order_id: `${PURCHASE.slice(1)}_abc` }],
    ['missing transaction_id', { transaction_id: '' }],
    ['transaction_id not a string', { transaction_id: 7 }],
    ['missing transaction_status', { transaction_status: undefined }],
    ['fractional gross_amount', { gross_amount: '10800.50' }],
    ['gross_amount not a number', { gross_amount: 'abc' }],
    ['negative gross_amount', { gross_amount: '-10800.00' }],
  ])('rejects a signed but malformed body with 400: %s', async (_name, over) => {
    const db = fakeDb()
    const result = await call(db, make(over))
    expect(result.status).toBe(400)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it('applies PAID for settlement with the integer rupiah amount and the transaction id, and answers 200', async () => {
    const db = fakeDb()
    const result = await call(db)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'mt-1', 'PAID', 10800)
    expect(result).toEqual({ status: 200, body: { success: true } })
  })

  it('accepts a gross_amount without decimals and a capture with fraud_status accept', async () => {
    const db = fakeDb()
    expect((await call(db, make({ gross_amount: '10800' }))).status).toBe(200)
    expect(db.applyPayment).toHaveBeenLastCalledWith(PURCHASE, 'mt-1', 'PAID', 10800)
    expect((await call(db, make({ transaction_status: 'capture', fraud_status: 'accept' }))).status).toBe(200)
    expect(db.applyPayment).toHaveBeenLastCalledWith(PURCHASE, 'mt-1', 'PAID', 10800)
  })

  it('answers 200 for a repeated callback, which applyPayment turns into a no-op', async () => {
    const db = fakeDb()
    expect((await call(db)).status).toBe(200)
    expect(await call(db)).toEqual({ status: 200, body: { success: true } })
    expect(db.applyPayment).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['pending', 'UNPAID'],
    ['expire', 'EXPIRED'],
    ['cancel', 'FAILED'],
    ['deny', 'FAILED'],
    ['failure', 'FAILED'],
    ['refund', 'REFUND'],
    ['partial_refund', 'REFUND'],
    ['chargeback', 'REFUND'],
  ])('maps %s to %s and answers 200 (the SQL decides what changes)', async (transactionStatus, mapped) => {
    const db = fakeDb({ applyPayment: vi.fn(async () => mapped.toLowerCase()) })
    const report = vi.fn()
    const result = await call(db, make({ transaction_status: transactionStatus, status_code: '202' }), report)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'mt-1', mapped, 10800)
    expect(result).toEqual({ status: 200, body: { success: true } })
    expect(report).not.toHaveBeenCalled()
  })

  it('treats an unknown transaction_status as UNPAID and reports it', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => 'pending') })
    const report = vi.fn()
    const result = await call(db, make({ transaction_status: 'brand-new' }), report)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'mt-1', 'UNPAID', 10800)
    expect(result.status).toBe(200)
    expect(report).toHaveBeenCalledWith('status', expect.any(Error))
  })

  it('does not credit by itself when the amount differs: it passes the amount on, answers 200 and reports the mismatch', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => 'mismatch') })
    const report = vi.fn()
    const result = await call(db, make({ gross_amount: '1.00' }), report)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'mt-1', 'PAID', 1)
    expect(result.status).toBe(200)
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('mismatch', expect.any(Error))
  })

  it('answers 500 and reports when applyPayment throws, so the gateway sends it again', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => { throw new Error('duplicate key value violates unique constraint "purchases_gateway_reference_key"') }) })
    const report = vi.fn()
    const result = await call(db, make(), report)
    expect(result.status).toBe(500)
    expect(result.body.success).toBe(false)
    expect(report).toHaveBeenCalledWith('apply', expect.any(Error))
  })

  it('answers 404 for a purchase the database does not know, and never reports the raw body', async () => {
    const raw = make({ transaction_status: 'expire' })
    const db = fakeDb({ applyPayment: vi.fn(async () => 'not_found') })
    const report = vi.fn()
    const result = await call(db, raw, report)
    expect(result.status).toBe(404)
    expect(JSON.stringify(report.mock.calls)).not.toContain(raw)
    expect(JSON.stringify(report.mock.calls)).not.toContain('signature_key')
  })

  it('reports paid-not-credited when money came in but the purchase ended up failed', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => 'failed') })
    const report = vi.fn()
    const result = await call(db, make(), report)
    expect(result.status).toBe(200)
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('paid-not-credited', expect.any(Error))
  })

  it('reports paid-not-credited and answers 404 when a PAID callback finds no purchase', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => 'not_found') })
    const report = vi.fn()
    const result = await call(db, make(), report)
    expect(result.status).toBe(404)
    expect(report).toHaveBeenCalledWith('paid-not-credited', expect.any(Error))
  })

  it('reports duplicate-payment (stage and a short message, no body) for a second payment, and still answers 200', async () => {
    const raw = make({ transaction_id: 'mt-orphan' })
    const db = fakeDb({ applyPayment: vi.fn(async () => 'duplicate') })
    const report = vi.fn()
    const result = await call(db, raw, report)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'mt-orphan', 'PAID', 10800)
    expect(result).toEqual({ status: 200, body: { success: true } })
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('duplicate-payment', expect.any(Error))
    const text = JSON.stringify(report.mock.calls.map(([stage, error]) => [stage, (error as Error).message]))
    expect(text).not.toContain(KEY)
    expect(text).not.toContain(JSON.parse(raw).signature_key)
  })

  it('does not report a repeated callback of the same transaction (applyPayment answers paid)', async () => {
    const report = vi.fn()
    const db = fakeDb({ applyPayment: vi.fn(async () => 'paid') })
    await call(db, make(), report)
    await call(db, make(), report)
    expect(report).not.toHaveBeenCalled()
  })

  it('does not report paid-not-credited for a credited, repeated or non-PAID callback', async () => {
    const report = vi.fn()
    await call(fakeDb({ applyPayment: vi.fn(async () => 'paid') }), make(), report)
    await call(fakeDb({ applyPayment: vi.fn(async () => 'expired') }), make({ transaction_status: 'expire' }), report)
    await call(fakeDb({ applyPayment: vi.fn(async () => 'failed') }), make({ transaction_status: 'deny' }), report)
    expect(report).not.toHaveBeenCalled()
  })

  it('never puts the body or the keys in a report', async () => {
    const report = vi.fn()
    await call(fakeDb({ applyPayment: vi.fn(async () => 'failed') }), make(), report)
    await call(fakeDb({ applyPayment: vi.fn(async () => { throw new Error('db down') }) }), make(), report)
    const text = JSON.stringify(report.mock.calls.map(([stage, error]) => [stage, (error as Error).message]))
    expect(text).not.toContain(KEY)
    expect(text).not.toContain(JSON.parse(make()).signature_key)
  })
})
