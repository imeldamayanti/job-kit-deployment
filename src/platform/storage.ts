import { storage } from 'wxt/utils/storage'
import { createEmptyProfile } from '../core/profile/profile'
import type { Profile } from '../core/profile/types'

const profileItem = storage.defineItem<Profile>('local:profile', {
  fallback: createEmptyProfile(),
})

export function loadProfile(): Promise<Profile> {
  return profileItem.getValue()
}

export function saveProfile(profile: Profile): Promise<void> {
  return profileItem.setValue(profile)
}
