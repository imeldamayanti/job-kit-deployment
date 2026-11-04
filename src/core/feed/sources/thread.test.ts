import { describe, expect, it } from 'vitest'
import type { JobPreferences } from '../../profile/job-preferences'
import { createThreadSource, type ThreadSession } from './thread'
import type { ThreadPost } from './thread-dom'
import { SourceError, type FetchContext } from './types'

const prefs = {} as JobPreferences
const ctx: FetchContext = { fetch: async () => new Response(''), now: new Date('2026-10-19T01:00:00Z'), companies: {}, sleep: async () => {} }

const hiring = (n: number): ThreadPost => ({ url: `https://www.threads.com/@a/post/P${n}`, postedAt: '2026-10-19', text: `We're hiring: Role ${n} — remote` })
const chatter: ThreadPost = { url: 'https://www.threads.com/@a/post/CHAT', postedAt: '', text: 'Capek banget kerja pakai AI' }

type Page = { posts: ThreadPost[]; loginWall?: boolean }

// Every scroll moves to the next page; the last page repeats.
function fake(pages: Page[]) {
  let at = 0
  const log = { scrolls: 0, closed: 0 }
  const session: ThreadSession = {
    read: async () => {
      const page = pages[Math.min(at, pages.length - 1)] ?? { posts: [] }
      return { posts: page.posts, loginWall: page.loginWall ?? false }
    },
    scroll: async () => {
      log.scrolls += 1
      at += 1
    },
    close: async () => {
      log.closed += 1
    },
  }
  return { log, open: async () => session }
}

describe('createThreadSource', () => {
  it('turns hiring posts into jobs and drops other posts', async () => {
    const { open, log } = fake([{ posts: [hiring(1), chatter] }])
    const jobs = await createThreadSource({ open }).fetch(prefs, ctx)
    expect(jobs.map((job) => [job.source, job.title])).toEqual([['thread', 'Role 1']])
    expect(log.closed).toBe(1)
  })

  it('scrolls until nothing new shows up twice in a row, without repeats', async () => {
    const { open, log } = fake([{ posts: [hiring(1)] }, { posts: [hiring(1), hiring(2)] }, { posts: [hiring(1), hiring(2)] }])
    const jobs = await createThreadSource({ open }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1', 'Role 2'])
    expect(log.scrolls).toBe(3)
  })

  it('never scrolls more than the limit', async () => {
    const pages = Array.from({ length: 20 }, (_, i) => ({ posts: Array.from({ length: i + 1 }, (_, n) => hiring(n)) }))
    const { open, log } = fake(pages)
    await createThreadSource({ open, maxScrolls: 4 }).fetch(prefs, ctx)
    expect(log.scrolls).toBe(4)
  })

  it('reports blocked on a login wall and still closes the tab', async () => {
    const { open, log } = fake([{ posts: [], loginWall: true }])
    await expect(createThreadSource({ open }).fetch(prefs, ctx)).rejects.toMatchObject({ reason: 'blocked' })
    expect(log.closed).toBe(1)
  })

  it('keeps what it read when the wall appears halfway', async () => {
    const { open } = fake([{ posts: [hiring(1)] }, { posts: [], loginWall: true }])
    const jobs = await createThreadSource({ open }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1'])
  })

  it('reports parse when the page shows no posts at all', async () => {
    const { open } = fake([{ posts: [] }])
    await expect(createThreadSource({ open }).fetch(prefs, ctx)).rejects.toMatchObject({ reason: 'parse' })
  })

  it('reports network when the tab cannot be opened', async () => {
    const source = createThreadSource({ open: async () => { throw new Error('tab closed') } })
    const error = await source.fetch(prefs, ctx).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SourceError)
    expect(error).toMatchObject({ reason: 'network' })
  })
})
