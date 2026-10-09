import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAutosaver, type SaveState } from '../../core/profile/autosave'
import type { Profile } from '../../core/profile/types'
import { loadProfile, saveProfile } from '../../platform/storage'

const AUTOSAVE_DELAY_MS = 400

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saveState, setSaveState] = useState<SaveState | 'idle'>('idle')
  const saver = useMemo(
    () => createAutosaver<Profile>(saveProfile, AUTOSAVE_DELAY_MS, setSaveState),
    [],
  )

  useEffect(() => {
    void loadProfile().then(setProfile)
    return () => void saver.flush()
  }, [saver])

  const update = useCallback(
    (next: Profile) => {
      setProfile(next)
      saver.schedule(next)
    },
    [saver],
  )

  return { profile, update, saveState }
}
