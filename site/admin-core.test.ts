// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { adminRequest, parseStats, sections } from './admin-core.js'

const CFG = { url: 'https://abc.supabase.co', key: 'sb_publishable_x' }

describe('parseStats', () => {
  it('keeps numbers and ignores anything else, so a bad answer cannot break the page', () => {
    const stats = parseStats({
      accounts_total: 5, accounts_writing_7d: '3', accounts_new_by_day: [{ day: '2026-10-18', count: 2 }, { day: 'x', count: 'y' }],
      events_7d: [{ name: 'fill', version: '0.1.0', count: 9 }], events_by_version_30d: [{ version: '0.1.0', count: 12 }],
    })
    expect(stats.accountsTotal).toBe(5)
    expect(stats.accountsWriting7d).toBe(0)
    expect(stats.newByDay).toEqual([{ day: '2026-10-18', count: 2 }])
    expect(stats.events7d).toEqual([{ name: 'fill', version: '0.1.0', count: 9 }])
    expect(stats.byVersion30d).toEqual([{ version: '0.1.0', count: 12 }])
  })

  it('survives null and junk', () => {
    expect(parseStats(null).accountsTotal).toBe(0)
    expect(parseStats('x').newByDay).toEqual([])
  })
})

describe('sections', () => {
  it('lists the headline numbers first, then the tables', () => {
    const view = sections(parseStats({ accounts_total: 5, accounts_writing_7d: 3, accounts_new_by_day: [], events_7d: [{ name: 'fill', version: '0.1.0', count: 9 }], events_by_version_30d: [] }))
    expect(view.headline).toEqual([
      { label: 'Akun terdaftar', value: '5' },
      { label: 'Akun yang menulis dalam 7 hari', value: '3' },
    ])
    expect(view.tables.map((t: { title: string }) => t.title)).toEqual(['Akun baru per hari (30 hari)', 'Kejadian 7 hari terakhir', 'Hitungan per versi (30 hari)'])
    expect(view.tables[1]?.rows).toEqual([['fill', '0.1.0', '9']])
  })
})

describe('adminRequest', () => {
  it('calls admin_stats with the signed-in token, never the publishable key as the user', () => {
    const request = adminRequest(CFG, 'token-123')
    expect(request.url).toBe('https://abc.supabase.co/rest/v1/rpc/admin_stats')
    expect(request.init.headers.Authorization).toBe('Bearer token-123')
    expect(request.init.headers.apikey).toBe(CFG.key)
    expect(request.init.method).toBe('POST')
  })
})
