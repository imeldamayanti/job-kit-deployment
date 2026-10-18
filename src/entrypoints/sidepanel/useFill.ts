import { useCallback, useRef } from 'react'
import type { PlanItem } from '../../core/matching/plan'
import { requestFill, requestUndo } from '../../platform/messaging'
import { shouldMarkApplied } from '../../core/feed/opened'
import { noteEvent } from '../../platform/telemetry'
import { recordOpenedFill, type FillRecord } from '../../platform/applications'
import { loadOpened } from '../../platform/opened-jobs'
import type { ActiveTab } from '../../platform/tabs'

type FillResult = { url: string | undefined; filled: number; skipped: number; marked: number; record: FillRecord | undefined }

type Args = {
  tab: ActiveTab | undefined
  canUndo: boolean
  items: PlanItem[]
  total: number
  rescan: () => void
}

// What was filled lives in the page (so Undo survives panel reloads) and dies with the page.
// The panel only remembers the last result per tab, to show the summary and to explain a lost Undo.
export function useFill({ tab, canUndo, items, total, rescan }: Args) {
  const results = useRef(new Map<number, FillResult>())
  const result = tab ? results.current.get(tab.id) : undefined

  const fill = useCallback(async () => {
    if (!tab) return
    const outcome = await requestFill(tab, items.map(({ fieldId, value, choice }) => ({ fieldId, value, choice })))
    if (outcome.filled > 0) void noteEvent('fill')
    // A tab that came from the Lowongan page counts as applied once Fill worked (FR-31): its application
    // moves from Draft to Dilamar, and is made first when the job has none (FR-36). The panel says which one it was.
    const opened = await loadOpened(tab.id)
    const record = opened && shouldMarkApplied(opened, outcome.filled) ? await recordOpenedFill(opened, outcome.filled) : undefined
    results.current.set(tab.id, { url: tab.url, filled: outcome.filled, skipped: total - outcome.filled, marked: outcome.marked, record })
    rescan()
  }, [tab, items, total, rescan])

  const undo = useCallback(async () => {
    if (!tab) return
    await requestUndo(tab)
    results.current.delete(tab.id)
    rescan()
  }, [tab, rescan])

  return {
    phase: canUndo ? ('filled' as const) : ('preview' as const),
    summary: canUndo && result ? { filled: result.filled, skipped: result.skipped, marked: result.marked } : undefined,
    record: canUndo ? result?.record : undefined,
    undoLost: !canUndo && result !== undefined && result.url === tab?.url,
    fill,
    undo,
  }
}
