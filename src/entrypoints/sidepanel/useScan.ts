import { useCallback, useEffect, useState } from 'react'
import { domainOf } from '../../core/fill/page-access'
import { buildPlan, type Plan } from '../../core/matching/plan'
import { requestScan, type PageScan } from '../../platform/messaging'
import { loadProfile } from '../../platform/storage'
import { getActiveTab, type ActiveTab } from '../../platform/tabs'

export type ScanState =
  | { status: 'loading' }
  | { status: 'ready'; tab: ActiveTab | undefined; domain: string; scan: PageScan; plan: Plan | null }

export function useScan(): { state: ScanState; rescan: () => void } {
  const [state, setState] = useState<ScanState>({ status: 'loading' })
  const [round, setRound] = useState(0)
  const rescan = useCallback(() => setRound((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const tab = await getActiveTab()
      const scan: PageScan = tab ? await requestScan(tab) : { ok: false, reason: 'unreachable-page' }
      const plan = scan.ok ? buildPlan(scan.fields, await loadProfile()) : null
      if (!cancelled) setState({ status: 'ready', tab, domain: domainOf(tab?.url), scan, plan })
    })()
    return () => {
      cancelled = true
    }
  }, [round])

  return { state, rescan }
}
