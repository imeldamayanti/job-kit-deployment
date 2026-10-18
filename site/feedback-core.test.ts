// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildRow, sendFeedback, isPublicKey } from './feedback-core.js'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}
const CONFIG = { url: 'https://abc.supabase.co', key: 'sb_publishable_test' }

describe('buildRow', () => {
  it('keeps kind, message and email, trimmed', () => {
    expect(buildRow(form({ kind: 'Masalah', message: '  form tidak terisi  ', email: ' a@b.co ' }))).toEqual({ kind: 'Masalah', message: 'form tidak terisi', email: 'a@b.co' })
  })

  it('sends no email at all when it is blank', () => {
    expect(buildRow(form({ kind: 'Saran', message: 'x', email: '  ' }))?.email).toBeNull()
  })

  it('rejects an empty message, a bad kind, and a honeypot hit', () => {
    expect(buildRow(form({ kind: 'Saran', message: '   ' }))).toBeNull()
    expect(buildRow(form({ kind: 'Hack', message: 'x' }))).toBeNull()
    expect(buildRow(form({ kind: 'Saran', message: 'x', website: 'http://spam' }))).toBeNull()
  })

  it('cuts the message at 2000 characters, as the table allows', () => {
    expect(buildRow(form({ kind: 'Saran', message: 'a'.repeat(3000) }))?.message).toHaveLength(2000)
  })
})

describe('sendFeedback', () => {
  const row = { kind: 'Masalah', message: 'x', email: null }

  it('is "inactive" and never calls the network while not configured', async () => {
    const fetchFn = vi.fn()
    expect(await sendFeedback(row, { url: '', key: '' }, fetchFn as unknown as typeof fetch)).toBe('inactive')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('posts one row to the feedback table with the publishable key and asks for no row back', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true })
    expect(await sendFeedback(row, CONFIG, fetchFn)).toBe('sent')
    const [url, init] = fetchFn.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }]
    expect(url).toBe('https://abc.supabase.co/rest/v1/feedback')
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBe('sb_publishable_test')
    expect(init.headers.Prefer).toBe('return=minimal')
    expect(JSON.parse(init.body)).toEqual(row)
  })

  it('reports failure on a bad status or a network error', async () => {
    expect(await sendFeedback(row, CONFIG, vi.fn().mockResolvedValue({ ok: false }))).toBe('failed')
    expect(await sendFeedback(row, CONFIG, vi.fn().mockRejectedValue(new Error('offline')))).toBe('failed')
  })

  it('refuses a key that is not a public one', async () => {
    const fetchFn = vi.fn()
    expect(await sendFeedback(row, { url: CONFIG.url, key: 'sb_secret_abc' }, fetchFn)).toBe('inactive')
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('isPublicKey', () => {
  it('accepts publishable keys and legacy anon JWTs, never secret or service_role ones', () => {
    expect(isPublicKey('sb_publishable_x')).toBe(true)
    expect(isPublicKey('sb_secret_x')).toBe(false)
    expect(isPublicKey('')).toBe(false)
    const jwt = (role: string) => `h.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.s`
    expect(isPublicKey(jwt('anon'))).toBe(true)
    expect(isPublicKey(jwt('service_role'))).toBe(false)
  })
})
