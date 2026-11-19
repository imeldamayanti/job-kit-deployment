// @vitest-environment node
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createQris, hmacHex, tripayBase, verifyCallback, type TripayEnv } from './tripay'

const ENV: TripayEnv = { apiKey: 'api-key-1', privateKey: 'private-key-1', merchantCode: 'T0001', mode: 'sandbox', callbackUrl: 'https://proj.supabase.test/functions/v1/tripay-callback' }
const PURCHASE = '22222222-2222-2222-2222-222222222222'
const EXPIRES = new Date('2026-11-19T10:30:00.000Z')

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const spy = (respond: () => Response) => {
  const seen: { url: string; init: RequestInit }[] = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => (seen.push({ url: String(url), init: init as RequestInit }), respond())) as typeof fetch
  return { seen, fetchImpl }
}
const input = { merchantRef: PURCHASE, amount: 10800, email: 'budi.santoso@example.com', expiresAt: EXPIRES }

describe('tripayBase', () => {
  it('picks the sandbox or production host', () => {
    expect(tripayBase('sandbox')).toBe('https://tripay.co.id/api-sandbox')
    expect(tripayBase('production')).toBe('https://tripay.co.id/api')
  })
})

describe('hmacHex', () => {
  it.each([
    ['key', 'message'],
    ['private-key-1', 'T0001' + PURCHASE + '10800'],
    ['k', ''],
    ['kunci-ü', '{"reference":"T1","note":"Rp10.800 ✓"}'],
  ])('matches node:crypto for (%s, %s)', async (key, message) => {
    expect(await hmacHex(key, message)).toBe(createHmac('sha256', key).update(message).digest('hex'))
  })
})

describe('verifyCallback', () => {
  const raw = '{"reference":"T1","merchant_ref":"x","status":"PAID","total_amount":10800}'
  const good = createHmac('sha256', 'private-key-1').update(raw).digest('hex')

  it('accepts the signature of the raw body', async () => {
    expect(await verifyCallback(raw, good, 'private-key-1')).toBe(true)
  })
  it('rejects a missing, empty, wrong or truncated signature', async () => {
    expect(await verifyCallback(raw, null, 'private-key-1')).toBe(false)
    expect(await verifyCallback(raw, '', 'private-key-1')).toBe(false)
    expect(await verifyCallback(raw, 'a'.repeat(64), 'private-key-1')).toBe(false)
    expect(await verifyCallback(raw, good.slice(0, 63), 'private-key-1')).toBe(false)
    expect(await verifyCallback(raw, `${good}00`, 'private-key-1')).toBe(false)
  })
  it('rejects a body that was changed after signing, and the wrong key', async () => {
    expect(await verifyCallback(raw.replace('10800', '1'), good, 'private-key-1')).toBe(false)
    expect(await verifyCallback(raw, good, 'other-key')).toBe(false)
  })
  it('does not accept a re-serialised body (the raw text is what is signed)', async () => {
    expect(await verifyCallback(JSON.stringify(JSON.parse(raw), null, 1), good, 'private-key-1')).toBe(false)
  })
})

describe('createQris', () => {
  const ok = { success: true, message: '', data: { reference: 'DEV-T0001-1', qr_url: 'https://tripay.co.id/qr/DEV-T0001-1', qr_string: '000201' } }

  it('posts the transaction to the sandbox with the bearer key and the exact body', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    await createQris(ENV, input, fetchImpl)
    expect(seen[0]?.url).toBe('https://tripay.co.id/api-sandbox/transaction/create')
    expect(seen[0]?.init.method).toBe('POST')
    const headers = seen[0]?.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer api-key-1')
    expect(headers['content-type']).toBe('application/json')
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({
      method: 'QRIS',
      merchant_ref: PURCHASE,
      amount: 10800,
      customer_name: 'budi.santoso',
      customer_email: 'budi.santoso@example.com',
      order_items: [{ name: 'job-kit 50 kredit', price: 10800, quantity: 1 }],
      callback_url: ENV.callbackUrl,
      expired_time: Math.floor(EXPIRES.getTime() / 1000),
      signature: createHmac('sha256', 'private-key-1').update('T0001' + PURCHASE + '10800').digest('hex'),
    })
  })

  it('uses the production host in production mode', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    await createQris({ ...ENV, mode: 'production' }, input, fetchImpl)
    expect(seen[0]?.url).toBe('https://tripay.co.id/api/transaction/create')
  })

  it('adds no buyer fee field', async () => {
    const { seen, fetchImpl } = spy(() => json(ok))
    await createQris(ENV, input, fetchImpl)
    expect(Object.keys(JSON.parse(String(seen[0]?.init.body)))).not.toContain('fee_customer')
  })

  it('maps reference and qr_url', async () => {
    const { fetchImpl } = spy(() => json(ok))
    expect(await createQris(ENV, input, fetchImpl)).toEqual({ reference: 'DEV-T0001-1', qrUrl: 'https://tripay.co.id/qr/DEV-T0001-1' })
  })

  it('throws when success is false, without the key in the message', async () => {
    const { fetchImpl } = spy(() => json({ success: false, message: 'Invalid signature' }, 200))
    const error = await createQris(ENV, input, fetchImpl).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Invalid signature')
    expect((error as Error).message).not.toContain('api-key-1')
    expect((error as Error).message).not.toContain('private-key-1')
  })

  it('throws on an HTTP error, a body that is not JSON, and data without a QR', async () => {
    await expect(createQris(ENV, input, spy(() => json({ success: false, message: 'down' }, 500)).fetchImpl)).rejects.toThrow()
    await expect(createQris(ENV, input, spy(() => new Response('<html>', { status: 200 })).fetchImpl)).rejects.toThrow()
    await expect(createQris(ENV, input, spy(() => json({ success: true, data: { reference: 'R' } })).fetchImpl)).rejects.toThrow()
  })
})
