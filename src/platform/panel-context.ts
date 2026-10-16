import { panelContext, resolveApplication, type PanelContext } from '../core/applications/panel'
import type { OpenedJob } from '../core/feed/opened'
import { loadApplicationData } from './application-storage'
import { loadOpened } from './opened-jobs'

export type PanelTab = { opened: OpenedJob; context?: PanelContext }

// What the panel knows about a tab opened by Buka & isi: where it came from, and the application behind it with its letter
// and CV markers (S1). A tab not opened from job-kit gives nothing. Read only.
export async function loadPanelContext(tabId: number | undefined): Promise<PanelTab | undefined> {
  if (tabId === undefined) return undefined
  const opened = await loadOpened(tabId)
  if (!opened) return undefined
  const data = await loadApplicationData()
  const app = resolveApplication(opened, data.applications)
  return app ? { opened, context: panelContext(app, data) } : { opened }
}
