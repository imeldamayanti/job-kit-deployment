import { browser } from 'wxt/browser'
import { openedFrom } from '../core/feed/opened'
import type { Job } from '../core/feed/types'
import { rememberOpened } from './opened-jobs'

export type OpenResult = 'panel' | 'tab-only'

// "Buka & isi": the posting opens in a new tab and the job-kit panel opens on it. Chrome only
// allows the panel to open from a user action, so if it refuses the tab stays and the page tells
// the user to click the job-kit icon (T27 records whether this works from the options page).
export async function openJob(job: Job): Promise<OpenResult> {
  const tab = await browser.tabs.create({ url: job.url, active: true })
  if (tab.id === undefined) return 'tab-only'
  await rememberOpened(tab.id, openedFrom(job))
  try {
    await browser.sidePanel.open({ tabId: tab.id })
    return 'panel'
  } catch {
    return 'tab-only'
  }
}
