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

// Every scroll moves to the next page; the last page repeats. Each search starts again at the pages listed for it
// (by keyword), or at `pages` when none are listed.
function fake(pages: Page[], perSearch: Record<string, Page[]> = {}, failOn?: string) {
  let at = 0
  let current = pages
  const log = { scrolls: 0, closed: 0, visited: [] as string[] }
  const session: ThreadSession = {
    goto: async (url) => {
      const keyword = new URL(url).searchParams.get('q') ?? ''
      if (keyword === failOn) throw new SourceError('timeout')
      log.visited.push(url)
      current = perSearch[keyword] ?? pages
      at = 0
    },
    read: async () => {
      const page = current[Math.min(at, current.length - 1)] ?? { posts: [] }
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

const one = ['loker']

describe('createThreadSource', () => {
  it('turns hiring posts into jobs and drops other posts', async () => {
    const { open, log } = fake([{ posts: [hiring(1), chatter] }])
    const jobs = await createThreadSource({ open, keywords: one }).fetch(prefs, ctx)
    expect(jobs.map((job) => [job.source, job.title])).toEqual([['thread', 'Role 1']])
    expect(log.closed).toBe(1)
  })

  it('scrolls until nothing new shows up twice in a row, without repeats', async () => {
    const { open, log } = fake([{ posts: [hiring(1)] }, { posts: [hiring(1), hiring(2)] }, { posts: [hiring(1), hiring(2)] }])
    const jobs = await createThreadSource({ open, keywords: one }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1', 'Role 2'])
    expect(log.scrolls).toBe(3)
  })

  it('never scrolls more than the limit', async () => {
    const pages = Array.from({ length: 20 }, (_, i) => ({ posts: Array.from({ length: i + 1 }, (_, n) => hiring(n)) }))
    const { open, log } = fake(pages)
    await createThreadSource({ open, keywords: one, maxScrolls: 4 }).fetch(prefs, ctx)
    expect(log.scrolls).toBe(4)
  })

  it('reports blocked on a login wall and still closes the tab', async () => {
    const { open, log } = fake([{ posts: [], loginWall: true }])
    await expect(createThreadSource({ open, keywords: one }).fetch(prefs, ctx)).rejects.toMatchObject({ reason: 'blocked' })
    expect(log.closed).toBe(1)
  })

  it('keeps what it read when the wall appears halfway', async () => {
    const { open } = fake([{ posts: [hiring(1)] }, { posts: [], loginWall: true }])
    const jobs = await createThreadSource({ open, keywords: one }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1'])
  })

  it('reports parse when the page shows no posts at all', async () => {
    const { open } = fake([{ posts: [] }])
    await expect(createThreadSource({ open, keywords: one }).fetch(prefs, ctx)).rejects.toMatchObject({ reason: 'parse' })
  })

  it('reports network when the tab cannot be opened', async () => {
    const source = createThreadSource({ open: async () => { throw new Error('tab closed') } })
    const error = await source.fetch(prefs, ctx).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SourceError)
    expect(error).toMatchObject({ reason: 'network' })
  })

  it('reads the search for every keyword, in order, from the Terbaru tab', async () => {
    const { open, log } = fake([{ posts: [hiring(1)] }])
    await createThreadSource({ open }).fetch(prefs, ctx)
    expect(log.visited).toEqual([
      'https://www.threads.com/search?q=loker&serp_type=default&filter=recent',
      'https://www.threads.com/search?q=lowongan%20kerja&serp_type=default&filter=recent',
      'https://www.threads.com/search?q=hiring&serp_type=default&filter=recent',
    ])
    expect(log.closed).toBe(1)
  })

  it('counts a post found by two searches once', async () => {
    const { open } = fake([], { a: [{ posts: [hiring(1), hiring(2)] }], b: [{ posts: [hiring(2), hiring(3)] }] })
    const jobs = await createThreadSource({ open, keywords: ['a', 'b'] }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1', 'Role 2', 'Role 3'])
  })

  it('keeps what earlier searches found when a later one does not load', async () => {
    const { open, log } = fake([], { a: [{ posts: [hiring(1)] }] }, 'b')
    const jobs = await createThreadSource({ open, keywords: ['a', 'b', 'c'] }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1'])
    expect(log.visited).toHaveLength(1)
    expect(log.closed).toBe(1)
  })

  it('stops at a wall in a later search without trying the rest', async () => {
    const { open, log } = fake([], { a: [{ posts: [hiring(1)] }], b: [{ posts: [], loginWall: true }] })
    const jobs = await createThreadSource({ open, keywords: ['a', 'b', 'c'] }).fetch(prefs, ctx)
    expect(jobs.map((job) => job.title)).toEqual(['Role 1'])
    expect(log.visited).toHaveLength(2)
  })

  it('reports timeout when the first search does not load', async () => {
    const { open, log } = fake([], {}, 'loker')
    await expect(createThreadSource({ open, keywords: one }).fetch(prefs, ctx)).rejects.toMatchObject({ reason: 'timeout' })
    expect(log.closed).toBe(1)
  })
})
