import { CV_LANG, type Lang } from '../tailor/language'

export type { Lang }
export const TONES = ['formal', 'casual'] as const
export type Tone = (typeof TONES)[number]

export const LANG_LABEL: Record<Lang, string> = { id: 'Indonesia', en: 'English' }
export const TONE_LABEL: Record<Tone, string> = { formal: 'Formal', casual: 'Santai' }

// The letter is English by default, like the CV, whatever language the posting is in. The person can still pick
// another language in the letter screen.
export const LETTER_LANG: Lang = CV_LANG
