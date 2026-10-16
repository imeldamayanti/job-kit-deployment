import { AiError, aiErrorMessage } from '../ai/errors'
import type { ScoringClient } from '../ai/score'
import type { Application, CoverLetter } from '../applications/types'
import type { Profile } from '../profile/types'
import { profileHash } from '../tailor/hash'
import { NO_TOKENS, ungroundedMessage, type TailorFailure } from '../tailor/pipeline'
import { pseudonymize } from '../tailor/privacy'
import { finishLetter, withoutSignOff } from './closing'
import { validateLetter } from './grounded'
import { postingLanguage, type Lang, type Tone } from './language'
import { parseLetter } from './parse'
import { letterSystem, letterUserPrompt } from './prompt'

export type LetterInput = {
  profile: Profile
  application: Application
  // Chosen by the person; absent: the language of the posting, formal.
  lang?: Lang
  tone?: Tone
  client: ScoringClient
  key: string
  model: string
  now: Date
  newId: () => string
  maxTokens?: number
}

export type LetterSuccess = { ok: true; letter: CoverLetter; usage: Awaited<ReturnType<ScoringClient['complete']>>['usage'] }
export type LetterFailure = TailorFailure

// Buat surat (FR-43): the same chain as the CV with one answer to check, the letter. Payload without identity → one call
// → read the shape → put the real names back → reject what the Profile does not support → add the closing and the name.
export async function writeLetter({ profile, application, lang, tone = 'formal', client, key, model, now, newId, maxTokens = 2000 }: LetterInput): Promise<LetterSuccess | LetterFailure> {
  const job = application.job
  if (job.description.trim() === '') return { ok: false, reason: 'no-text', message: 'Tempel teks lowongan dulu.', usage: NO_TOKENS }
  const language = lang ?? postingLanguage(job)

  const hidden = pseudonymize(profile)
  let reply
  try {
    reply = await client.complete({
      key, model, system: letterSystem(language, tone), user: letterUserPrompt(job, hidden.payload), maxTokens,
    })
  } catch (error) {
    const ai = error instanceof AiError ? error.reason : 'network'
    return { ok: false, reason: 'ai', ai, message: aiErrorMessage(ai), usage: NO_TOKENS }
  }
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
