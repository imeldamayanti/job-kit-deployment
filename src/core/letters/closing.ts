import type { Profile } from '../profile/types'
import type { Lang, Tone } from './language'

const CLOSING: Record<Lang, Record<Tone, string>> = {
  id: { formal: 'Hormat saya,', casual: 'Salam hangat,' },
  en: { formal: 'Sincerely,', casual: 'Best regards,' },
}

const SIGN_OFF = /^(?:hormat saya|hormat kami|salam hangat|salam|salam hormat|best regards|kind regards|warm regards|regards|sincerely|yours sincerely|yours faithfully|terima kasih|thanks|thank you),?$/i
const PLACEHOLDER = /^[{[(<]\s*[^}\])>]*(?:nama|name)[^}\])>]*[}\])>]$/i

const fullName = (profile: Profile) =>
  [profile.personal.firstName, profile.personal.middleName, profile.personal.lastName].map((part) => part.trim()).filter((part) => part !== '').join(' ')

// Whatever sign-off the model wrote at the end, with the name or placeholder under it, is cut; job-kit writes its own.
export function withoutSignOff(body: string): string {
  const lines = body.trim().split('\n')
  const filled = lines.map((line, index) => ({ line: line.trim(), index })).filter((row) => row.line !== '')
  const tail = filled.slice(-3)
  const start = tail.find((row) => SIGN_OFF.test(row.line))
  if (start) return lines.slice(0, start.index).join('\n').trimEnd()
  const last = tail.at(-1)
  if (last && PLACEHOLDER.test(last.line)) return lines.slice(0, last.index).join('\n').trimEnd()
  return lines.join('\n').trimEnd()
}

// The name in the closing comes from the Profile, here on this computer. The model never gets it (FR-43, FR-46).
// `body` may still carry the model's own sign-off; it is cut here as well, so this is safe on its own.
export function finishLetter(body: string, profile: Profile, lang: Lang, tone: Tone): string {
  const name = fullName(profile)
  return `${withoutSignOff(body)}\n\n${CLOSING[lang][tone]}${name === '' ? '' : `\n${name}`}`
}
