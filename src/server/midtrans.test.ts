// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createQris, mapStatus, midtransBase, orderIdFor, sha512Hex, verifyNotification, type MidtransEnv } from './midtrans'

const ENV: MidtransEnv = { serverKey: 'SB-Mid-server-test', mode: 'sandbox' }
const PURCHASE = '22222222-2222-2222-2222-222222222222'
const NOW = Date.parse('2026-11-19T10:00:00.000Z')
const input = { orderId: `${PURCHASE}_abc`, amount: 10800, email: 'budi.santoso@example.com', expiresAt: new Date(NOW + 30 * 60_000) }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const spy = (respond: () => Response | Promise<Response>) => {
  const seen: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => (seen.push({ url: String(url), init: init as RequestInit }), respond())) as typeof fetch
  return { seen, fetchImpl }
}
const ok = {
  status_code: '201',
  status_message: 'QRIS transaction is created',
  transaction_id: 'b1f1-uuid',
  order_id: input.orderId,
  gross_amount: '10800.00',
  payment_type: 'qris',
  transaction_status: 'pending',
  actions: [
    { name: 'generate-qr-code', method: 'GET', url: 'https://api.sandbox.midtrans.com/v2/qris/b1f1-uuid/qr-code' },
    { name: 'generate-qr-code-v2', method: 'GET', url: 'https://api.sandbox.midtrans.com/v2/qris/b1f1-uuid/qr-code-v2' },
  ],
}

describe('midtransBase', () => {
  it('picks the sandbox or production host', () => {
    expect(midtransBase('sandbox')).toBe('https://api.sandbox.midtrans.com')
    expect(midtransBase('production')).toBe('https://api.midtrans.com')
  })
})

describe('orderIdFor', () => {
  it('is the purchase id, an underscore and a base36 timestamp, within 50 characters of the allowed set', () => {
    const id = orderIdFor(PURCHASE, new Date(NOW))
    expect(id).toBe(`${PURCHASE}_${NOW.toString(36)}`)
    expect(id.length).toBeLessThanOrEqual(50)
    expect(id).toMatch(/^[A-Za-z0-9._~-]+$/)
  })
  it('differs per attempt', () => {
    expect(orderIdFor(PURCHASE, new Date(NOW))).not.toBe(orderIdFor(PURCHASE, new Date(NOW + 1)))
  })
})

describe('sha512Hex', () => {
  it.each(['', 'abc', 'order-1200' + '10800.00' + 'SB-Mid-server-test', 'kunci-ü ✓ Rp10.800'])('matches node:crypto for %j', async (message) => {
    expect(await sha512Hex(message)).toBe(createHash('sha512').update(message).digest('hex'))
  })
})

describe('verifyNotification', () => {
  const base = { order_id: `${PURCHASE}_abc`, status_code: '200', gross_amount: '10800.00' }
  const signature = (serverKey: string, n = base) => createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + serverKey).digest('hex')
  const notification = { ...base, signature_key: signature('SB-Mid-server-test') }

  it('accepts SHA512(order_id + status_code + gross_amount + server key)', async () => {
    expect(await verifyNotification(notification, 'SB-Mid-server-test')).toBe(true)
  })
  it('rejects a missing, empty, wrong or truncated signature', async () => {
    expect(await verifyNotification({ ...notification, signature_key: '' }, 'SB-Mid-server-test')).toBe(false)
    expect(await verifyNotification({ ...notification, signature_key: 'a'.repeat(128) }, 'SB-Mid-server-test')).toBe(false)
    expect(await verifyNotification({ ...notification, signature_key: notification.signature_key.slice(0, 127) }, 'SB-Mid-server-test')).toBe(false)
    expect(await verifyNotification({ ...notification, signature_key: `${notification.signature_key}0` }, 'SB-Mid-server-test')).toBe(false)
  })
  it('rejects a field changed after signing, and the wrong key', async () => {
    expect(await verifyNotification({ ...notification, gross_amount: '1.00' }, 'SB-Mid-server-test')).toBe(false)
    expect(await verifyNotification({ ...notification, status_code: '202' }, 'SB-Mid-server-test')).toBe(false)
    expect(await verifyNotification({ ...notification, order_id: 'x' }, 'SB-Mid-server-test')).toBe(false)
    expect(await verifyNotification(notification, 'other-key')).toBe(false)
  })
  it('rejects an empty server key', async () => {
    expect(await verifyNotification({ ...base, signature_key: signature('') }, '')).toBe(false)
  })
  it('accepts an upper-case hex signature', async () => {
    expect(await verifyNotification({ ...notification, signature_key: notification.signature_key.toUpperCase() }, 'SB-Mid-server-test')).toBe(true)
  })
})

describe('mapStatus', () => {
  it.each([
    ['settlement', undefined, 'PAID'],
    ['settlement', 'accept', 'PAID'],
    ['capture', 'accept', 'PAID'],
    ['capture', 'deny', 'FAILED'],
    ['capture', undefined, 'UNPAID'],
    ['pending', undefined, 'UNPAID'],
    ['expire', undefined, 'EXPIRED'],
    ['cancel', undefined, 'FAILED'],
    ['deny', undefined, 'FAILED'],
    ['failure', undefined, 'FAILED'],
    ['refund', undefined, 'REFUND'],
    ['partial_refund', undefined, 'REFUND'],
    ['chargeback', undefined, 'REFUND'],
    ['authorize', undefined, 'UNPAID'],
    ['something-new', undefined, 'UNPAID'],
    ['', undefined, 'UNPAID'],
  ] as const)('maps %s / %s to %s', (status, fraud, expected) => {
    expect(mapStatus(status, fraud)).toBe(expected)
  })
})

describe('createQris', () => {
  it('posts the QRIS charge to the sandbox with Basic auth (server key + colon) and the exact body', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    const before = Date.now()
    await createQris(ENV, input, fetchImpl)
    expect(seen[0]?.url).toBe('https://api.sandbox.midtrans.com/v2/charge')
    expect(seen[0]?.init.method).toBe('POST')
    const headers = seen[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('SB-Mid-server-test:').toString('base64')}`)
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers.Accept).toBe('application/json')
    const sent = JSON.parse(String(seen[0]?.init.body))
    expect(sent).toMatchObject({
      payment_type: 'qris',
      transaction_details: { order_id: input.orderId, gross_amount: 10800 },
      customer_details: { first_name: 'budi.santoso', email: 'budi.santoso@example.com' },
      qris: { acquirer: 'gopay' },
    })
    expect(sent.custom_expiry).toEqual({ expiry_duration: expect.any(Number), unit: 'minute' })
    // The input says 30 minutes from NOW; the real clock is later, so the duration only shrinks and is never below one minute.
    expect(sent.custom_expiry.expiry_duration).toBeGreaterThanOrEqual(1)
    expect(Date.now() - before).toBeLessThan(5000)
  })

  it('sends the whole minutes left until expiresAt, at least one', async () => {
    const soon = spy(() => json(ok))
    await createQris(ENV, { ...input, expiresAt: new Date(Date.now() + 29 * 60_000 + 30_000) }, soon.fetchImpl)
    expect(JSON.parse(String(soon.seen[0]?.init.body)).custom_expiry.expiry_duration).toBe(30)
    const past = spy(() => json(ok))
    await createQris(ENV, { ...input, expiresAt: new Date(Date.now() - 60_000) }, past.fetchImpl)
    expect(JSON.parse(String(past.seen[0]?.init.body)).custom_expiry.expiry_duration).toBe(1)
  })

  it('uses the production host in production mode', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    await createQris({ ...ENV, mode: 'production' }, input, fetchImpl)
    expect(seen[0]?.url).toBe('https://api.midtrans.com/v2/charge')
  })

  it('adds no buyer fee field and no item markup', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    await createQris(ENV, input, fetchImpl)
    const sent = JSON.parse(String(seen[0]?.init.body))
    expect(sent.transaction_details.gross_amount).toBe(10800)
    expect(JSON.stringify(sent)).not.toMatch(/fee/i)
  })

  it('has a 15 second timeout signal', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    await createQris(ENV, input, fetchImpl)
    expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('maps transaction_id and the QR image url (the ASPI v2 image when present)', async () => {
    const { fetchImpl } = spy(() => json(ok))
    expect(await createQris(ENV, input, fetchImpl)).toEqual({ reference: 'b1f1-uuid', qrUrl: 'https://api.sandbox.midtrans.com/v2/qris/b1f1-uuid/qr-code-v2' })
  })

  it('falls back to the plain QR image', async () => {
    const { fetchImpl } = spy(() => json({ ...ok, actions: [ok.actions[0]] }))
    expect((await createQris(ENV, input, fetchImpl)).qrUrl).toBe('https://api.sandbox.midtrans.com/v2/qris/b1f1-uuid/qr-code')
  })

  it('throws on a refusal, with no key in the message', async () => {
    const { fetchImpl } = spy(() => json({ status_code: '406', status_message: 'Duplicate order ID' }, 200))
    const error = await createQris(ENV, input, fetchImpl).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Duplicate order ID')
    expect((error as Error).message).not.toContain('SB-Mid-server-test')
  })

  it('throws on an HTTP error, a body that is not JSON, and an answer without a QR or transaction id', async () => {
    await expect(createQris(ENV, input, spy(() => json({ status_message: 'down' }, 500)).fetchImpl)).rejects.toThrow()
    await expect(createQris(ENV, input, spy(() => new Response('<html>', { status: 200 })).fetchImpl)).rejects.toThrow()
    await expect(createQris(ENV, input, spy(() => json({ ...ok, actions: [] })).fetchImpl)).rejects.toThrow()
    await expect(createQris(ENV, input, spy(() => json({ ...ok, transaction_id: undefined })).fetchImpl)).rejects.toThrow()
    await expect(createQris(ENV, input, spy(() => json({ ...ok, actions: [{ name: 'generate-qr-code', url: 5 }] })).fetchImpl)).rejects.toThrow()
  })

  it('throws when the gateway answers 200 with a non-2xx status_code in the body', async () => {
    await expect(createQris(ENV, input, spy(() => json({ ...ok, status_code: '400', status_message: 'validation_error' })).fetchImpl)).rejects.toThrow(/validation_error/)
  })
})
