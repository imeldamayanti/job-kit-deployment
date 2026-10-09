import { useCallback, useEffect, useState } from 'react'
import { domainOf } from '../../core/fill/page-access'
import { requestScan, type PageScan } from '../../platform/messaging'
import { getActiveTab, watchTabs, type ActiveTab } from '../../platform/tabs'

export type ScanState =
  | { status: 'loading' }
  | { status: 'ready'; tab: ActiveTab | undefined; domain: string; scan: PageScan }

// Keeps showing the previous result while a new scan runs, so the panel does not flash.
export function useScan(): { state: ScanState; rescan: () => void } {
  const [state, setState] = useState<ScanState>({ status: 'loading' })
  const [round, setRound] = useState(0)
  const rescan = useCallback(() => setRound((value) => value + 1), [])

  useEffect(() => watchTabs(rescan), [rescan])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const tab = await getActiveTab()
      const scan: PageScan = tab ? await requestScan(tab) : { ok: false, reason: 'unreachable-page' }
      if (!cancelled) setState({ status: 'ready', tab, domain: domainOf(tab?.url), scan })
    })()
    return () => {
      cancelled = true
    }
  }, [round])

  return { state, rescan }
}
