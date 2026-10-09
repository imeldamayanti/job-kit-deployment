import { canonicalUrl, nameKey } from './dedupe'
import type { Job, RawJob } from './types'

const DATA_KEYS = [
  'location', 'workplace', 'contract', 'level', 'salary', 'experience', 'postedAt', 'deadline', 'url', 'description', 'logoUrl',
] as const satisfies readonly (keyof RawJob)[]

const isEmpty = (value: string) => value === '' || value === 'unknown'

function refresh(job: Job, incoming: RawJob, now: string): Job {
  const next: Job = { ...job, title: incoming.title || job.title, company: incoming.company || job.company, lastSeenAt: now }
  for (const key of DATA_KEYS) {
    if (!isEmpty(incoming[key])) (next as Record<string, unknown>)[key] = incoming[key]
  }
  return next
}

function create(incoming: RawJob, now: string): Job {
  return {
    ...incoming,
    id: canonicalUrl(incoming.url) || nameKey(incoming.title, incoming.company) || `${incoming.source}:${incoming.title}`,
    status: 'new',
    score: null,
    aiFilled: [],
    firstSeenAt: now,
    lastSeenAt: now,
  }
}

const matches = (job: Job, incoming: RawJob) => {
  const url = canonicalUrl(incoming.url)
  if (url !== '' && url === canonicalUrl(job.url)) return true
  const name = nameKey(incoming.title, incoming.company)
  return name !== '' && name === nameKey(job.title, job.company)
}

// Folds one run into the feed. A job already there is refreshed, never reset: status, score and
// the AI marks stay (FR-28). An empty incoming value never erases a known one.
export function mergeFeed(existing: readonly Job[], incoming: readonly RawJob[], now: string): Job[] {
  const feed = existing.map((job) => ({ ...job }))
  for (const raw of incoming) {
    const index = feed.findIndex((job) => matches(job, raw))
    if (index === -1) feed.push(create(raw, now))
    else feed[index] = refresh(feed[index] as Job, raw, now)
  }
  return feed
}
