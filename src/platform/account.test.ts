import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { GenerateRequest } from '../core/generate/protocol'
import type { Session } from '../core/sync/api'

vi.mock('../core/sync/config', () => ({ SUPABASE_CONFIG: { url: 'https://abc.supabase.co', key: 'sb_publishable_test' } }))
vi.mock('./sync', () => ({ currentSession: vi.fn() }))

import { callGenerate, createPayment, loadAccountStatus, loadLedger, purchaseStatus, refreshAccountStatus } from './account'
import { currentSession } from './sync'

const session: Session = { accessToken: 'access-1', refreshToken: 'r', expiresAt: 9_999_999_999, userId: 'u1', email: 'a@b.co' }
const scoreRequest: GenerateRequest = {
  kind: 'score',
  summary: { roles: [], level: 'Junior', skills: [], experience: { titles: [], years: 0 }, education: [], locations: [], workModes: [] },
  jobs: [],
}

type Call = { url: string; init: RequestInit }
let calls: Call[] = []
const first = (): Call => {
  const call = calls[0]
  if (!call) throw new Error('no request was made')
  return call
}

// Answers each request in order, from a (url, init) -> Response-ish function.
function serve(answer: (url: string, init: RequestInit) => { status?: number; body?: unknown; text?: string } | Error) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    const result = answer(url, init)
    if (result instanceof Error) throw result
    const status = result.status ?? 200
    return {
      ok: status < 300,
      status,
      json: async () => {
        if (result.text !== undefined) return JSON.parse(result.text)
        return result.body
      },
    } as Response
  }))
}

const accountRow = { credits: 3, unlocked_at: null, trial_granted_at: '2026-11-19T01:00:00.000Z', credits_expire_at: '2027-11-19T01:00:00.000Z' }

beforeEach(() => {
  fakeBrowser.reset()
  calls = []
  vi.mocked(currentSession).mockReset()
  vi.mocked(currentSession).mockResolvedValue(session)
})

describe('callGenerate', () => {
  it('posts to the generate function with the access token and the anon key', async () => {
    serve(() => ({ body: { ok: true, kind: 'score', results: [], credits: 2, usage: { inputTokens: 1, outputTokens: 1 } } }))
    const response = await callGenerate(scoreRequest)
    expect(response.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(first().url).toBe('https://abc.supabase.co/functions/v1/generate')
    expect(first().init.method).toBe('POST')
    const headers = first().init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer access-1')
    expect(headers.apikey).toBe('sb_publishable_test')
    expect(JSON.parse(String(first().init.body))).toEqual(scoreRequest)
  })

  it('answers unauthenticated without calling the network when there is no session', async () => {
    vi.mocked(currentSession).mockResolvedValue(null)
    serve(() => ({ body: {} }))
    const response = await callGenerate(scoreRequest)
    expect(response).toMatchObject({ ok: false, error: 'unauthenticated', credits: null })
    expect(calls).toHaveLength(0)
  })

  it('returns the refusal body as it is, whatever the status', async () => {
    const refusal = { ok: false, error: 'insufficient', message: 'Kredit habis.', credits: 0 }
    serve(() => ({ status: 402, body: refusal }))
    expect(await callGenerate(scoreRequest)).toEqual(refusal)
  })

  it('turns a body that is not JSON into a readable failure instead of throwing', async () => {
    serve(() => ({ status: 502, text: '<html>bad gateway' }))
    expect(await callGenerate(scoreRequest)).toMatchObject({ ok: false, error: 'ai', credits: null })
  })

  it('turns a body that is not a generate answer into a readable failure', async () => {
    serve(() => ({ status: 200, body: { hello: 'world' } }))
    expect(await callGenerate(scoreRequest)).toMatchObject({ ok: false, error: 'ai', credits: null })
  })

  it('turns an offline fetch into a readable failure instead of throwing', async () => {
    serve(() => new Error('Failed to fetch'))
    const response = await callGenerate(scoreRequest)
    expect(response).toMatchObject({ ok: false, error: 'ai', message: 'Tidak bisa menghubungi server. Coba lagi.', credits: null })
  })
})

describe('createPayment', () => {
  it('posts to create-payment with the same headers', async () => {
    const answer = { ok: true, purchaseId: 'p1', qrUrl: 'https://qr', amountIdr: 10800, credits: 50, expiresAt: '2026-11-19T02:00:00.000Z' }
    serve(() => ({ body: answer }))
    expect(await createPayment()).toEqual(answer)
    expect(first().url).toBe('https://abc.supabase.co/functions/v1/create-payment')
    expect((first().init.headers as Record<string, string>).Authorization).toBe('Bearer access-1')
  })

  it('answers unauthenticated without a session, and gateway when offline', async () => {
    vi.mocked(currentSession).mockResolvedValue(null)
    expect(await createPayment()).toMatchObject({ ok: false, error: 'unauthenticated' })
    expect(calls).toHaveLength(0)

    vi.mocked(currentSession).mockResolvedValue(session)
    serve(() => new Error('offline'))
    expect(await createPayment()).toMatchObject({ ok: false, error: 'gateway' })
  })
})

describe('account status', () => {
  const server = (url: string) => {
    if (url.endsWith('/rest/v1/rpc/ensure_account')) return { body: accountRow }
    if (url.includes('/rest/v1/accounts')) return { body: [accountRow] }
    return { status: 404, body: null }
  }

  it('reads the account after ensuring it, and caches it', async () => {
    serve(server)
    const status = await refreshAccountStatus()
    expect(status).toMatchObject({ credits: 3, paid: false, trialGranted: true, expiresAt: '2027-11-19T01:00:00.000Z' })
    expect(Number.isNaN(Date.parse(status!.checkedAt))).toBe(false)
    expect(first().url).toBe('https://abc.supabase.co/rest/v1/rpc/ensure_account')
    expect(first().init.method).toBe('POST')
    expect(await loadAccountStatus()).toEqual(status)
  })

  it('marks an account that has bought as paid', async () => {
    serve((url) => (url.includes('/rpc/') ? { body: accountRow } : { body: [{ ...accountRow, unlocked_at: '2026-11-19T03:00:00.000Z' }] }))
    expect((await refreshAccountStatus())?.paid).toBe(true)
  })

  it('keeps the cached status when the network is down', async () => {
    serve(server)
    const online = await refreshAccountStatus()
    serve(() => new Error('offline'))
    expect(await refreshAccountStatus()).toEqual(online)
    expect(await loadAccountStatus()).toEqual(online)
  })

  it('has no status before the first successful check', async () => {
    expect(await loadAccountStatus()).toBeNull()
    serve(() => new Error('offline'))
    expect(await refreshAccountStatus()).toBeNull()
  })

  it('drops the cache when there is no session', async () => {
    serve(server)
    await refreshAccountStatus()
    vi.mocked(currentSession).mockResolvedValue(null)
    expect(await refreshAccountStatus()).toBeNull()
    expect(await loadAccountStatus()).toBeNull()
  })
})

describe('purchaseStatus', () => {
  it('reads the status of one purchase', async () => {
    serve(() => ({ body: [{ status: 'paid' }] }))
    expect(await purchaseStatus('p 1')).toBe('paid')
    expect(first().url).toBe('https://abc.supabase.co/rest/v1/purchases?select=status&id=eq.p%201')
    expect((first().init.headers as Record<string, string>).Authorization).toBe('Bearer access-1')
  })

  it('stays pending when the row is missing, unreadable or the network is down', async () => {
    serve(() => ({ body: [] }))
    expect(await purchaseStatus('p1')).toBe('pending')
    serve(() => ({ body: [{ status: 'weird' }] }))
    expect(await purchaseStatus('p1')).toBe('pending')
    serve(() => new Error('offline'))
    expect(await purchaseStatus('p1')).toBe('pending')
  })
})

describe('loadLedger', () => {
  it('reads the newest entries first', async () => {
    serve(() => ({
      body: [
        { created_at: '2026-11-19T02:00:00.000Z', delta: -1, reason: 'generate' },
        { created_at: '2026-11-19T01:00:00.000Z', delta: 3, reason: 'trial' },
      ],
    }))
    expect(await loadLedger(5)).toEqual([
      { at: '2026-11-19T02:00:00.000Z', delta: -1, reason: 'generate' },
      { at: '2026-11-19T01:00:00.000Z', delta: 3, reason: 'trial' },
    ])
    expect(first().url).toBe('https://abc.supabase.co/rest/v1/credit_ledger?select=created_at,delta,reason&order=created_at.desc,id.desc&limit=5')
  })

  it('defaults to 20 entries and is empty without a session or offline', async () => {
    serve(() => ({ body: [] }))
    await loadLedger()
    expect(first().url).toContain('limit=20')

    vi.mocked(currentSession).mockResolvedValue(null)
    expect(await loadLedger()).toEqual([])

    vi.mocked(currentSession).mockResolvedValue(session)
    serve(() => new Error('offline'))
    expect(await loadLedger()).toEqual([])
  })
})
