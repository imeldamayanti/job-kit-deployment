import { JOB_LEVELS, type JobLevel } from '../profile/job-preferences'
import type { Profile } from '../profile/types'
import { hasWord } from './rules'
import type { JobScore, RawJob } from './types'

const DAY = 24 * 60 * 60 * 1000
const YEAR = 365.25 * DAY

function monthOf(value: string): number | null {
  const match = /^(\d{4})(?:-(\d{1,2}))?/.exec(value.trim())
  if (!match) return null
  return Date.UTC(Number(match[1]), match[2] ? Number(match[2]) - 1 : 0, 1)
}

export function yearsOfExperience(profile: Profile, now: Date): number {
  let total = 0
  for (const entry of profile.experience) {
    const start = monthOf(entry.start)
    const end = entry.current ? now.getTime() : monthOf(entry.end)
    if (start !== null && end !== null && end > start) total += (end - start) / YEAR
  }
  return total
}

function levelFromYears(years: number): JobLevel {
  if (years < 2) return 'Junior'
  if (years < 5) return 'Mid'
  if (years < 8) return 'Senior'
  return 'Lead'
}

function levelOfJob(job: RawJob): JobLevel | null {
  const text = `${job.level} ${job.title}`
  if (/\b(lead|manager|head|director|principal)\b/i.test(text)) return 'Lead'
  if (/\b(senior|sr|staff)\b/i.test(text)) return 'Senior'
  if (/\b(junior|jr|entry|fresh\w*|intern\w*)\b/i.test(text)) return 'Junior'
  if (/\b(mid|middle|intermediate)\b/i.test(text)) return 'Mid'
  return null
}

function roleFit(job: RawJob, roles: string[]): number {
  if (roles.length === 0) return 0.5
  const title = job.title.toLowerCase()
  return Math.max(
    ...roles.map((role) => {
      if (title.includes(role.toLowerCase())) return 1
      const parts = role.toLowerCase().split(/\s+/).filter((part) => part.length > 2)
      return parts.length === 0 ? 0 : parts.filter((part) => title.includes(part)).length / parts.length
    }),
  )
}

function recencyFit(postedAt: string, now: Date): number {
  const posted = Date.parse(postedAt)
  if (Number.isNaN(posted)) return 0.5
  const days = (now.getTime() - posted) / DAY
  if (days <= 3) return 1
  if (days >= 60) return 0
  return 1 - (days - 3) / 57
}

// A score from rules alone, shown as "Skor kasar" when the AI cannot be used (FR-29).
export function roughScore(job: RawJob, profile: Profile, now: Date): JobScore {
  const prefs = profile.jobPrefs
  const text = `${job.title}\n${job.description}`
  const matches: string[] = []
  const gaps: string[] = []

  const role = roleFit(job, prefs.roles)
  if (prefs.roles.length > 0) (role >= 0.5 ? matches : gaps).push(role >= 0.5 ? `Role cocok: ${job.title}` : `Judul tidak mirip role incaran`)

  const skillHits = profile.skills.map((skill) => skill.name).filter((name) => name.trim() !== '' && hasWord(text, name))
  skillHits.forEach((name) => matches.push(`Skill ada di lowongan: ${name}`))
  const mustHits = prefs.mustHave.filter((word) => hasWord(text, word))
  mustHits.forEach((word) => matches.push(`Memuat kata kunci wajib: ${word}`))
  prefs.mustHave.filter((word) => !mustHits.includes(word)).forEach((word) => gaps.push(`Tidak memuat: ${word}`))

  const skillFit = Math.min(1, skillHits.length / 3)
  const hasTerms = prefs.mustHave.length > 0 || profile.skills.length > 0
  const termsFit = !hasTerms ? 0.5 : prefs.mustHave.length > 0 ? 0.6 * (mustHits.length / prefs.mustHave.length) + 0.4 * skillFit : skillFit

  const target = prefs.level || (profile.experience.length > 0 ? levelFromYears(yearsOfExperience(profile, now)) : null)
  const theirs = levelOfJob(job)
  let levelFit = 0.5
  if (target && theirs) {
    const gap = Math.abs(JOB_LEVELS.indexOf(target) - JOB_LEVELS.indexOf(theirs))
    levelFit = gap === 0 ? 1 : gap === 1 ? 0.5 : 0
    ;(gap <= 1 ? matches : gaps).push(gap === 0 ? `Level ${theirs} sesuai` : `Level ${theirs}, targetmu ${target}`)
  }

  const value = Math.round(role * 35 + termsFit * 30 + levelFit * 20 + recencyFit(job.postedAt, now) * 15)
  const summary =
    matches.length === 0 && gaps.length === 0
      ? 'Dinilai dari aturan; data profil atau lowongan terlalu sedikit.'
      : `Dinilai dari aturan. ${matches.length > 0 ? `Cocok: ${matches.length} hal.` : ''} ${gaps.length > 0 ? `Kurang: ${gaps.length} hal.` : ''}`.replace(/\s+/g, ' ').trim()
  return { value, matches, gaps, summary, rough: true, inputHash: '' }
}
