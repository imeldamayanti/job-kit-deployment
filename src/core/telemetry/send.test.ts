import { describe, expect, it, vi } from 'vitest'
import { sendCounts } from './send'

const CFG = { url: 'https://abc.supabase.co', key: 'sb_publishable_x' }
const rows = [{ name: 'fill' as const, day: '2026-10-18', version: '0.1.0', count: 3 }]
const reply = (ok: boolean) => vi.fn().mockResolvedValue({ ok, status: ok ? 201 : 500 })

describe('sendCounts', () => {
  it('posts the rows to event_counts with only the publishable key, no user token and no cookies', async () => {
    const f = reply(true)
    expect(await sendCounts(CFG, rows, f as unknown as typeof fetch)).toBe('sent')
    const [url, init] = f.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe('https://abc.supabase.co/rest/v1/event_counts')
    expect(JSON.parse(String(init.body))).toEqual(rows)
    expect(init.headers.apikey).toBe(CFG.key)
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.credentials).toBe('omit')
  })

  it('sends nothing when there are no rows or the server is not configured', async () => {
    const f = reply(true)
    expect(await sendCounts(CFG, [], f as unknown as typeof fetch)).toBe('nothing')
    expect(await sendCounts({ url: '', key: '' }, rows, f as unknown as typeof fetch)).toBe('unavailable')
    expect(f).not.toHaveBeenCalled()
  })

  it('reports failure on a bad status or a network error, so the counts are kept for next time', async () => {
    expect(await sendCounts(CFG, rows, reply(false) as unknown as typeof fetch)).toBe('failed')
    expect(await sendCounts(CFG, rows, vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch)).toBe('failed')
  })
})
