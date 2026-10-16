import type { Application } from '../applications/types'
import { zenMayTrainOn, type AiProvider } from '../feed/settings'
import type { Profile } from '../profile/types'
import type { TailorOutput } from './types'

// What leaves the browser for a CV or letter (PRD §4.2, FR-46, RFC D13): skills, the bullets of each experience,
// job titles, level and major. No name, email, phone, address, birth date, link or GPA. Employer and school names are
// replaced by codes ({C1}, {S1}) and put back here, after the answer returns.
export type CvPayload = {
  skills: string[]
  experience: { id: string; title: string; company: string; description: string }[]
  education: { id: string; institution: string; level: string; major: string }[]
}

export type Pseudonymized = {
  payload: CvPayload
  restore: (text: string) => string
  restoreOutput: (output: TailorOutput) => TailorOutput
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const bounded = (name: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu')

const COMPANY_PREFIX = /^(?:pt|cv|ud|pd)\.?\s+/i
const COMPANY_SUFFIX = /\s+(?:ltd|inc|llc|tbk|co|corp|gmbh|pte)\.?$/i
const SCHOOL_PREFIX = /^(?:universitas|institut|politeknik|sekolah tinggi|university|institute|polytechnic)\s+/i

// "PT Contoh Teknologi Tbk" also turns up as "Contoh Teknologi": every form a bullet may use for the same name.
function variants(name: string, prefix: RegExp, suffix?: RegExp): string[] {
  const forms = new Set([name])
  const bare = name.replace(prefix, '')
  const trimmed = suffix ? bare.replace(suffix, '') : bare
  for (const form of [bare, trimmed]) if (form.length >= 4) forms.add(form)
  return [...forms]
}

// Identity values that could sit inside a free-text bullet. The full name and long name parts go; a short first name
// that is also a word ("Made", "Dewi") stays, because removing it would cut the sentence for no gain.
function identityValues(profile: Profile): string[] {
  const { personal, contact } = profile
  const names = [personal.firstName, personal.middleName, personal.lastName].map((n) => n.trim()).filter((n) => n !== '')
  const full = [names.join(' '), [personal.firstName, personal.lastName].map((n) => n.trim()).filter((n) => n !== '').join(' ')]
  const parts = names.filter((n) => n.length >= 5)
  const others = [contact.email, contact.phone, contact.linkedin, contact.website, contact.street, personal.birthDate]
  return [...new Set([...full, ...parts, ...others].map((v) => v.trim()).filter((v) => v.length >= 3))].sort((a, b) => b.length - a.length)
}

const REDACTED = '[dihapus]'

export function pseudonymize(profile: Profile): Pseudonymized {
  const codes = new Map<string, string>() // code -> real name
  const byName = new Map<string, string>() // real name -> code
  const swaps: [string, string][] = [] // [form, code], longest form first once built
  const counters = { C: 0, S: 0 }
  const codeFor = (name: string, kind: 'C' | 'S'): string => {
    const known = byName.get(name)
    if (known) return known
    const code = `{${kind}${++counters[kind]}}`
    byName.set(name, code)
    codes.set(code, name)
    const forms = kind === 'C' ? variants(name, COMPANY_PREFIX, COMPANY_SUFFIX) : variants(name, SCHOOL_PREFIX)
    for (const form of forms) swaps.push([form, code])
    return code
  }

  const company = (name: string) => (name.trim() === '' ? '' : codeFor(name.trim(), 'C'))
  const institution = (name: string) => (name.trim() === '' ? '' : codeFor(name.trim(), 'S'))
  const companies = profile.experience.map((e) => company(e.company))
  const schools = profile.education.map((e) => institution(e.institution))

  const identity = identityValues(profile)
  swaps.sort((a, b) => b[0].length - a[0].length)
  const clean = (text: string): string => {
    let out = text
    for (const value of identity) out = out.replace(new RegExp(escapeRegExp(value), 'gi'), REDACTED)
    for (const [form, code] of swaps) out = out.replace(bounded(form), code)
    return out
  }

  const payload: CvPayload = {
    skills: [...new Set(profile.skills.map((s) => s.name.trim()).filter((n) => n !== ''))],
    experience: profile.experience.map((e, i) => ({ id: e.id, title: clean(e.title), company: companies[i] ?? '', description: clean(e.description) })),
    education: profile.education.map((e, i) => ({ id: e.id, institution: schools[i] ?? '', level: clean(e.level), major: clean(e.major) })),
  }

  // A code the model wrote in another case or with spaces is still read; one this run never issued stays as written,
  // and the fact checker then rejects it.
  const restore = (text: string): string =>
    text.replace(/\{\s*([CS])\s*(\d+)\s*\}/gi, (match, kind: string, n: string) => codes.get(`{${kind.toUpperCase()}${n}}`) ?? match)
  const restoreOutput = (output: TailorOutput): TailorOutput => ({
    skills: [...output.skills],
    experience: output.experience.map((item) => ({ sourceId: item.sourceId, bullets: item.bullets.map(restore) })),
    education: [...output.education],
  })
  return { payload, restore, restoreOutput }
}

// Models known to use what they receive for training (FR-46). Scoring jobs is not affected: it sends no experience text.
export type AiChoice = { provider: AiProvider; model: string }
export type TrainingNotice = { kind: 'zen' | 'gemini'; message: string }

const SENT = 'Yang dikirim: skill, butir pengalaman, dan teks lowongan. Nama, kontak, serta nama perusahaan dan kampusmu tidak dikirim.'

export function trainingNotice(ai: AiChoice): TrainingNotice | null {
  if (ai.provider === 'opencode-zen' && zenMayTrainOn(ai.model)) {
    return { kind: 'zen', message: `Model ${ai.model.trim()} di OpenCode Zen bisa memakai data untuk melatih. ${SENT} Lanjutkan, atau ganti model di Atur Lowongan.` }
  }
  // job-kit cannot tell whether a Gemini key is on the free tier, so the notice says what is true of that tier.
  if (ai.provider === 'gemini') {
    return { kind: 'gemini', message: `Bila kunci Gemini-mu tier gratis, Google dapat memakai isinya untuk memperbaiki produknya (tier berbayar tidak). ${SENT} Lanjutkan, atau ganti model di Atur Lowongan.` }
  }
  return null
}

const noticeKey = (ai: AiChoice) => `${ai.provider}:${ai.model.trim()}`

// Once per application: the person is asked before the first CV or letter, and again only if the model changes.
export const needsNotice = (app: Application, ai: AiChoice): boolean => trainingNotice(ai) !== null && app.aiNoticeAck !== noticeKey(ai)
export const acknowledgeNotice = (app: Application, ai: AiChoice): Application => (trainingNotice(ai) === null ? app : { ...app, aiNoticeAck: noticeKey(ai) })
