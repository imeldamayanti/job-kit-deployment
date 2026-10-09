import {
  CONTACT_KEYS,
  PERSONAL_KEYS,
  type Education,
  type Experience,
  type Profile,
} from '../profile/types'
import type { DataEvent, ImportChange, ImportErrorReason, ImportMode } from './state'

export type ParsedImport = { ok: true; profile: Profile } | { ok: false; reason: ImportErrorReason; detail: string }

type Loose = Record<string, unknown>

function isRecord(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function records(value: unknown): Loose[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function pick<K extends string>(keys: readonly K[], raw: unknown): Record<K, string> {
  const source = isRecord(raw) ? raw : {}
  return Object.fromEntries(keys.map((key) => [key, text(source[key])])) as Record<K, string>
}

const SKILL_GROUPS = ['teknis', 'bahasa', 'lainnya'] as const

// Keeps only what this version knows; anything missing becomes empty.
function normalizeProfile(raw: Loose): Profile {
  return {
    version: 1,
    personal: pick(PERSONAL_KEYS, raw.personal),
    contact: pick(CONTACT_KEYS, raw.contact),
    education: records(raw.education).map((item, index) => ({
      id: text(item.id) || `import-edu-${index + 1}`,
      institution: text(item.institution),
      level: text(item.level),
      major: text(item.major),
      gpa: text(item.gpa),
      year: text(item.year),
    })),
    experience: records(raw.experience).map((item, index) => ({
      id: text(item.id) || `import-exp-${index + 1}`,
      company: text(item.company),
      title: text(item.title),
      start: text(item.start),
      end: text(item.end),
      current: item.current === true,
      description: text(item.description),
    })),
    skills: records(raw.skills).map((item) => ({
      group: SKILL_GROUPS.find((group) => group === item.group) ?? 'lainnya',
      name: text(item.name),
    })),
    custom: records(raw.custom).map((item, index) => ({
      id: text(item.id) || `import-custom-${index + 1}`,
      key: text(item.key),
      value: text(item.value),
    })),
  }
}

export function parseImport(source: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    return { ok: false, reason: 'not-json', detail: '' }
  }
  if (!isRecord(data) || data.app !== 'job-kit' || !isRecord(data.profile)) {
    return { ok: false, reason: 'wrong-shape', detail: '' }
  }
  if (data.version !== 1) {
    return { ok: false, reason: 'unknown-version', detail: String(data.version) }
  }
  return { ok: true, profile: normalizeProfile(data.profile) }
}

const norm = (value: string) => value.trim().toLowerCase()
const educationKey = (e: Education) => [e.institution, e.level, e.major, e.year].map(norm).join('|')
const experienceKey = (e: Experience) => [e.company, e.title, e.start, e.end].map(norm).join('|')
const skillKey = (s: Profile['skills'][number]) => `${s.group}|${norm(s.name)}`
const customKey = (c: Profile['custom'][number]) => norm(c.key)

function freeId(id: string, taken: Set<string>): string {
  let candidate = id
  for (let n = 2; taken.has(candidate); n += 1) candidate = `${id}-${n}`
  taken.add(candidate)
  return candidate
}

// Incoming items whose key is not in `current` yet (and not repeated within `incoming`).
function newItems<T>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  const keys = new Set(current.map(keyOf))
  return incoming.filter((item) => {
    const key = keyOf(item)
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
}

function appendNew<T>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  return [...current, ...newItems(current, incoming, keyOf)]
}

// Same as appendNew, but an incoming id that is already taken gets a new one.
function appendNewWithId<T extends { id: string }>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  const taken = new Set(current.map((item) => item.id))
  const added = newItems(current, incoming, keyOf).map((item) => ({ ...item, id: freeId(item.id, taken) }))
  return [...current, ...added]
}

function fillEmpty<K extends string>(current: Record<K, string>, incoming: Record<K, string>): Record<K, string> {
  const result = { ...current }
  for (const key of Object.keys(incoming) as K[]) {
    if (current[key].trim() === '') result[key] = incoming[key]
  }
  return result
}

// Merge only adds: filled fields stay, existing entries stay, nothing is removed.
export function mergeProfile(current: Profile, incoming: Profile): Profile {
  return {
    version: 1,
    personal: fillEmpty(current.personal, incoming.personal),
    contact: fillEmpty(current.contact, incoming.contact),
    education: appendNewWithId(current.education, incoming.education, educationKey),
    experience: appendNewWithId(current.experience, incoming.experience, experienceKey),
    skills: appendNew(current.skills, incoming.skills, skillKey),
    custom: appendNewWithId(current.custom, incoming.custom, customKey),
  }
}

export function applyImport(current: Profile, incoming: Profile, mode: ImportMode): Profile {
  return mode === 'replace' ? incoming : mergeProfile(current, incoming)
}

const withoutId = (items: object[]) =>
  JSON.stringify(items.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id'))))
const filledCount = (record: Record<string, string>) => Object.values(record).filter((v) => v.trim() !== '').length
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function diffImport(current: Profile, incoming: Profile, mode: ImportMode): ImportChange[] {
  const next = applyImport(current, incoming, mode)
  const changes: ImportChange[] = []
  const add = (label: string, changed: boolean, before: string, after: string) => {
    if (changed) changes.push({ label, before, after })
  }

  add('Personal Info', !same(current.personal, next.personal), `${filledCount(current.personal)} field`, `${filledCount(next.personal)} field`)
  add('Contact & Address', !same(current.contact, next.contact), `${filledCount(current.contact)} field`, `${filledCount(next.contact)} field`)
  add('Education', withoutId(current.education) !== withoutId(next.education), `${current.education.length} entri`, `${next.education.length} entri`)
  add('Work Experience', withoutId(current.experience) !== withoutId(next.experience), `${current.experience.length} entri`, `${next.experience.length} entri`)
  add('Skill', withoutId(current.skills) !== withoutId(next.skills), `${current.skills.length} skill`, `${next.skills.length} skill`)
  add('Custom Field', withoutId(current.custom) !== withoutId(next.custom), `${current.custom.length} field`, `${next.custom.length} field`)
  return changes
}

function changedFields(before: Record<string, string>, after: Record<string, string>): number {
  return Object.keys(after).filter((key) => (after[key] ?? '').trim() !== '' && after[key] !== before[key]).length
}

function addedEntries<T>(before: T[], after: T[], keyOf: (item: T) => string): number {
  const known = new Set(before.map(keyOf))
  return after.filter((item) => !known.has(keyOf(item))).length
}

// The numbers shown on the "done" screen after an import.
export function summarizeImport(before: Profile, after: Profile): { title: string; detail: string } {
  const fields = changedFields(before.personal, after.personal) + changedFields(before.contact, after.contact)
  const lists: [number, string][] = [
    [addedEntries(before.education, after.education, educationKey), 'pendidikan'],
    [addedEntries(before.experience, after.experience, experienceKey), 'pengalaman'],
    [addedEntries(before.skills, after.skills, skillKey), 'skill'],
    [addedEntries(before.custom, after.custom, customKey), 'custom field'],
  ]
  const added = lists.filter(([count]) => count > 0)
  const total = fields + added.reduce((sum, [count]) => sum + count, 0)
  const parts: string[] = []
  if (fields > 0) parts.push(`${fields} field terisi`)
  if (added.length > 0) parts.push(`${added.map(([count, name]) => `${count} ${name}`).join(', ')} ditambah.`)
  return {
    title: `${total} entri diimpor`,
    detail: total === 0 ? 'Profil sudah sama dengan isi berkas.' : parts.join(' · '),
  }
}

// What the Data page should do after reading a chosen file: preview it, or say why it was refused.
export function eventForImportFile(
  file: { name: string; size: number },
  content: string,
  current: Profile,
): Extract<DataEvent, { type: 'preview-import' | 'reject-import' }> {
  const parsed = parseImport(content)
  if (!parsed.ok) {
    return { type: 'reject-import', fileName: file.name, reason: parsed.reason, detail: parsed.detail }
  }
  return {
    type: 'preview-import',
    fileName: file.name,
    fileSize: file.size,
    profile: parsed.profile,
    changes: {
      merge: diffImport(current, parsed.profile, 'merge'),
      replace: diffImport(current, parsed.profile, 'replace'),
    },
  }
}
