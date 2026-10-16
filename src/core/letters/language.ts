import { detectLanguage, type Lang } from '../tailor/language'

export type { Lang }
export const TONES = ['formal', 'casual'] as const
export type Tone = (typeof TONES)[number]

export const LANG_LABEL: Record<Lang, string> = { id: 'Indonesia', en: 'English' }
export const TONE_LABEL: Record<Tone, string> = { formal: 'Formal', casual: 'Santai' }

// The letter is written in the language of the posting (FR-43). The title is only a fallback: job titles are
// English even in an Indonesian posting, so they must not outvote the text.
export function postingLanguage(job: { title: string; description: string }): Lang {
  return detectLanguage(job.description.trim() !== '' ? job.description : job.title)
}
