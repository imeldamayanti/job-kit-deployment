// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createDb } from './db'

type Seen = { url: string; init: RequestInit }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const spy = (respond: () => Response) => {
  const seen: Seen[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => (seen.push({ url: String(url), init: init as RequestInit }), respond())
  return { seen, fetchImpl }
}
const body = (call: Seen | undefined) => JSON.parse(String(call?.init.body))
const USER = '11111111-1111-1111-1111-111111111111'

describe('createDb', () => {
  it('calls the RPC with the service key in apikey and Authorization', async () => {
    const { seen, fetchImpl } = spy(() => json('00000000-0000-0000-0000-000000000001'))
    const db = createDb('https://proj.supabase.test', 'service-key', fetchImpl)
    await db.reserve(USER, 'cv', 1)
    expect(seen[0]?.url).toBe('https://proj.supabase.test/rest/v1/rpc/reserve_credits')
    expect(seen[0]?.init.method).toBe('POST')
    const headers = seen[0]?.init.headers as Record<string, string>
    expect(headers.apikey).toBe('service-key')
    expect(headers.Authorization).toBe('Bearer service-key')
    expect(body(seen[0])).toEqual({ p_user: USER, p_kind: 'cv', p_cost: 1 })
  })

  it('reserve returns the generation id', async () => {
    const { fetchImpl } = spy(() => json('00000000-0000-0000-0000-000000000001'))
    expect(await createDb('https://p.test', 'k', fetchImpl).reserve(USER, 'letter', 1)).toEqual({ ok: true, id: '00000000-0000-0000-0000-000000000001' })
  })

  it.each(['insufficient', 'expired'] as const)('reserve maps a PostgREST "%s" 400 to a refusal', async (message) => {
    const { fetchImpl } = spy(() => json({ code: 'P0001', message, details: null, hint: null }, 400))
    expect(await createDb('https://p.test', 'k', fetchImpl).reserve(USER, 'cv', 1)).toEqual({ ok: false, error: message })
  })

  it.each([
    [{ code: 'P0001', message: 'invalid_cost' }, 400],
    [{ code: '28000', message: 'unauthenticated' }, 403],
    [{ message: 'upstream down' }, 502],
  ])('reserve throws on an error it does not know (%j)', async (error, status) => {
    const { fetchImpl } = spy(() => json(error, status))
    await expect(createDb('https://p.test', 'k', fetchImpl).reserve(USER, 'cv', 1)).rejects.toThrow()
  })

  it('does not put the service key in a thrown error', async () => {
    const { fetchImpl } = spy(() => json({ message: 'boom' }, 500))
    const error = await createDb('https://p.test', 'secret-service-key', fetchImpl).guard(USER, 50, 30).catch((e: Error) => e)
    expect(String((error as Error).message)).not.toContain('secret-service-key')
  })

  it('settle sends every argument and returns the new balance', async () => {
    const { seen, fetchImpl } = spy(() => json(7))
    const balance = await createDb('https://p.test', 'k', fetchImpl).settle('gen-1', false, 'ai', 'deepseek-chat', 100, 40, 0.00123)
    expect(balance).toBe(7)
    expect(seen[0]?.url).toBe('https://p.test/rest/v1/rpc/settle_generation')
    expect(body(seen[0])).toEqual({ p_id: 'gen-1', p_ok: false, p_refund_reason: 'ai', p_model: 'deepseek-chat', p_in: 100, p_out: 40, p_cost: 0.00123 })
  })

  it('settle throws when the database says not_found', async () => {
    const { fetchImpl } = spy(() => json({ code: 'P0001', message: 'not_found' }, 400))
    await expect(createDb('https://p.test', 'k', fetchImpl).settle('x', true, null, 'm', 0, 0, 0)).rejects.toThrow()
  })

  it.each(['ok', 'budget', 'rate-limit'] as const)('guard returns %s', async (answer) => {
    const { seen, fetchImpl } = spy(() => json(answer))
    expect(await createDb('https://p.test', 'k', fetchImpl).guard(USER, 50, 30)).toBe(answer)
    expect(seen[0]?.url).toBe('https://p.test/rest/v1/rpc/ai_guard')
    expect(body(seen[0])).toEqual({ p_user: USER, p_budget_usd: 50, p_rate: 30 })
  })

  it('guard throws on an answer it does not know', async () => {
    const { fetchImpl } = spy(() => json('maybe'))
    await expect(createDb('https://p.test', 'k', fetchImpl).guard(USER, 50, 30)).rejects.toThrow()
  })

  it('balance reads credits from the account row, and 0 when there is none', async () => {
    const found = spy(() => json([{ credits: 42 }]))
    expect(await createDb('https://p.test', 'k', found.fetchImpl).balance(USER)).toBe(42)
    expect(found.seen[0]?.url).toBe(`https://p.test/rest/v1/accounts?user_id=eq.${USER}&select=credits`)
    expect(found.seen[0]?.init.method).toBe('GET')
    const none = spy(() => json([]))
    expect(await createDb('https://p.test', 'k', none.fetchImpl).balance(USER)).toBe(0)
  })

  it('tolerates a trailing slash in the url', async () => {
    const { seen, fetchImpl } = spy(() => json(1))
    await createDb('https://p.test/', 'k', fetchImpl).settle('x', true, null, 'm', 0, 0, 0)
    expect(seen[0]?.url).toBe('https://p.test/rest/v1/rpc/settle_generation')
  })
  describe('payments', () => {
    const PURCHASE = '22222222-2222-2222-2222-222222222222'
    const purchaseRow = { id: PURCHASE, user_id: USER, package_id: 'basic', amount_idr: 10800, credits: 50, status: 'pending', gateway_reference: null, qr_url: null, expires_at: '2026-11-19T10:30:00+00:00', paid_at: null, created_at: '2026-11-19T10:00:00+00:00' }

    it('createPurchase calls create_purchase and maps the row', async () => {
      const { seen, fetchImpl } = spy(() => json(purchaseRow))
      const purchase = await createDb('https://p.test', 'k', fetchImpl).createPurchase(USER, 'basic')
      expect(seen[0]?.url).toBe('https://p.test/rest/v1/rpc/create_purchase')
      expect(body(seen[0])).toEqual({ p_user: USER, p_package: 'basic' })
      expect(purchase).toEqual({ id: PURCHASE, status: 'pending', amountIdr: 10800, credits: 50, qrUrl: null, expiresAt: '2026-11-19T10:30:00+00:00' })
    })

    it('createPurchase keeps the qr_url of a purchase that already has one', async () => {
      const { fetchImpl } = spy(() => json({ ...purchaseRow, qr_url: 'https://api.midtrans.com/v2/qris/1/qr-code' }))
      expect((await createDb('https://p.test', 'k', fetchImpl).createPurchase(USER, 'basic')).qrUrl).toBe('https://api.midtrans.com/v2/qris/1/qr-code')
    })

    it.each([[{ ...purchaseRow, id: undefined }], [{ ...purchaseRow, amount_idr: '10800' }], [null], [[]]])('createPurchase throws on a row it cannot read (%j)', async (row) => {
      const { fetchImpl } = spy(() => json(row))
      await expect(createDb('https://p.test', 'k', fetchImpl).createPurchase(USER, 'basic')).rejects.toThrow()
    })

    it('createPurchase throws on unknown_package', async () => {
      const { fetchImpl } = spy(() => json({ code: 'P0001', message: 'unknown_package' }, 400))
      await expect(createDb('https://p.test', 'k', fetchImpl).createPurchase(USER, 'x')).rejects.toThrow()
    })

    it('attachGateway sends the arguments and returns the QR url recorded in the database', async () => {
      const { seen, fetchImpl } = spy(() => json('https://q.test/recorded'))
      await expect(createDb('https://p.test', 'k', fetchImpl).attachGateway(PURCHASE, 'mt-1', 'https://q.test/1')).resolves.toBe('https://q.test/recorded')
      expect(seen[0]?.url).toBe('https://p.test/rest/v1/rpc/attach_gateway')
      expect(body(seen[0])).toEqual({ p_purchase: PURCHASE, p_reference: 'mt-1', p_qr_url: 'https://q.test/1' })
    })

    it.each([[() => json(null)], [() => new Response(null, { status: 204 })], [() => json('')], [() => json(5)]])('attachGateway throws when the database names no recorded QR', async (respond) => {
      await expect(createDb('https://p.test', 'k', spy(respond).fetchImpl).attachGateway(PURCHASE, 'mt-1', 'https://q.test/1')).rejects.toThrow()
    })

    it('attachGateway throws on not_found', async () => {
      const { fetchImpl } = spy(() => json({ code: 'P0001', message: 'not_found' }, 400))
      await expect(createDb('https://p.test', 'k', fetchImpl).attachGateway(PURCHASE, 'R', 'u')).rejects.toThrow()
    })

    it('applyPayment passes the duplicate answer through', async () => {
      expect(await createDb('https://p.test', 'k', spy(() => json('duplicate')).fetchImpl).applyPayment(PURCHASE, 'mt-2', 'PAID', 10800)).toBe('duplicate')
    })

    it('applyPayment returns the final status', async () => {
      const { seen, fetchImpl } = spy(() => json('paid'))
      expect(await createDb('https://p.test', 'k', fetchImpl).applyPayment(PURCHASE, 'mt-1', 'PAID', 10800)).toBe('paid')
      expect(seen[0]?.url).toBe('https://p.test/rest/v1/rpc/apply_payment')
      expect(body(seen[0])).toEqual({ p_purchase: PURCHASE, p_reference: 'mt-1', p_status: 'PAID', p_amount: 10800 })
    })

    it('applyPayment maps not_found to the answer "not_found"', async () => {
      const { fetchImpl } = spy(() => json({ code: 'P0001', message: 'not_found' }, 400))
      expect(await createDb('https://p.test', 'k', fetchImpl).applyPayment(PURCHASE, 'R', 'PAID', 1)).toBe('not_found')
    })

    it.each([[{ code: '23505', message: 'duplicate key value violates unique constraint "purchases_gateway_reference_key"' }, 409], [{ message: 'upstream down' }, 502]])('applyPayment throws on any other error (%j)', async (error, status) => {
      const { fetchImpl } = spy(() => json(error, status))
      await expect(createDb('https://p.test', 'k', fetchImpl).applyPayment(PURCHASE, 'R', 'PAID', 1)).rejects.toThrow()
    })

    it('applyPayment throws on a non-string answer', async () => {
      const { fetchImpl } = spy(() => json(5))
      await expect(createDb('https://p.test', 'k', fetchImpl).applyPayment(PURCHASE, 'R', 'PAID', 1)).rejects.toThrow()
    })
  })
})
