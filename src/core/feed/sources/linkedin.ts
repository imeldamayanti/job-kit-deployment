import type { JobPreferences, WorkMode } from '../../profile/job-preferences'
import { canonicalUrl } from '../dedupe'
import { passesRules } from '../rules'
import type { RawJob } from '../types'
import { fetchText } from './http'
import { isLoginWall, looksLikeResults, type LinkedInDetail } from './linkedin-parse'
import { SourceError, type FetchContext, type JobSource } from './types'

const SEARCH = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const DETAIL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'
const PAGE_SIZE = 10
const WORK_TYPE_CODE: Record<WorkMode, number> = { 'On-site': 1, Remote: 2, Hybrid: 3 }

export type LinkedInDeps = {
  // HTML is read where a DOM exists (offscreen document); the service worker has no DOMParser.
  parseSearch: (html: string) => RawJob[] | Promise<RawJob[]>
  parseDetail: (html: string) => LinkedInDetail | Promise<LinkedInDetail>
  // Pages per run across all queries; the number comes from the T27 spike and the user's choice.
  maxPages?: number
  maxDetails?: number
  // Random pause between two requests so the traffic does not look like a burst.
  pause?: (ctx: FetchContext) => Promise<void>
}

export function buildSearchUrl(prefs: JobPreferences, role: string, start: number): string {
  const params = new URLSearchParams({ keywords: role, location: prefs.locations[0] ?? 'Worldwide', start: String(start) })
  if (prefs.workModes.length > 0 && prefs.workModes.length < 3) {
    params.set('f_WT', prefs.workModes.map((mode) => WORK_TYPE_CODE[mode]).sort().join(','))
  }
  return `${SEARCH}?${params}`
}

const defaultPause = (ctx: FetchContext) => (ctx.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms))))(3000 + Math.random() * 3000)

export function createLinkedInSource(deps: LinkedInDeps): JobSource {
  const maxPages = deps.maxPages ?? 5
  const maxDetails = deps.maxDetails ?? 30
  const pause = deps.pause ?? defaultPause

  return {
    id: 'linkedin',
    async fetch(prefs, ctx) {
      const roles = prefs.roles.slice(0, 2)
      if (roles.length === 0) return []
      const pagesPerRole = Math.max(1, Math.floor(maxPages / roles.length))
      const found: RawJob[] = []
      let requests = 0

      search: for (const role of roles) {
        for (let page = 0; page < pagesPerRole; page += 1) {
          if (requests > 0) await pause(ctx)
          requests += 1
          let html: string
          try {
            html = await fetchText(ctx, buildSearchUrl(prefs, role, page * PAGE_SIZE))
          } catch (error) {
            // Blocked halfway: keep what was already read instead of losing the whole run.
            if (error instanceof SourceError && found.length > 0) break search
            throw error
          }
          if (isLoginWall(html)) {
            if (found.length > 0) break search
            throw new SourceError('blocked')
          }
          const cards = await deps.parseSearch(html)
          if (cards.length === 0) {
            if (page === 0 && found.length === 0 && requests === 1 && html.trim().length > 200 && !looksLikeResults(html)) throw new SourceError('parse')
            break
          }
          found.push(...cards.map((job) => ({ ...job, url: canonicalUrl(job.url) || job.url })))
        }
      }

      // The detail page is the only place with the description and the level, so it is fetched
      // only for jobs that already passed the rules (T31) and only up to a cap.
      const wanted = found.filter((job) => passesRules(job, prefs)).slice(0, maxDetails)
      for (const job of wanted) {
        const id = /(\d{6,})\/?$/.exec(new URL(job.url).pathname)?.[1]
        if (!id) continue
        try {
          await pause(ctx)
          const detail = await deps.parseDetail(await fetchText(ctx, `${DETAIL}${id}`))
          job.description = detail.description
          job.level = detail.level
          job.contract = detail.contract
        } catch {
          // A job without a description is still worth showing; the rough score copes.
        }
      }
      return found
    },
  }
}
