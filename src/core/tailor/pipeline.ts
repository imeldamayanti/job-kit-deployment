import type { Application, TailoredCv } from '../applications/types'
import { AiError, aiErrorMessage, type AiFailure } from '../ai/errors'
import type { AiUsage, ScoringClient } from '../ai/score'
import type { Profile } from '../profile/types'
import { coverage } from './coverage'
import { assemble, validateGrounded, violationMessage } from './grounded'
import { profileHash } from './hash'
import { parseOutput } from './parse'
import { pseudonymize } from './privacy'
import { CV_SYSTEM, cvUserPrompt } from './prompt'
import type { Violation } from './types'

export type TailorInput = {
  profile: Profile
  application: Application
  client: ScoringClient
  key: string
  model: string
  now: Date
  newId: () => string
  maxTokens?: number
}

export const NO_TOKENS: AiUsage = { inputTokens: 0, outputTokens: 0 }
const MAX_SHOWN = 3

// What the person reads when a CV or letter is refused: the first few reasons, and how many more there were.
export function ungroundedMessage(violations: Violation[]): string {
  const shown = violations.slice(0, MAX_SHOWN).map(violationMessage).join(' ')
  const more = violations.length > MAX_SHOWN ? ` Dan ${violations.length - MAX_SHOWN} lainnya.` : ''
  return `Hasil AI ditolak karena memuat hal yang tidak ada di Profile-mu. ${shown}${more}`
}

// A failure leaves no CV behind (PRD §8): the caller keeps the earlier one and shows `message`.
export type TailorFailure = {
  ok: false
  reason: 'no-text' | 'ai' | 'unreadable' | 'ungrounded'
  message: string
  usage: AiUsage
  ai?: AiFailure
  violations?: Violation[]
}
export type TailorSuccess = { ok: true; cv: TailoredCv; usage: AiUsage; fallback: boolean }

// Buat CV (RFC §3.3c): payload without identity → one AI call → read the shape → put the real names back →
// reject what the Profile does not support → coverage → CV. Only the AI's wording is kept; titles, companies, schools
// and dates come from the Profile.
export async function tailorCv({ profile, application, client, key, model, now, newId, maxTokens = 3000 }: TailorInput): Promise<TailorSuccess | TailorFailure> {
  const { title, description } = application.job
  if (description.trim() === '') return { ok: false, reason: 'no-text', message: 'Tempel teks lowongan dulu.', usage: NO_TOKENS }

  const hidden = pseudonymize(profile)
  let reply
  try {
    reply = await client.complete({ key, model, system: CV_SYSTEM, user: cvUserPrompt({ title, description }, hidden.payload), maxTokens })
  } catch (error) {
    const ai = error instanceof AiError ? error.reason : 'network'
    return { ok: false, reason: 'ai', ai, message: aiErrorMessage(ai), usage: NO_TOKENS }
  }
  const usage = reply.usage

  const parsed = parseOutput(reply.text)
  if (!parsed.ok) return { ok: false, reason: 'unreadable', message: parsed.reason, usage }

  const output = hidden.restoreOutput(parsed.output)
  const grounding = validateGrounded(output, profile)
  if (!grounding.ok) {
    return { ok: false, reason: 'ungrounded', message: ungroundedMessage(grounding.violations), usage, violations: grounding.violations }
  }

  // What the AI left empty is filled from the Profile as written, so a weak answer never gives an empty CV (T45).
  const doc = assemble(profile, output)
  const parts = { skills: doc.skills, experience: doc.experience.map((e) => ({ sourceId: e.sourceId, bullets: e.bullets })), education: doc.education.map((e) => e.id) }
  const fallback = output.experience.length === 0 || output.experience.some((e) => e.bullets.every((b) => b.trim() === ''))
  const cv: TailoredCv = {
    id: newId(),
    applicationId: application.id,
    createdAt: now.toISOString(),
    profileHash: profileHash(profile),
    coverage: coverage(parsed.requirements, doc, parsed.claimed),
    edited: false,
    ...parts,
    aiVersion: structuredClone(parts),
  }
  return { ok: true, cv, usage, fallback }
}
