import { panelContext, resolveApplication, type PanelContext } from '../core/applications/panel'
import type { OpenedJob } from '../core/feed/opened'
import { loadApplicationData } from './application-storage'
import { loadOpened } from './opened-jobs'
import { loadProfile } from './storage'

export type PanelTab = { opened: OpenedJob; context?: PanelContext }

// What the panel knows about a tab opened by Buka & isi: where it came from, and the application behind it with its letter
// and CV markers (S1). A tab not opened from job-kit gives nothing. Read only.
export async function loadPanelContext(tabId: number | undefined): Promise<PanelTab | undefined> {
  if (tabId === undefined) return undefined
  const opened = await loadOpened(tabId)
  if (!opened) return undefined
  const [data, profile] = await Promise.all([loadApplicationData(), loadProfile()])
  const app = resolveApplication(opened, data.applications)
  // The CV file carries the person's name, so the panel names the same file the download makes.
  const person = [profile.personal.firstName, profile.personal.lastName].join(' ')
  return app ? { opened, context: panelContext(app, data, person) } : { opened }
}
