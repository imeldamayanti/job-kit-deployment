import { describe, expect, it } from 'vitest'
import { describeFunnel, funnelStats, STALE_DAYS } from './funnel'
import { VIZ_NOW, VIZ_SAMPLE } from './preview'
import type { AppStatus, Application } from './types'

const NOW = new Date('2026-10-20T08:00:00.000Z')
const DAY = 86_400_000
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString()

// An application whose status history is `moves`, each [status, days ago]. The last move is the current status.
function app(moves: [AppStatus, number][], extra: Partial<Application> = {}): Application {
  const events = moves.map(([to, ago], index) => ({ at: daysAgo(ago), type: 'status' as const, from: moves[index - 1]?.[0] ?? ('draft' as const), to }))
  const status = moves.at(-1)?.[0] ?? 'draft'
  return {
    id: 'app', jobId: null, status, cvId: null, letterId: null, followUpAt: null, notes: '', events, createdAt: daysAgo(40), updatedAt: daysAgo(0),
    job: { title: 'T', company: 'C', url: '', source: 'manual', description: '', capturedAt: daysAgo(40) },
    ...extra,
  }
}

const count = (apps: Application[], id: string) => funnelStats(apps, NOW).nodes.find((node) => node.id === id)?.count
const flow = (apps: Application[], from: string, to: string) => funnelStats(apps, NOW).links.find((link) => link.from === from && link.to === to)?.count ?? 0

describe('funnelStats counting', () => {
  it('counts only applications that were sent: Draft and Dibatalkan are left out', () => {
    const apps = [app([]), app([['applied', 3], ['withdrawn', 1]]), app([['withdrawn', 1]]), app([['applied', 3]])]

    expect(funnelStats(apps, NOW).total).toBe(1)
    expect(count(apps, 'applied')).toBe(1)
  })

  it('has no flows when nothing was sent', () => {
    const funnel = funnelStats([app([]), app([['withdrawn', 1]])], NOW)

    expect(funnel.total).toBe(0)
    expect(funnel.links).toEqual([])
  })

  it('takes the furthest stage ever reached, not the current status', () => {
    const apps = [app([['applied', 9], ['in-review', 6], ['interview', 3], ['in-review', 1]])]

    expect(count(apps, 'interview')).toBe(1)
    expect(flow(apps, 'interview', 'ongoing')).toBe(1)
  })

  it('counts a rejection from the last stage reached before it', () => {
    const apps = [
      app([['applied', 9], ['rejected', 5]]),
      app([['applied', 9], ['in-review', 6], ['rejected', 5]]),
      app([['applied', 9], ['in-review', 6], ['interview', 4], ['rejected', 2]]),
    ]

    expect(flow(apps, 'applied', 'rejected')).toBe(1)
    expect(flow(apps, 'in-review', 'rejected')).toBe(1)
    expect(flow(apps, 'interview', 'rejected')).toBe(1)
    expect(count(apps, 'rejected')).toBe(3)
  })

  it('sends a rejection after an offer through Interview, since Offer is an end point of its own', () => {
    const apps = [app([['applied', 9], ['interview', 6], ['offer', 4], ['rejected', 2]])]

    expect(flow(apps, 'interview', 'rejected')).toBe(1)
    expect(count(apps, 'offer')).toBe(0)
  })

  it('passes through the stages in between when one is skipped', () => {
    const apps = [app([['applied', 9], ['interview', 3]])]

    expect(count(apps, 'in-review')).toBe(1)
    expect(flow(apps, 'applied', 'in-review')).toBe(1)
    expect(flow(apps, 'in-review', 'interview')).toBe(1)
  })

  it('ends an Offer at Offer, coming from Interview', () => {
    const apps = [app([['applied', 9], ['in-review', 6], ['interview', 4], ['offer', 1]])]

    expect(flow(apps, 'interview', 'offer')).toBe(1)
    expect(count(apps, 'offer')).toBe(1)
  })

  it('treats an application with no status event as applied since it was created', () => {
    const apps = [app([], { status: 'applied', createdAt: daysAgo(30) })]

    expect(funnelStats(apps, NOW).total).toBe(1)
    expect(count(apps, 'stalled')).toBe(1)
  })
})

describe('funnelStats Tanpa kabar', () => {
  it('puts an application still at Dilamar after 20 days with no change in Tanpa kabar', () => {
    expect(count([app([['applied', 20]])], 'stalled')).toBe(1)
    expect(flow([app([['applied', 20]])], 'applied', 'stalled')).toBe(1)
  })

  it('keeps one that is 5 days old in Masih berjalan', () => {
    expect(count([app([['applied', 5]])], 'ongoing')).toBe(1)
    expect(count([app([['applied', 5]])], 'stalled')).toBe(0)
  })

  it(`counts ${STALE_DAYS} days exactly as Tanpa kabar, and one minute less as Masih berjalan`, () => {
    const exact = app([['applied', STALE_DAYS]])
    const almost = app([['applied', STALE_DAYS]])
    almost.events[0] = { ...almost.events[0]!, at: new Date(NOW.getTime() - STALE_DAYS * DAY + 60_000).toISOString() }

    expect(count([exact], 'stalled')).toBe(1)
    expect(count([almost], 'ongoing')).toBe(1)
  })

  it('does not call a Direview or Interview application Tanpa kabar however old it is', () => {
    const apps = [app([['applied', 40], ['in-review', 30]]), app([['applied', 40], ['interview', 30]])]

    expect(count(apps, 'stalled')).toBe(0)
    expect(count(apps, 'ongoing')).toBe(2)
  })

  it('measures the wait from the last status change, so a note or a document does not restart it', () => {
    const old = app([['applied', 20]], { updatedAt: daysAgo(0) })

    expect(count([old], 'stalled')).toBe(1)
  })
})

describe('funnelStats on the 12 sample applications of the T40 mockup', () => {
  const funnel = funnelStats(VIZ_SAMPLE, VIZ_NOW)
  const node = (id: string) => funnel.nodes.find((n) => n.id === id)?.count

  it('gives the numbers of the mockup', () => {
    expect(funnel.total).toBe(12)
    expect(['applied', 'in-review', 'interview', 'offer', 'stalled', 'rejected', 'ongoing'].map(node)).toEqual([12, 6, 3, 1, 4, 4, 3])
  })

  it('gives the flows of the mockup', () => {
    expect(funnel.links).toHaveLength(9)
    expect(funnel.links).toEqual(
      expect.arrayContaining([
        { from: 'applied', to: 'stalled', count: 4 },
        { from: 'applied', to: 'rejected', count: 2 },
        { from: 'applied', to: 'in-review', count: 6 },
        { from: 'in-review', to: 'rejected', count: 1 },
        { from: 'in-review', to: 'ongoing', count: 2 },
        { from: 'in-review', to: 'interview', count: 3 },
        { from: 'interview', to: 'ongoing', count: 1 },
        { from: 'interview', to: 'rejected', count: 1 },
        { from: 'interview', to: 'offer', count: 1 },
      ]),
    )
  })

  it('ends every sent application in exactly one end point', () => {
    const ends = ['offer', 'stalled', 'rejected', 'ongoing'].reduce((sum, id) => sum + (node(id) ?? 0), 0)

    expect(ends).toBe(funnel.total)
  })
})

describe('describeFunnel', () => {
  it('gives a short text for a screen reader, in the words of the mockup', () => {
    expect(describeFunnel(funnelStats(VIZ_SAMPLE, VIZ_NOW))).toBe(
      'Alur 12 lamaran: 6 sampai Direview, 3 sampai Interview, 1 Offer; 4 tanpa kabar, 4 ditolak, 3 masih berjalan',
    )
  })

  it('leaves out what is zero', () => {
    expect(describeFunnel(funnelStats([app([['applied', 2]])], NOW))).toBe('Alur 1 lamaran: 1 masih berjalan')
  })
})
