import { describe, expect, it, vi } from 'vitest'
import { deleteAccount, isConfigured, listRows, putRow, refreshSession, sendOtp, signOut, verifyOtp, type Session } from './api'

const CFG = { url: 'https://abc.supabase.co', key: 'sb_publishable_x' }
const SESSION: Session = { accessToken: 'at', refreshToken: 'rt', expiresAt: 2_000_000_000, userId: 'u1', email: 'a@b.co' }
const reply = (body: unknown, status = 200) => vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
const call = (fn: ReturnType<typeof vi.fn>, n = 0) => fn.mock.calls[n] as [string, { method: string; headers: Record<string, string>; body?: string }]

describe('isConfigured', () => {
  it('is false until both URL and a public key are set, and never accepts a secret key', () => {
    expect(isConfigured({ url: '', key: '' })).toBe(false)
    expect(isConfigured({ url: CFG.url, key: 'sb_secret_x' })).toBe(false)
    expect(isConfigured(CFG)).toBe(true)
  })
})

describe('auth', () => {
  it('asks for a one-time code by email', async () => {
    const f = reply({})
    expect(await sendOtp(CFG, 'a@b.co', f as unknown as typeof fetch)).toEqual({ ok: true })
    const [url, init] = call(f)
    expect(url).toBe('https://abc.supabase.co/auth/v1/otp')
    expect(JSON.parse(init.body!)).toEqual({ email: 'a@b.co', create_user: true })
    expect(init.headers.apikey).toBe(CFG.key)
  })

  it('turns a verified code into a session', async () => {
    const f = reply({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: 'u1', email: 'a@b.co' } })
    const result = await verifyOtp(CFG, 'a@b.co', '123456', f as unknown as typeof fetch, () => 1_000_000)
    expect(result).toEqual({ ok: true, session: { accessToken: 'at', refreshToken: 'rt', expiresAt: 1_003_600, userId: 'u1', email: 'a@b.co' } })
    expect(JSON.parse(call(f)[1].body!)).toEqual({ type: 'email', email: 'a@b.co', token: '123456' })
  })

  it('says the code is wrong or expired on 4xx, and offline on a network error', async () => {
    expect(await verifyOtp(CFG, 'a@b.co', '000000', reply({}, 403) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'rejected' })
    expect(await sendOtp(CFG, 'a@b.co', vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'network' })
    expect(await sendOtp(CFG, 'a@b.co', reply({}, 429) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'rate-limit' })
  })

  it('refreshes a session with the refresh token', async () => {
    const f = reply({ access_token: 'at2', refresh_token: 'rt2', expires_in: 3600, user: { id: 'u1', email: 'a@b.co' } })
    const result = await refreshSession(CFG, 'rt', f as unknown as typeof fetch, () => 0)
    expect(result.ok && result.session.accessToken).toBe('at2')
    expect(call(f)[0]).toBe('https://abc.supabase.co/auth/v1/token?grant_type=refresh_token')
  })

  it('signs out on the server, and ignores a failure there', async () => {
    const f = reply({}, 500)
    await expect(signOut(CFG, SESSION, f as unknown as typeof fetch)).resolves.toBeUndefined()
    expect(call(f)[1].headers.Authorization).toBe('Bearer at')
  })
})

describe('rows', () => {
  it('lists rows of the signed-in user with the user token, not the publishable key', async () => {
    const f = reply([{ kind: 'profile', ciphertext: 'c', updated_at: '2026-10-18T10:00:00Z' }])
    const result = await listRows(CFG, SESSION, f as unknown as typeof fetch)
    expect(result).toEqual({ ok: true, rows: [{ kind: 'profile', ciphertext: 'c', updatedAt: '2026-10-18T10:00:00Z' }] })
    expect(call(f)[1].headers.Authorization).toBe('Bearer at')
    expect(call(f)[0]).toContain('/rest/v1/user_data?select=kind,ciphertext,updated_at')
  })

  it('inserts a new row, and updates an existing one only if it has not moved since we read it', async () => {
    const insert = reply([{ updated_at: '2026-10-18T11:00:00Z' }], 201)
    expect(await putRow(CFG, SESSION, 'profile', 'c', null, insert as unknown as typeof fetch)).toEqual({ ok: true, updatedAt: '2026-10-18T11:00:00Z' })
    expect(call(insert)[1].method).toBe('POST')
    const update = reply([{ updated_at: '2026-10-18T12:00:00Z' }])
    await putRow(CFG, SESSION, 'profile', 'c2', '2026-10-18T11:00:00Z', update as unknown as typeof fetch)
    const [url, init] = call(update)
    expect(init.method).toBe('PATCH')
    expect(url).toContain('kind=eq.profile')
    expect(url).toContain('updated_at=eq.2026-10-18T11%3A00%3A00Z')
    expect(JSON.parse(init.body!)).toEqual({ ciphertext: 'c2' })
  })

  it('reports a conflict when another device wrote first (no row matched, or a duplicate insert)', async () => {
    expect(await putRow(CFG, SESSION, 'profile', 'c', 'T', reply([]) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'conflict' })
    expect(await putRow(CFG, SESSION, 'profile', 'c', null, reply({}, 409) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'conflict' })
  })

  it('maps an expired token to "signed-out" and a full server to a failure', async () => {
    expect(await listRows(CFG, SESSION, reply({}, 401) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'signed-out' })
    expect(await listRows(CFG, SESSION, reply({}, 500) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'server' })
  })
})

describe('deleteAccount', () => {
  it('calls the delete_account function as the signed-in user', async () => {
    const f = reply(null, 204)
    expect(await deleteAccount(CFG, SESSION, f as unknown as typeof fetch)).toEqual({ ok: true })
    const [url, init] = call(f)
    expect(url).toBe('https://abc.supabase.co/rest/v1/rpc/delete_account')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer at')
  })

  it('reports failure instead of pretending the account is gone', async () => {
    expect(await deleteAccount(CFG, SESSION, reply({}, 500) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'server' })
  })
})
