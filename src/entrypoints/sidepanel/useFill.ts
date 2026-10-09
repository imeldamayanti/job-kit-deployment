import { useCallback, useRef } from 'react'
import type { PlanItem } from '../../core/matching/plan'
import { requestFill, requestUndo } from '../../platform/messaging'
import { shouldMarkApplied } from '../../core/feed/opened'
import { loadOpened, markApplied } from '../../platform/opened-jobs'
import type { ActiveTab } from '../../platform/tabs'

type FillResult = { url: string | undefined; filled: number; skipped: number }

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
    results.current.set(tab.id, { url: tab.url, filled: outcome.filled, skipped: total - outcome.filled })
    // A tab that came from the Lowongan page counts as applied once Fill worked (FR-31).
    const opened = await loadOpened(tab.id)
    if (opened && shouldMarkApplied(opened, outcome.filled)) await markApplied(opened.jobId)
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
    summary: canUndo && result ? { filled: result.filled, skipped: result.skipped } : undefined,
    undoLost: !canUndo && result !== undefined && result.url === tab?.url,
    fill,
    undo,
  }
}
