import type { ScoringClient } from '../ai/score'
import type { Application, CoverLetter } from '../applications/types'
import type { Profile } from '../profile/types'
import { profileHash } from '../tailor/hash'
import { NO_TOKENS, askForDocument, ungroundedMessage, type AiSource, type TailorFailure } from '../tailor/pipeline'
import { pseudonymize } from '../tailor/privacy'
import { finishLetter, withoutSignOff } from './closing'
import { validateLetter } from './grounded'
import { LETTER_LANG, type Lang, type Tone } from './language'
import { parseLetter } from './parse'
import { letterSystem, letterUserPrompt } from './prompt'

export type LetterInput = {
  profile: Profile
  application: Application
  // Chosen by the person; absent: the language of the posting, formal.
  lang?: Lang
  tone?: Tone
  now: Date
  newId: () => string
  maxTokens?: number
} & AiSource

export type LetterSuccess = { ok: true; letter: CoverLetter; usage: Awaited<ReturnType<ScoringClient['complete']>>['usage'] }
export type LetterFailure = TailorFailure

// Buat surat (FR-43): the same chain as the CV with one answer to check, the letter. Payload without identity → one call
// → read the shape → put the real names back → reject what the Profile does not support → add the closing and the name.
export async function writeLetter(input: LetterInput): Promise<LetterSuccess | LetterFailure> {
  const { profile, application, lang, tone = 'formal', now, newId, maxTokens = 2000 } = input
  const job = application.job
  if (job.description.trim() === '') return { ok: false, reason: 'no-text', message: 'Tempel teks lowongan dulu.', usage: NO_TOKENS }
  const language = lang ?? LETTER_LANG

  const hidden = pseudonymize(profile)
  const reply = await askForDocument(
    input,
    { system: letterSystem(language, tone), user: letterUserPrompt(job, hidden.payload), maxTokens },
    { kind: 'letter', job: { title: job.title, company: job.company, description: job.description }, payload: hidden.payload, lang: language, tone },
  )
  if (!reply.ok) return reply.failure
  const usage = reply.usage

  const parsed = parseLetter(reply.text)
  if (!parsed.ok) return { ok: false, reason: 'unreadable', message: parsed.reason, usage }

  // Cut the model's own sign-off first: a name or "{NAMA}" under it is not a claim, and job-kit writes the closing itself.
  const restored = withoutSignOff(hidden.restore(parsed.body))
  const grounding = validateLetter(restored, profile, job)
  if (!grounding.ok) return { ok: false, reason: 'ungrounded', message: ungroundedMessage(grounding.violations), usage, violations: grounding.violations }

  const body = finishLetter(restored, profile, language, tone)
  return {
    ok: true,
    usage,
    letter: { id: newId(), applicationId: application.id, createdAt: now.toISOString(), profileHash: profileHash(profile), lang: language, tone, body, aiBody: body, edited: false },
  }
}
