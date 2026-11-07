import type { RawJob } from '../types'
import { fetchText } from './http'
import { asArray, collectPages, describe, emptyJob, text } from './shared'
import { SourceError, type JobSource } from './types'

const SITE = 'https://www.ycombinator.com'
const MAX_PAGES = 3

// The role pages Y Combinator has, and the words in a wanted role that point to each.
const ROLE_PAGES: [slug: string, words: RegExp][] = [
  ['product-manager', /product (manager|owner)|\bpm\b/i],
  ['designer', /design|\bux\b/i],
  ['recruiting-hr', /recruit|talent|\bhr\b|human resource/i],
  ['sales-manager', /\bsales\b|account (executive|manager)/i],
  ['marketing', /marketing|growth|content/i],
  ['support', /support|customer success/i],
  ['operations', /operations?\b/i],
  ['software-engineer', /engineer|develop|program|software|front-?end|back-?end|full-?stack|mobile|devops|\bqa\b|\bdata\b/i],
]

export function ycRoleSlugs(roles: string[]): string[] {
  if (roles.length === 0) return ['software-engineer']
  const slugs = new Set<string>()
  for (const role of roles) for (const [slug, words] of ROLE_PAGES) if (words.test(role)) slugs.add(slug)
  return [...slugs].slice(0, MAX_PAGES)
}

// "22 days", "about 8 months", "over 2 years": how long ago a posting went up, as the page words it.
export function relativeDate(value: string, now: Date): string {
  if (/less than/i.test(value)) return now.toISOString().slice(0, 10)
  const match = /(\d+)\s*(minute|hour|day|week|month|year)s?/i.exec(value)
  if (!match) return ''
  const amount = Number(match[1])
  const date = new Date(now)
  switch (match[2]?.toLowerCase()) {
    case 'minute': date.setUTCMinutes(date.getUTCMinutes() - amount); break
    case 'hour': date.setUTCHours(date.getUTCHours() - amount); break
    case 'day': date.setUTCDate(date.getUTCDate() - amount); break
    case 'week': date.setUTCDate(date.getUTCDate() - amount * 7); break
    case 'month': date.setUTCMonth(date.getUTCMonth() - amount); break
    default: date.setUTCFullYear(date.getUTCFullYear() - amount)
  }
  return date.toISOString().slice(0, 10)
}

// The page is a server-rendered app: its data sits in one attribute as JSON with HTML entities.
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function readPostings(page: string): Record<string, unknown>[] {
  const attribute = /data-page="([^"]*)"/.exec(page)?.[1]
  if (attribute === undefined) throw new SourceError('parse')
  let data: unknown
  try {
    data = JSON.parse(decodeEntities(attribute))
  } catch {
    throw new SourceError('parse')
  }
  return asArray(((data as { props?: { jobPostings?: unknown } } | null)?.props ?? {}).jobPostings)
}

function toJob(posting: Record<string, unknown>, now: Date): RawJob | null {
  // These ask for a US citizen or a US visa, which a candidate in Indonesia does not have.
  if (/citizen\/visa only/i.test(text(posting.visa))) return null
  const skills = Array.isArray(posting.skills) ? posting.skills.filter((skill): skill is string => typeof skill === 'string') : []
  const role = [text(posting.prettyRole), text(posting.roleSpecificType)].filter((part) => part !== '').join(' / ')
  return {
    ...emptyJob('yc'),
    title: text(posting.title),
    company: text(posting.companyName),
    location: text(posting.location),
    // The pages asked for are the remote ones, so a region named in the location is a limit on who may apply.
    workplace: 'remote',
    contract: text(posting.type),
    salary: text(posting.salaryRange),
    experience: text(posting.minExperience),
    postedAt: relativeDate(text(posting.createdAt), now),
    url: `${SITE}${text(posting.url)}`,
    // The list has no full description; what it has still tells the score what the job is about.
    description: describe(
      [text(posting.companyOneLiner), role && `Role: ${role}`, skills.length > 0 && `Skills: ${skills.join(', ')}`, text(posting.visa) && `Visa: ${text(posting.visa)}`]
        .filter((line): line is string => typeof line === 'string' && line !== '')
        .join('\n'),
    ),
    logoUrl: text(posting.companyLogoUrl),
  }
}

export const ycSource: JobSource = {
  id: 'yc',
  async fetch(prefs, ctx) {
    const urls = ycRoleSlugs(prefs.roles).map((slug) => `${SITE}/jobs/role/${slug}/remote`)
    const jobs = await collectPages(ctx, urls, async (url) =>
      readPostings(await fetchText(ctx, url)).flatMap((posting) => toJob(posting, ctx.now) ?? []),
    )
    return [...new Map(jobs.map((job) => [job.url, job])).values()]
  },
}
