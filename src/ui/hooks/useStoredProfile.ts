import { useEffect, useState } from 'react'
import type { Profile } from '../../core/profile/types'
import { loadProfile, watchProfile } from '../../platform/storage'

// Read-only view of the saved profile that follows edits made in the options page.
export function useStoredProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let active = true
    void loadProfile().then((loaded) => active && setProfile(loaded))
    const stop = watchProfile(setProfile)
    return () => {
      active = false
      stop()
    }
  }, [])

  return profile
}
