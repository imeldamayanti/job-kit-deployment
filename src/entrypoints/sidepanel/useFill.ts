import { useCallback, useState } from 'react'
import type { Plan } from '../../core/matching/plan'
import { requestFill, requestUndo } from '../../platform/messaging'
import type { ActiveTab } from '../../platform/tabs'

export type FillState = { phase: 'preview' } | { phase: 'filled'; filled: number; skipped: number }

export function useFill(tab: ActiveTab | undefined, plan: Plan | null) {
  const [state, setState] = useState<FillState>({ phase: 'preview' })

  const fill = useCallback(async () => {
    if (!tab || !plan) return
    const items = plan.items.map(({ fieldId, value }) => ({ fieldId, value }))
    const outcome = await requestFill(tab, items)
    setState({ phase: 'filled', filled: outcome.filled, skipped: plan.total - outcome.filled })
  }, [tab, plan])

  const undo = useCallback(async () => {
    if (!tab) return
    await requestUndo(tab)
    setState({ phase: 'preview' })
  }, [tab])

  return { state, fill, undo }
}
