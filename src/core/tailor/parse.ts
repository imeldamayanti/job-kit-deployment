import type { TailorOutput } from './types'

// `claimed` is what the model says the Profile covers: a claim, kept apart because nothing can check it (coverage.ts).
export type ParsedAnswer = { ok: true; requirements: string[]; claimed: string[]; output: TailorOutput } | { ok: false; reason: string }

const MAX_REQUIREMENTS = 8
const NOT_JSON = 'Jawaban penyedia bukan JSON.'
const wrongShape = (part: string) => `Jawaban penyedia tidak berbentuk CV: ${part}.`

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string')

export function readJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start === -1 || end <= start) return undefined
    try {
      return JSON.parse(clean.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
}

// Checks the shape only (T48); whether the facts are true is validateGrounded's job (T46). Keys the model adds are
// ignored, so a company or date it volunteers can never reach the CV (RFC D12). A wrong shape is refused, never repaired.
export function parseOutput(text: string): ParsedAnswer {
  const data = readJson(text)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: NOT_JSON }
  const row = data as Record<string, unknown>

  if (!isStrings(row.requirements)) return { ok: false, reason: wrongShape('requirements') }
  if (!isStrings(row.skills)) return { ok: false, reason: wrongShape('skills') }
  if (!isStrings(row.education)) return { ok: false, reason: wrongShape('education') }
  if (!Array.isArray(row.experience)) return { ok: false, reason: wrongShape('experience') }
  const experience: TailorOutput['experience'] = []
  for (const item of row.experience) {
    const entry = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null
    if (!entry || typeof entry.sourceId !== 'string' || !isStrings(entry.bullets)) return { ok: false, reason: wrongShape('experience') }
    experience.push({ sourceId: entry.sourceId, bullets: entry.bullets })
  }

  const requirements = row.requirements.map((r) => r.trim()).filter((r) => r !== '').slice(0, MAX_REQUIREMENTS)
  // Missing or malformed is no claim at all, not a bad answer: it only decides how many requirements read as covered.
  const claimed = Array.isArray(row.covered) ? row.covered.filter((c): c is string => typeof c === 'string' && c.trim() !== '').map((c) => c.trim()) : []
  return { ok: true, requirements, claimed, output: { skills: row.skills, experience, education: row.education } }
}
