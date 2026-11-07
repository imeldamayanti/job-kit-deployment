import type { RawJob } from '../types'
import { fetchText } from './http'
import { collectPages, describe, emptyJob, text } from './shared'
import { SourceError, type JobSource } from './types'

const SITE = 'https://wellfound.com'
const MAX_ROLES = 2

const CONTRACT: Record<string, string> = { 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', internship: 'Internship' }

export const roleSlug = (role: string): string => role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

type Entry = Record<string, unknown>
type Company = { name: string; logo: string }

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [])

// The page is a Next.js app: its data sits in one script as Apollo's cache, with companies and listings apart and linked by reference.
function readCache(page: string): Entry[] {
  const raw = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(page)?.[1]
  if (raw === undefined) throw new SourceError('parse')
  let data: unknown
  try {
    data = (JSON.parse(raw) as { props?: { pageProps?: { apolloState?: { data?: unknown } } } }).props?.pageProps?.apolloState?.data
  } catch {
    throw new SourceError('parse')
  }
  if (typeof data !== 'object' || data === null) throw new SourceError('parse')
  return Object.entries(data).map(([key, value]) => ({ ...(value as Entry), __key: key }))
}

function experience(listing: Entry): string {
  const min = typeof listing.yearsExperienceMin === 'number' ? listing.yearsExperienceMin : 0
  const max = typeof listing.yearsExperienceMax === 'number' ? listing.yearsExperienceMax : 0
  if (max > min) return `${min}-${max} years`
  return min > 0 ? `${min}+ years` : ''
}

function parseListings(page: string): RawJob[] {
  const entries = readCache(page)
  const companies = new Map<string, Company>()
  for (const entry of entries) {
    if (entry.__typename !== 'StartupResult') continue
    const refs = Array.isArray(entry.highlightedJobListings) ? entry.highlightedJobListings : []
    for (const ref of refs) {
      const key = (ref as { __ref?: unknown } | null)?.__ref
      if (typeof key === 'string') companies.set(key, { name: text(entry.name), logo: text(entry.logoUrl) })
    }
  }

  return entries
    .filter((entry) => entry.__typename === 'JobListingSearchResult')
    .map((listing) => {
      const company = companies.get(text(listing.__key))
      const remote = listing.remote === true
      // A remote job names the countries it accepts; none named means it did not limit them.
      const location = remote ? strings(listing.acceptedRemoteLocationNames).join(', ') || 'Remote' : strings(listing.locationNames).join(', ')
      const type = text(listing.jobType)
      return {
        ...emptyJob('wellfound'),
        title: text(listing.title),
        company: company?.name ?? '',
        location,
        workplace: remote ? ('remote' as const) : ('onsite' as const),
        contract: CONTRACT[type] ?? type,
        salary: text(listing.compensation),
        experience: experience(listing),
        postedAt: typeof listing.liveStartAt === 'number' ? new Date(listing.liveStartAt * 1000).toISOString().slice(0, 10) : '',
        url: `${SITE}/jobs/${text(listing.id)}-${text(listing.slug)}`,
        description: describe(listing.description),
        logoUrl: company?.logo ?? '',
      }
    })
}

// Experimental: no public API, and the site's bot protection can refuse at any time. A refusal is recorded and
// three in a row pause the source, like any other.
export const wellfoundSource: JobSource = {
  id: 'wellfound',
  async fetch(prefs, ctx) {
    const slugs = [...new Set(prefs.roles.slice(0, MAX_ROLES).map(roleSlug).filter((slug) => slug !== ''))]
    const urls = slugs.flatMap((slug) => [`${SITE}/role/r/${slug}`, `${SITE}/role/l/${slug}/indonesia`])
    const jobs = await collectPages(ctx, urls, async (url) => parseListings(await fetchText(ctx, url)))
    return [...new Map(jobs.map((job) => [job.url, job])).values()]
  },
}
