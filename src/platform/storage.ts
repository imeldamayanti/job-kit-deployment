import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'
import type { SaveOutcome } from '../core/profile/autosave'
import { migrateProfile } from '../core/profile/migrate'
import { createEmptyProfile } from '../core/profile/profile'
import { isQuotaError } from '../core/profile/storage-errors'
import type { Profile } from '../core/profile/types'

const profileItem = storage.defineItem<Profile>('local:profile', {
  fallback: createEmptyProfile(),
})

export async function loadProfile(): Promise<Profile> {
  return migrateProfile(await profileItem.getValue())
}

// A refused write changes nothing, so the profile saved earlier is still there.
export async function saveProfile(profile: Profile): Promise<SaveOutcome> {
  try {
    await profileItem.setValue(profile)
    return { ok: true }
  } catch (error) {
    if (isQuotaError(error)) return { ok: false, reason: 'storage-full' }
    throw error
  }
}

export function watchProfile(onChange: (profile: Profile) => void): () => void {
  return profileItem.watch((value) => onChange(migrateProfile(value)))
}

export type StorageUsage = { used: number; quota: number }

export async function loadStorageUsage(): Promise<StorageUsage> {
  const used = await browser.storage.local.getBytesInUse(null)
  return { used, quota: browser.storage.local.QUOTA_BYTES }
}
