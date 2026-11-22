// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { authenticate } from './auth'

const ENV = { url: 'https://abc.supabase.co/', anonKey: 'anon-key' }
const withAuth = (value: string | null) => new Request('https://f.test/generate', { method: 'POST', headers: value === null ? {} : { authorization: value } })
const authAnswer = (status: number, body: unknown = {}) => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>
const base64url = (text: string) => Buffer.from(text, 'utf8').toString('base64url')
const forged = (payload: unknown) => `${base64url('{"alg":"none"}')}.${base64url(JSON.stringify(payload))}.forged`

describe('authenticate', () => {
  it('asks Supabase Auth who the token belongs to and uses the id it answers with', async () => {
    const fetchImpl = authAnswer(200, { id: 'u-1', email: 'a@b.test', role: 'authenticated' })
    expect(await authenticate(withAuth('Bearer tok-1'), ENV, fetchImpl)).toEqual({ id: 'u-1', email: 'a@b.test' })
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://abc.supabase.co/auth/v1/user')
    expect(init.method).toBe('GET')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-1', apikey: 'anon-key' })
  })

  it('has no email when Auth gives none', async () => {
    expect(await authenticate(withAuth('Bearer tok'), ENV, authAnswer(200, { id: 'u-2' }))).toEqual({ id: 'u-2', email: null })
    expect(await authenticate(withAuth('Bearer tok'), ENV, authAnswer(200, { id: 'u-2', email: '' }))).toEqual({ id: 'u-2', email: null })
  })

  it('does not trust the sub of a token Auth refuses (forged payload)', async () => {
    const fetchImpl = authAnswer(401, { msg: 'invalid JWT' })
    expect(await authenticate(withAuth(`Bearer ${forged({ sub: 'victim', email: 'v@b.test' })}`), ENV, fetchImpl)).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not take the identity from the token, only from the Auth answer', async () => {
    expect(await authenticate(withAuth(`Bearer ${forged({ sub: 'victim' })}`), ENV, authAnswer(200, { id: 'real-user' }))).toEqual({ id: 'real-user', email: null })
  })

  it.each([[400], [401], [403], [404]])('has no user when Auth answers %i', async (status) => {
    expect(await authenticate(withAuth('Bearer tok'), ENV, authAnswer(status))).toBeNull()
  })

  it.each([[null], ['Bearer'], [''], ['Token abc'], ['Bearer a b']])('has no user, and asks nothing, for the header %j', async (value) => {
    const fetchImpl = authAnswer(200, { id: 'u' })
    expect(await authenticate(withAuth(value), ENV, fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([[{}], [{ id: '' }], [{ id: 5 }], [null], [[]]])('has no user for an Auth answer without a usable id: %j', async (body) => {
    expect(await authenticate(withAuth('Bearer tok'), ENV, authAnswer(200, body))).toBeNull()
  })

  it('throws, so the entrypoint answers its generic 500, when Auth cannot be reached or is down', async () => {
    const down = vi.fn(async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    await expect(authenticate(withAuth('Bearer tok'), ENV, down)).rejects.toThrow('auth service unreachable')
    await expect(authenticate(withAuth('Bearer tok'), ENV, authAnswer(503))).rejects.toThrow('auth service answered 503')
  })

  it('throws when the Auth answer is not JSON', async () => {
    const html = vi.fn(async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch
    await expect(authenticate(withAuth('Bearer tok'), ENV, html)).rejects.toThrow('auth service unreachable')
  })
})
