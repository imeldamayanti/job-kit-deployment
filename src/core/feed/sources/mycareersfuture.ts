import type { RawJob, Workplace } from '../types'
import { fetchJson } from './http'
import { asArray, collectPages, describe, emptyJob, text } from './shared'
import type { JobSource } from './types'

// The Singapore government job board. Its public API needs no login and answers JSON; nearly every job is on-site in Singapore.
export const mcfUrl = (keyword: string) =>
  `https://api.mycareersfuture.gov.sg/v2/jobs?search=${encodeURIComponent(keyword)}&limit=30&page=0&sortBy=new_posting_date`

type Named = Record<string, unknown> | null | undefined

const PERIOD: Record<string, string> = { Monthly: 'per month', Annually: 'per year', Hourly: 'per hour', Daily: 'per day' }

function salaryOf(job: Record<string, unknown>): string {
  const meta = job.metadata as Named
  const salary = job.salary as Named
  if (meta?.isHideSalary === true || !salary) return ''
  const min = typeof salary.minimum === 'number' ? salary.minimum : 0
  const max = typeof salary.maximum === 'number' ? salary.maximum : 0
  if (min <= 0 && max <= 0) return ''
  const money = (n: number) => `S$${n.toLocaleString('en-US')}`
  const range = max > min ? `${money(min)} – ${money(max)}` : money(Math.max(min, max))
  const period = PERIOD[text((salary.type as Named)?.salaryType)]
  return period ? `${range} ${period}` : range
}

function contractOf(types: unknown): string {
  const names = Array.isArray(types) ? types.map((type) => text((type as Named)?.employmentType)) : []
  if (names.some((name) => /full time|permanent/i.test(name))) return 'Full-time'
  if (names.some((name) => /contract|temporary/i.test(name))) return 'Contract'
  if (names.some((name) => /part time/i.test(name))) return 'Part-time'
  if (names.some((name) => /intern|attachment/i.test(name))) return 'Internship'
  if (names.some((name) => /freelance/i.test(name))) return 'Freelance'
  return names[0] ?? ''
}

// The board has no remote flag. A flexible arrangement that mentions home or remote work is taken as hybrid; the rest is on-site.
function workplaceOf(job: Record<string, unknown>): Workplace {
  const flexible = Array.isArray(job.flexibleWorkArrangements) ? JSON.stringify(job.flexibleWorkArrangements) : ''
  return /remote|home/i.test(flexible) ? 'hybrid' : 'onsite'
}

function locationOf(job: Record<string, unknown>): string {
  const address = job.address as Named
  if (address?.isOverseas === true) return text(address.overseasCountry) || 'Overseas'
  return 'Singapore'
}

export function parseMcf(body: unknown): RawJob[] {
  return asArray((body as { results?: unknown } | null)?.results).flatMap((job) => {
    const title = text(job.title)
    const meta = job.metadata as Named
    const uuid = text(job.uuid)
    if (title === '' || uuid === '') return []
    const years = typeof job.minimumYearsExperience === 'number' ? job.minimumYearsExperience : 0
    const levels = Array.isArray(job.positionLevels) ? job.positionLevels : []
    return [
      {
        ...emptyJob('mycareersfuture'),
        title,
        company: text((job.hiringCompany as Named)?.name) || text((job.postedCompany as Named)?.name),
        location: locationOf(job),
        workplace: workplaceOf(job),
        contract: contractOf(job.employmentTypes),
        level: text((levels[0] as Named)?.position),
        salary: salaryOf(job),
        experience: years > 0 ? `${years}+ years` : '',
        postedAt: text(meta?.newPostingDate),
        deadline: text(meta?.expiryDate),
        url: text(meta?.jobDetailsUrl) || `https://www.mycareersfuture.gov.sg/job/${uuid}`,
        description: describe(job.description),
        logoUrl: text((job.postedCompany as Named)?.logoUploadPath),
      },
    ]
  })
}

export const mcfSource: JobSource = {
  id: 'mycareersfuture',
  async fetch(prefs, ctx) {
    // Newest first, one search per wanted role (at most three).
    const keywords = prefs.roles.length > 0 ? prefs.roles.slice(0, 3) : ['software engineer']
    const jobs = await collectPages(ctx, keywords.map(mcfUrl), async (url) => parseMcf(await fetchJson(ctx, url)))
    return [...new Map(jobs.map((job) => [job.url, job])).values()]
  },
}
