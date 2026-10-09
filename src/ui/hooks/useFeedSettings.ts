import { useCallback, useEffect, useMemo, useState } from 'react'
import { createDefaultSettings, type FeedSettings } from '../../core/feed/settings'
import { createAutosaver, type SaveState } from '../../core/profile/autosave'
import { loadAiKey, loadSettings, saveAiKey, saveSettings } from '../../platform/feed-storage'

export function useFeedSettings() {
  const [settings, setSettings] = useState<FeedSettings | null>(null)
  const [key, setKey] = useState('')
  const [saveState, setSaveState] = useState<SaveState | 'idle'>('idle')
  const saver = useMemo(() => createAutosaver<FeedSettings>(saveSettings, 400, setSaveState), [])

  useEffect(() => {
    void loadSettings().then(setSettings)
    void loadAiKey().then(setKey)
    return () => void saver.flush()
  }, [saver])

  const update = useCallback(
    (next: FeedSettings) => {
      setSettings(next)
      saver.schedule(next)
    },
    [saver],
  )

  const changeKey = useCallback((next: string) => {
    setKey(next)
    void saveAiKey(next)
  }, [])

  return { settings: settings ?? null, fallback: createDefaultSettings(), key, changeKey, update, saveState }
}
