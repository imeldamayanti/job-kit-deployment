import { truncateText } from '../text'
import type { RawJob, Workplace } from '../types'
import { DESCRIPTION_LIMIT, emptyJob } from './shared'

export type ThreadPostMeta = { url: string; postedAt?: string }

// Words that mark the start of the role in a hiring post ("We're hiring: X", "Lowongan: X").
const ROLE_CUE = /\b(?:hiring|lowongan(?: kerja)?|loker|dicari|mencari|looking for|open position|vacancy)\b\s*[:\-–—]?\s*(.+)/i
// "loker remote di luar negeri" is talk about jobs, not a role: a title made only of these words is no title.
const NOT_A_ROLE = /^(?:(?:remote|wfh|wfo|hybrid|job|jobs|kerja|part[- ]?time|full[- ]?time)\s*)+$/i
// Where the role name stops: a dash with spaces, a bracket, a comma, a sentence end, "at/di X", a work-mode word or an emoji.
const ROLE_END = /\s+[—–-]\s+|\s*[(|,;!?]|\.(?=\s|$)|\s+(?:at|di|in|untuk|for)\s+|\s+(?:on-?site|remote|hybrid|wfo|wfh)\b|[\n\p{Extended_Pictographic}]/iu
const NAME = "[A-Z][\\w&.'-]*(?: [A-Z][\\w&.'-]*){0,3}"
const COMPANY_BEFORE = new RegExp(`(${NAME}) (?:is|are) hiring`)
const COMPANY_AFTER = new RegExp(`\\s(?:at|di|@)\\s+(${NAME})`)
const NOT_COMPANY = /^(we|kami|our|us|i|saya)$/i
const LOCATION_LINE = /(?:lokasi|location)\s*:\s*(.+)/i
const LOCATION_INLINE = /\b(?:[Ii]n|[Dd]i)\s+([A-Z][A-Za-z]+(?:,? [A-Z][A-Za-z]+)*)/
// Hashtags that name the field, the city or the board rather than the employer.
const GENERIC_TAG = /job|lowongan|loker|kerja|karir|career|hiring|vacanc|rekrut|developer|engineer|designer|analyst|manager|intern|magang|remote|wfh|wfo|hybrid|indonesia|startup|tech/i
const HASHTAG_LINE = /^(?:#[\p{L}\p{N}_]+\s*)+$/u

const CONTRACTS: [RegExp, string][] = [
  [/\bfull[- ]?time\b/i, 'Full-time'],
  [/\bpart[- ]?time\b/i, 'Part-time'],
  [/\bcontract\b|\bkontrak\b/i, 'Contract'],
  [/\bfreelance\b/i, 'Freelance'],
  [/\bintern(?:ship)?\b|\bmagang\b/i, 'Internship'],
]

function workplaceOf(text: string): Workplace {
  if (/\bhybrid\b/i.test(text)) return 'hybrid'
  if (/\bon-?site\b|\bwfo\b|work from office|di kantor/i.test(text)) return 'onsite'
  if (/\bremote\b|\bwfh\b|work from home/i.test(text)) return 'remote'
  return 'unknown'
}

const splitCamel = (tag: string) => tag.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')

function titleOf(body: string): { title: string; line: string } | null {
  const cue = ROLE_CUE.exec(body)
  if (!cue?.[1]) return null
  const rest = cue[1]
  const title = rest.split(ROLE_END)[0]?.trim().replace(/[\s:.\-–—]+$/, '') ?? ''
  if (title.length < 3 || title.length > 70 || title.split(/\s+/).length > 8 || NOT_A_ROLE.test(title)) return null
  return { title, line: rest.split('\n')[0] ?? rest }
}

function companyOf(body: string, line: string, tags: string[], title: string, location: string): string {
  const named = COMPANY_BEFORE.exec(body)?.[1]
  if (named && !NOT_COMPANY.test(named)) return named
  const after = COMPANY_AFTER.exec(line)?.[1]
  if (after) return after
  const squashed = title.toLowerCase().replace(/[^a-z\d]/g, '')
  const place = location.toLowerCase()
  const tag = tags.filter((t) => !GENERIC_TAG.test(t) && t.toLowerCase() !== squashed && !(place !== '' && place.includes(t.toLowerCase()))).pop()
  return tag ? splitCamel(tag) : ''
}

// One hiring post becomes at most one job. Posts that list several roles are not split yet.
export function parseThreadPost(raw: string, meta: ThreadPostMeta): RawJob[] {
  // NFKC turns the styled "𝘪𝘵𝘢𝘭𝘪𝘤" letters that posts use for flair back into plain ones.
  const normalized = raw.normalize('NFKC')
  const tags = [...normalized.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1] ?? '')
  const lines = normalized.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !HASHTAG_LINE.test(l))
  const body = lines.join('\n')

  const found = titleOf(body)
  if (!found) return []

  const location = (LOCATION_LINE.exec(body)?.[1] ?? LOCATION_INLINE.exec(found.line)?.[1] ?? '').trim()
  return [
    {
      ...emptyJob('thread'),
      title: found.title,
      company: companyOf(body, found.line, tags, found.title, location),
      location,
      workplace: workplaceOf(body),
      contract: CONTRACTS.find(([pattern]) => pattern.test(body))?.[1] ?? '',
      postedAt: meta.postedAt ?? '',
      url: meta.url,
      description: truncateText(body, DESCRIPTION_LIMIT),
    },
  ]
}
