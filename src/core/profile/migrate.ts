import { normalizeJobPreferences } from './job-preferences'
import { createEmptyProfile } from './profile'
import type { Profile } from './types'

// Brings a stored profile up to the current shape. Version 1 had no job preferences.
export function migrateProfile(raw: unknown): Profile {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return createEmptyProfile()
  const stored = raw as Partial<Profile>
  return { ...createEmptyProfile(), ...stored, version: 2, jobPrefs: normalizeJobPreferences(stored.jobPrefs) }
}
