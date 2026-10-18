import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

vi.mock('../core/sync/config', () => ({ SUPABASE_CONFIG: { url: 'https://abc.supabase.co', key: 'sb_publishable_test' } }))

import { disableTelemetry, enableTelemetry, loadTelemetry, noteEvent, pendingLines } from './telemetry'

const sent: unknown[] = []
beforeEach(() => {
  fakeBrowser.reset()
  sent.length = 0
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({ version: '0.1.0' } as never)
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)))
    return { ok: true, status: 201 } as Response
  }))
})

describe('platform telemetry', () => {
  it('is off by default: noting an event stores nothing and sends nothing', async () => {
    await noteEvent('fill')
    expect((await loadTelemetry()).counts).toEqual({})
    expect(sent).toEqual([])
  })

  it('once on, counts events and shows them as the next batch', async () => {
    await enableTelemetry(async () => true)
    await noteEvent('fill', new Date(2026, 9, 18, 12))
    await noteEvent('fill', new Date(2026, 9, 18, 13))
    expect((await loadTelemetry()).counts).toEqual({ '2026-10-18': { fill: 2 } })
    expect(await pendingLines()).toHaveLength(1)
  })

  it('sends yesterday\'s counts on the first event of a new day, and keeps today\'s', async () => {
    await enableTelemetry(async () => true)
    await noteEvent('fill', new Date(2026, 9, 18, 12))
    expect(sent).toEqual([])
    await noteEvent('cv_built', new Date(2026, 9, 19, 9))
    expect(sent).toEqual([[{ name: 'fill', day: '2026-10-18', version: '0.1.0', count: 1 }]])
    expect((await loadTelemetry()).counts).toEqual({ '2026-10-19': { cv_built: 1 } })
  })

  it('keeps the counts when the send fails, to try again later', async () => {
    await enableTelemetry(async () => true)
    await noteEvent('fill', new Date(2026, 9, 18, 12))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as Response))
    await noteEvent('fill', new Date(2026, 9, 19, 9))
    expect((await loadTelemetry()).counts).toEqual({ '2026-10-18': { fill: 1 }, '2026-10-19': { fill: 1 } })
  })

  it('does not turn on when the person refuses the server permission', async () => {
    expect(await enableTelemetry(async () => false)).toBe(false)
    expect((await loadTelemetry()).enabled).toBe(false)
  })

  it('turning off forgets the waiting counts', async () => {
    await enableTelemetry(async () => true)
    await noteEvent('fill')
    await disableTelemetry()
    expect(await loadTelemetry()).toMatchObject({ enabled: false, counts: {} })
  })

  it('never lets a failure here break the feature that called it', async () => {
    await enableTelemetry(async () => true)
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('boom'))
    await expect(noteEvent('fill')).resolves.toBeUndefined()
  })
})
