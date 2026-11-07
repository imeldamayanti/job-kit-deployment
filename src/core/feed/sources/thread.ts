import type { ThreadPost } from './thread-dom'
import { parseThreadPost } from './thread-extract'
import { THREAD_KEYWORDS, threadSearchUrl } from './thread-selectors'
import { SourceError, type FetchContext, type JobSource } from './types'

export type ThreadRead = { posts: ThreadPost[]; loginWall: boolean }

// One open Threads window. The platform layer backs it with a real tab; tests use a fake.
export type ThreadSession = {
  // Loads a page in the window and waits for its first posts.
  goto: (url: string) => Promise<void>
  read: () => Promise<ThreadRead>
  scroll: () => Promise<void>
  close: () => Promise<void>
}

export type ThreadDeps = {
  open: () => Promise<ThreadSession>
  keywords?: readonly string[]
  // Few scrolls per search on purpose: a short, quiet visit looks less like a bot and is all a morning check needs.
  maxScrolls?: number
  // Random pause between two scrolls or two searches so they do not come at an even beat.
  pause?: (ctx: FetchContext) => Promise<void>
}

const STALL_LIMIT = 2
const defaultPause = (ctx: FetchContext) => (ctx.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(2500 + Math.random() * 3500)

// Reads the Threads search for each hiring keyword, once, and never retries a wall (a retry is what gets accounts flagged).
export function createThreadSource(deps: ThreadDeps): JobSource {
  const keywords = deps.keywords ?? THREAD_KEYWORDS
  const maxScrolls = deps.maxScrolls ?? 4
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
        searches: for (const [index, keyword] of keywords.entries()) {
          if (index > 0) await pause(ctx)
          try {
            await session.goto(threadSearchUrl(keyword))
          } catch (error) {
            // A search that does not load later in the run costs that search, not what the earlier ones found.
            if (seen.size > 0) break searches
            throw error
          }
          const before = seen.size
          let stalled = 0
          for (let round = 0; ; round += 1) {
            const page = await session.read()
            if (page.loginWall) {
              if (seen.size > 0) break searches
              throw new SourceError('blocked')
            }
            const count = seen.size
            for (const post of page.posts) if (!seen.has(post.url)) seen.set(post.url, post)
            stalled = seen.size === count ? stalled + 1 : 0
            if (stalled >= STALL_LIMIT || round >= maxScrolls) break
            await pause(ctx)
            await session.scroll()
          }
          console.info(`[jobkit:thread] "${keyword}": ${seen.size - before} post baru`)
        }
      } catch (error) {
        throw error instanceof SourceError ? error : new SourceError('network')
      } finally {
        await session.close().catch(() => {})
      }

      // Posts on the page but no job in them is a normal quiet day; no posts at all means the page changed.
      if (seen.size === 0) {
        console.info('[jobkit:thread] 0 post terbaca: selector kemungkinan tidak cocok dengan halaman')
        throw new SourceError('parse')
      }
      const jobs = [...seen.values()].flatMap((post) => parseThreadPost(post.text, { url: post.url, postedAt: post.postedAt }))
      // The one number that tells "selectors miss" (0 posts) from "searches had no hiring posts" (many posts, 0 jobs).
      console.info(`[jobkit:thread] ${seen.size} post terbaca, ${jobs.length} lowongan lolos parser`)
      return jobs
    },
  }
}
