import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAutosaver, type SaveOutcome, type SaveState } from '../../core/profile/autosave'
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

  // For a change that must be known to have landed before saying so (Data page): writes at once and
  // reports the outcome. A refused write leaves both the stored profile and the one on screen as they were.
  const commit = useCallback(
    async (next: Profile): Promise<SaveOutcome> => {
      await saver.flush()
      setSaveState('saving')
      const outcome = await saveProfile(next)
      setSaveState(outcome.ok ? 'saved' : outcome.reason)
      if (outcome.ok) setProfile(next)
      return outcome
    },
    [saver],
  )

  return { profile, update, commit, saveState }
}
