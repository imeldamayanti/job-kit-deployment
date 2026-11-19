// @vitest-environment node
import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PaymentDb } from './ports'
import { handleCallback, handleCreatePayment } from './payments'
import type { TripayEnv } from './tripay'

const USER = '11111111-1111-1111-1111-111111111111'
const PURCHASE = '22222222-2222-2222-2222-222222222222'
const TRIPAY: TripayEnv = { apiKey: 'api-key-1', privateKey: 'private-key-1', merchantCode: 'T0001', mode: 'sandbox', callbackUrl: 'https://proj.supabase.test/functions/v1/tripay-callback' }
const EXPIRES = '2026-11-19T10:30:00.000Z'

const row = (over: Partial<Awaited<ReturnType<PaymentDb['createPurchase']>>> = {}) => ({ id: PURCHASE, status: 'pending', amountIdr: 10800, credits: 50, qrUrl: null as string | null, expiresAt: EXPIRES, ...over })
const fakeDb = (over: Partial<PaymentDb> = {}) => {
  const db = {
    createPurchase: vi.fn(async () => row()),
    attachTripay: vi.fn(async () => undefined),
    applyPayment: vi.fn(async () => 'paid'),
    ...over,
  }
  return db satisfies PaymentDb
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const tripayOk = () => json({ success: true, data: { reference: 'DEV-T0001-1', qr_url: 'https://tripay.co.id/qr/1' } })
const fakeFetch = (respond: () => Response | Promise<Response> = tripayOk) => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => respond()) as unknown as typeof fetch & ReturnType<typeof vi.fn>
const ask = (db: PaymentDb, fetchImpl: typeof fetch, input: Partial<Parameters<typeof handleCreatePayment>[0]> = {}, report?: (stage: string, error: unknown) => void) =>
  handleCreatePayment({ userId: USER, email: 'budi@example.com', body: { packageId: 'basic' }, ...input }, { db, tripay: TRIPAY, fetchImpl, report })

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
    const db = fakeDb({ createPurchase: vi.fn(async () => row({ qrUrl: 'https://tripay.co.id/qr/old' })) })
    const fetchImpl = fakeFetch()
    const result = await ask(db, fetchImpl)
    expect(result).toEqual({ status: 200, body: { ok: true, purchaseId: PURCHASE, qrUrl: 'https://tripay.co.id/qr/old', amountIdr: 10800, credits: 50, expiresAt: EXPIRES } })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(db.attachTripay).not.toHaveBeenCalled()
  })

  it('creates the QR for a new purchase and attaches the reference', async () => {
    const db = fakeDb()
    const fetchImpl = fakeFetch()
    const result = await ask(db, fetchImpl)
    expect(db.createPurchase).toHaveBeenCalledWith(USER, 'basic')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body))
    expect(sent).toMatchObject({ merchant_ref: PURCHASE, amount: 10800, customer_email: 'budi@example.com', customer_name: 'budi', expired_time: Math.floor(Date.parse(EXPIRES) / 1000) })
    expect(db.attachTripay).toHaveBeenCalledWith(PURCHASE, 'DEV-T0001-1', 'https://tripay.co.id/qr/1')
    expect(result).toEqual({ status: 200, body: { ok: true, purchaseId: PURCHASE, qrUrl: 'https://tripay.co.id/qr/1', amountIdr: 10800, credits: 50, expiresAt: EXPIRES } })
  })

  it('answers 502 gateway when Tripay fails, leaves the purchase pending and reports without secrets', async () => {
    const db = fakeDb()
    const report = vi.fn()
    const result = await ask(db, fakeFetch(() => json({ success: false, message: 'boom' }, 500)), {}, report)
    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ ok: false, error: 'gateway' })
    expect(db.attachTripay).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('gateway', expect.any(Error))
    expect(JSON.stringify(result.body)).not.toContain('api-key-1')
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
})

describe('handleCallback', () => {
  const payload = { reference: 'DEV-T0001-1', merchant_ref: PURCHASE, payment_method: 'QRIS', total_amount: 10800, status: 'PAID' }
  const raw = JSON.stringify(payload)
  const sign = (body: string) => createHmac('sha256', 'private-key-1').update(body).digest('hex')
  const call = (db: PaymentDb, input: Partial<Parameters<typeof handleCallback>[0]> = {}, report?: (stage: string, error: unknown) => void) =>
    handleCallback({ rawBody: raw, signature: sign(raw), event: 'payment_status', ...input }, { db, privateKey: 'private-key-1', report })

  it('rejects a wrong or missing signature with 401 and no effect', async () => {
    const db = fakeDb()
    expect((await call(db, { signature: 'f'.repeat(64) })).status).toBe(401)
    expect((await call(db, { signature: null })).status).toBe(401)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it('checks the signature before anything else, even on a body that is not JSON', async () => {
    const db = fakeDb()
    const result = await call(db, { rawBody: 'not json', signature: 'bad' })
    expect(result.status).toBe(401)
  })

  it('rejects an event other than payment_status with 400', async () => {
    const db = fakeDb()
    expect((await call(db, { event: 'something_else' })).status).toBe(400)
    expect((await call(db, { event: null })).status).toBe(400)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it.each([
    ['not json'],
    ['[]'],
    [JSON.stringify({ ...payload, merchant_ref: 'not-a-uuid' })],
    [JSON.stringify({ ...payload, reference: '' })],
    [JSON.stringify({ ...payload, status: 5 })],
    [JSON.stringify({ ...payload, total_amount: '10800' })],
    [JSON.stringify({ ...payload, total_amount: 10800.5 })],
  ])('rejects a signed but malformed body with 400 (%s)', async (body) => {
    const db = fakeDb()
    const result = await call(db, { rawBody: body, signature: sign(body) })
    expect(result.status).toBe(400)
    expect(db.applyPayment).not.toHaveBeenCalled()
  })

  it('applies PAID with the callback amount and answers 200', async () => {
    const db = fakeDb()
    const result = await call(db)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'DEV-T0001-1', 'PAID', 10800)
    expect(result).toEqual({ status: 200, body: { success: true } })
  })

  it('answers 200 for a repeated callback, which applyPayment turns into a no-op', async () => {
    const db = fakeDb()
    expect((await call(db)).status).toBe(200)
    const second = await call(db)
    expect(second).toEqual({ status: 200, body: { success: true } })
    expect(db.applyPayment).toHaveBeenCalledTimes(2)
  })

  it.each(['EXPIRED', 'FAILED', 'REFUND', 'UNPAID'])('passes %s on and answers 200 (the SQL decides what changes)', async (status) => {
    const db = fakeDb({ applyPayment: vi.fn(async () => status.toLowerCase()) })
    const body = JSON.stringify({ ...payload, status })
    const result = await call(db, { rawBody: body, signature: sign(body) })
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'DEV-T0001-1', status, 10800)
    expect(result).toEqual({ status: 200, body: { success: true } })
  })

  it('does not credit by itself when the amount differs: it passes the amount on and answers 200', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => 'mismatch') })
    const report = vi.fn()
    const body = JSON.stringify({ ...payload, total_amount: 1 })
    const result = await call(db, { rawBody: body, signature: sign(body) }, report)
    expect(db.applyPayment).toHaveBeenCalledWith(PURCHASE, 'DEV-T0001-1', 'PAID', 1)
    expect(result.status).toBe(200)
    expect(report).toHaveBeenCalledWith('mismatch', expect.any(Error))
  })

  it('answers 5xx and reports when applyPayment throws, so the gateway retries', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => { throw new Error('duplicate key value violates unique constraint') }) })
    const report = vi.fn()
    const result = await call(db, {}, report)
    expect(result.status).toBe(500)
    expect(result.body.success).toBe(false)
    expect(report).toHaveBeenCalledWith('apply', expect.any(Error))
  })

  it('answers 404 for a purchase the database does not know, and never reports the raw body', async () => {
    const db = fakeDb({ applyPayment: vi.fn(async () => 'not_found') })
    const report = vi.fn()
    const result = await call(db, {}, report)
    expect(result.status).toBe(404)
    expect(JSON.stringify(report.mock.calls)).not.toContain(raw)
  })
})
