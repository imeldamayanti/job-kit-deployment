import type { MatchKey } from '../matching/match'
import { CONTACT_KEYS } from './types'

export type SectionId = 'personal' | 'contact' | 'education' | 'experience' | 'custom'

export const PROFILE_SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'personal', title: 'Personal Info' },
  { id: 'contact', title: 'Contact & Address' },
  { id: 'education', title: 'Education' },
  { id: 'experience', title: 'Work Experience' },
  { id: 'custom', title: 'Custom Field' },
]

const CONTACT = new Set<string>(CONTACT_KEYS)

// Where the user goes to fill in a value the profile is missing.
export function sectionForKey(key: MatchKey): SectionId {
  if (key.startsWith('custom:')) return 'custom'
  return CONTACT.has(key) ? 'contact' : 'personal'
}

export function sectionFromHash(hash: string): SectionId {
  const id = hash.replace(/^#/, '')
  return PROFILE_SECTIONS.find((section) => section.id === id)?.id ?? 'personal'
}
