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
    version: 1,
    personal: emptyRecord<PersonalKey>(PERSONAL_KEYS),
    contact: emptyRecord<ContactKey>(CONTACT_KEYS),
    education: [],
    experience: [],
    skills: [],
    custom: [],
  }
}

export function setPersonalField(profile: Profile, key: PersonalKey, value: string): Profile {
  return { ...profile, personal: { ...profile.personal, [key]: value } }
}
