import { useEffect, useState } from 'react'
import { watchApplications } from '../../platform/application-storage'
import { loadPanelContext, type PanelTab } from '../../platform/panel-context'

// The application behind the active tab, if Buka & isi opened it. It re-reads when the applications change, so a letter
// made or a CV downloaded in the options page shows here without reopening the panel.
export function usePanelTab(tabId: number | undefined): PanelTab | undefined {
  const [tab, setTab] = useState<PanelTab | undefined>()
  useEffect(() => {
    let active = true
    setTab(undefined)
    const read = () => void loadPanelContext(tabId).then((loaded) => active && setTab(loaded))
    read()
    const stop = watchApplications(read)
    return () => {
      active = false
      stop()
    }
  }, [tabId])
  return tab
}
