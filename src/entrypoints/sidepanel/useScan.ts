import { useEffect, useState } from 'react'
import { domainOf } from '../../core/fill/page-access'
import { requestScan, type PageScan } from '../../platform/messaging'
import { getActiveTab } from '../../platform/tabs'

export type ScanState = { status: 'loading' } | { status: 'ready'; domain: string; scan: PageScan }

export function useScan(): ScanState {
  const [state, setState] = useState<ScanState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const tab = await getActiveTab()
      const scan: PageScan = tab ? await requestScan(tab) : { ok: false, reason: 'unreachable-page' }
      if (!cancelled) setState({ status: 'ready', domain: domainOf(tab?.url), scan })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
