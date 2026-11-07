import { truncateText } from '../text'
import type { RawJob, Workplace } from '../types'
import { fetchJson } from './http'
import { asArray, collectPages, dateOnly, DESCRIPTION_LIMIT, emptyJob, text } from './shared'
import type { JobSource } from './types'

// JobStreet runs one search API per country (the SEEK platform). It needs no login and answers JSON.
export type JobStreetSite = { host: string; siteKey: string; country: string }

export const JOBSTREET_SITES = {
  id: { host: 'id.jobstreet.com', siteKey: 'ID-Main', country: 'Indonesia' },
  sg: { host: 'sg.jobstreet.com', siteKey: 'SG-Main', country: 'Singapore' },
} satisfies Record<string, JobStreetSite>

const PAGE_SIZE = 30
const SINGAPORE = /\bsingapore\b|\bsingapura\b/i

// Indonesia always; Singapore only when it is one of the wanted places, since its jobs are on-site there.
export function jobStreetSites(locations: readonly string[]): JobStreetSite[] {
  return [JOBSTREET_SITES.id, ...(locations.some((place) => SINGAPORE.test(place)) ? [JOBSTREET_SITES.sg] : [])]
}

export const jobStreetUrl = (site: JobStreetSite, keyword: string) =>
  `https://${site.host}/api/jobsearch/v5/search?siteKey=${site.siteKey}&keywords=${encodeURIComponent(keyword)}&sortmode=KeywordRelevance&daterange=14&page=1&pageSize=${PAGE_SIZE}`

const WORKPLACE: Record<string, Workplace> = { remote: 'remote', hybrid: 'hybrid', 'on-site': 'onsite' }

function workplaceOf(job: Record<string, unknown>): Workplace {
  const data = (job.workArrangements as { data?: unknown } | undefined)?.data
  const labels = Array.isArray(data) ? data.map((item) => text((item as { label?: { text?: unknown } })?.label?.text).toLowerCase()) : []
  return labels.map((label) => WORKPLACE[label]).find((place) => place !== undefined) ?? 'unknown'
}

function contractOf(types: unknown): string {
  const first = Array.isArray(types) ? text(types[0]) : ''
  if (/full/i.test(first)) return 'Full-time'
  if (/part|casual/i.test(first)) return 'Part-time'
  if (/contract|temp/i.test(first)) return 'Contract'
  if (/intern/i.test(first)) return 'Internship'
  return first
}

// The country goes on the end ("South Jakarta, Jakarta, Indonesia") so a remote job open to the country is seen as such.
function locationOf(job: Record<string, unknown>, site: JobStreetSite): string {
  const label = Array.isArray(job.locations) ? text((job.locations[0] as { label?: unknown } | undefined)?.label) : ''
  if (label === '') return site.country
  return label.toLowerCase().includes(site.country.toLowerCase()) ? label : `${label}, ${site.country}`
}

export function parseJobStreet(body: unknown, site: JobStreetSite): RawJob[] {
  return asArray((body as { data?: unknown } | null)?.data).flatMap((job) => {
    const id = text(job.id)
    const title = text(job.title)
    if (id === '' || title === '') return []
    const bullets = Array.isArray(job.bulletPoints) ? job.bulletPoints.map(text).filter(Boolean) : []
    return [
      {
        ...emptyJob('jobstreet'),
        title,
        company: text((job.advertiser as { description?: unknown } | undefined)?.description) || text(job.companyName),
        location: locationOf(job, site),
        workplace: workplaceOf(job),
        contract: contractOf(job.workTypes),
        salary: text(job.salaryLabel).replace(/ /g, ' '),
        postedAt: dateOnly(job.listingDate),
        url: `https://${site.host}/job/${id}`,
        description: truncateText([...bullets, text(job.teaser)].filter(Boolean).join('\n'), DESCRIPTION_LIMIT),
        logoUrl: text((job.branding as { serpLogoUrl?: unknown } | undefined)?.serpLogoUrl),
      },
    ]
  })
}

export const jobStreetSource: JobSource = {
  id: 'jobstreet',
  async fetch(prefs, ctx) {
    // Best match from the last two weeks, one search per wanted role (at most three), per country. Newest first
    // instead pulls any job with one shared word ("Civil Engineer" for "Frontend Engineer").
    const keywords = prefs.roles.length > 0 ? prefs.roles.slice(0, 3) : ['software engineer']
    const searches = jobStreetSites(prefs.locations).flatMap((site) => keywords.map((keyword) => ({ site, url: jobStreetUrl(site, keyword) })))
    const siteOf = new Map(searches.map((search) => [search.url, search.site]))
    const jobs = await collectPages(ctx, [...siteOf.keys()], async (url) => parseJobStreet(await fetchJson(ctx, url), siteOf.get(url) as JobStreetSite))
    // Two role searches often return the same job.
    return [...new Map(jobs.map((job) => [job.url, job])).values()]
  },
}
