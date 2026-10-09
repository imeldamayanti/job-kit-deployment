import { createEmptyJobPreferences } from './job-preferences'
import {
  CONTACT_KEYS,
  PERSONAL_KEYS,
  type ContactKey,
  type PersonalKey,
  type Profile,
} from './types'

function emptyRecord<K extends string>(keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, ''])) as Record<K, string>
}

export function createEmptyProfile(): Profile {
  return {
    version: 2,
    personal: emptyRecord<PersonalKey>(PERSONAL_KEYS),
    contact: emptyRecord<ContactKey>(CONTACT_KEYS),
    education: [],
    experience: [],
    skills: [],
    custom: [],
    jobPrefs: createEmptyJobPreferences(),
  }
}

export function setPersonalField(profile: Profile, key: PersonalKey, value: string): Profile {
  return { ...profile, personal: { ...profile.personal, [key]: value } }
}

export function setContactField(profile: Profile, key: ContactKey, value: string): Profile {
  return { ...profile, contact: { ...profile.contact, [key]: value } }
}

export function addCustomField(profile: Profile, id: string): Profile {
  return { ...profile, custom: [...profile.custom, { id, key: '', value: '' }] }
}

export function updateCustomField(
  profile: Profile,
  id: string,
  change: Partial<{ key: string; value: string }>,
): Profile {
  return { ...profile, custom: profile.custom.map((pair) => (pair.id === id ? { ...pair, ...change } : pair)) }
}

export function removeCustomField(profile: Profile, id: string): Profile {
  return { ...profile, custom: profile.custom.filter((pair) => pair.id !== id) }
}
