import type { ThreadPost } from './thread-dom'
import { parseThreadPost } from './thread-extract'
import { SourceError, type FetchContext, type JobSource } from './types'

export type ThreadRead = { posts: ThreadPost[]; loginWall: boolean }

// One open feed page. The platform layer backs it with a real tab; tests use a fake.
export type ThreadSession = {
  read: () => Promise<ThreadRead>
  scroll: () => Promise<void>
  close: () => Promise<void>
}

export type ThreadDeps = {
  open: () => Promise<ThreadSession>
  // Few scrolls on purpose: a short, quiet visit looks less like a bot and is all a morning check needs.
  maxScrolls?: number
  // Random pause between two scrolls so they do not come at an even beat.
  pause?: (ctx: FetchContext) => Promise<void>
}

const STALL_LIMIT = 2
const defaultPause = (ctx: FetchContext) => (ctx.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(2500 + Math.random() * 3500)

// Reads the feed of the accounts the user follows, once, and never retries a wall (a retry is what gets accounts flagged).
export function createThreadSource(deps: ThreadDeps): JobSource {
  const maxScrolls = deps.maxScrolls ?? 8
  const pause = deps.pause ?? defaultPause

  return {
    id: 'thread',
    async fetch(_prefs, ctx) {
      let session: ThreadSession
      try {
        session = await deps.open()
      } catch (error) {
        throw error instanceof SourceError ? error : new SourceError('network')
      }

      const seen = new Map<string, ThreadPost>()
      try {
        let stalled = 0
        for (let round = 0; ; round += 1) {
          const page = await session.read()
          if (page.loginWall) {
            if (seen.size > 0) break
            throw new SourceError('blocked')
          }
          const before = seen.size
          for (const post of page.posts) if (!seen.has(post.url)) seen.set(post.url, post)
          stalled = seen.size === before ? stalled + 1 : 0
          if (stalled >= STALL_LIMIT || round >= maxScrolls) break
          await pause(ctx)
          await session.scroll()
        }
      } finally {
        await session.close().catch(() => {})
      }

      // Posts on the page but no job in them is a normal quiet day; no posts at all means the page changed.
      if (seen.size === 0) throw new SourceError('parse')
      return [...seen.values()].flatMap((post) => parseThreadPost(post.text, { url: post.url, postedAt: post.postedAt }))
    },
  }
}
