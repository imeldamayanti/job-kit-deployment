import { useEffect, useState } from 'react'
import { domainOf } from '../../core/fill/page-access'
import { buildPlan, type Plan } from '../../core/matching/plan'
import { requestScan, type PageScan } from '../../platform/messaging'
import { loadProfile } from '../../platform/storage'
import { getActiveTab } from '../../platform/tabs'

export type ScanState =
  | { status: 'loading' }
  | { status: 'ready'; domain: string; scan: PageScan; plan: Plan | null }

export function useScan(): ScanState {
  const [state, setState] = useState<ScanState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const tab = await getActiveTab()
      const scan: PageScan = tab ? await requestScan(tab) : { ok: false, reason: 'unreachable-page' }
      const plan = scan.ok ? buildPlan(scan.fields, await loadProfile()) : null
      if (!cancelled) setState({ status: 'ready', domain: domainOf(tab?.url), scan, plan })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
