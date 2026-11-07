import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createAutosaver, type SaveOutcome, type SaveState } from '../../core/profile/autosave'
import { reconcileProfile } from '../../core/profile/reconcile'
import type { Profile } from '../../core/profile/types'
import { loadProfile, saveProfile, watchProfile } from '../../platform/storage'

const AUTOSAVE_DELAY_MS = 400

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saveState, setSaveState] = useState<SaveState | 'idle'>('idle')

  // The profile as this tab last loaded or saved it, and how many edits it has made. Together they let a save write
  // only what this tab changed, so a tab opened long ago cannot write an old copy over what another tab saved
  // (job preferences were lost that way).
  const baseRef = useRef<Profile | null>(null)
  const editsRef = useRef(0)
  const pendingRef = useRef(false)

  const saver = useMemo(
    () =>
      createAutosaver<Profile>(
        async (mine) => {
          const started = editsRef.current
          const stored = await loadProfile()
          const merged = reconcileProfile(baseRef.current ?? stored, mine, stored)
          const outcome = await saveProfile(merged)
          if (!outcome.ok) return outcome
          if (editsRef.current === started) {
            // Nothing was typed while saving: show what is stored, which may include another tab's changes.
            baseRef.current = merged
            pendingRef.current = false
            if (!same(merged, mine)) setProfile(merged)
          } else {
            // The person kept typing: what this tab holds is still `mine` plus the new edits.
            baseRef.current = mine
          }
          return outcome
        },
        AUTOSAVE_DELAY_MS,
        setSaveState,
      ),
    [],
  )

  useEffect(() => {
    let active = true
    void loadProfile().then((loaded) => {
      if (!active) return
      baseRef.current = loaded
      setProfile(loaded)
    })
    // A change saved by another tab or page shows up here, unless this tab has an edit of its own still to save.
    const stop = watchProfile((external) => {
      if (pendingRef.current) return
      baseRef.current = external
      setProfile(external)
    })
    return () => {
      active = false
      stop()
      void saver.flush()
    }
  }, [saver])

  const update = useCallback(
    (next: Profile) => {
      editsRef.current += 1
      pendingRef.current = true
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
      if (outcome.ok) {
        baseRef.current = next
        pendingRef.current = false
        setProfile(next)
      }
      return outcome
    },
    [saver],
  )

  return { profile, update, commit, saveState }
}
