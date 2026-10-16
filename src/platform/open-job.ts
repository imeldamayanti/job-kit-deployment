import { browser } from 'wxt/browser'
import type { Application } from '../core/applications/types'
import { openedFrom, openedFromApplication, type OpenedJob } from '../core/feed/opened'
import type { Job } from '../core/feed/types'
import { loadFeed } from './feed-storage'
import { rememberOpened } from './opened-jobs'

export type OpenResult = 'panel' | 'tab-only'

// "Buka & isi": the posting opens in a new tab and the job-kit panel opens on it. Chrome only
// allows the panel to open from a user action, so if it refuses the tab stays and the page tells
// the user to click the job-kit icon (T27 records whether this works from the options page).
export const openJob = (job: Job): Promise<OpenResult> => openPosting(job.url, async () => openedFrom(job))

// The same from Detail Lamaran: the URL is the application's copy, so it works after the feed pruned the job.
export const openApplication = (app: Application): Promise<OpenResult> =>
  openPosting(app.job.url, async () => {
    const job = app.jobId === null ? undefined : (await loadFeed()).find((item) => item.id === app.jobId)
    return openedFromApplication(app, job)
  })

// The tab is created first, with nothing awaited before it, so the click still counts as the user action
// that Chrome wants before it opens the panel.
async function openPosting(url: string, describe: () => Promise<OpenedJob>): Promise<OpenResult> {
  const tab = await browser.tabs.create({ url, active: true })
  if (tab.id === undefined) return 'tab-only'
  await rememberOpened(tab.id, await describe())
  try {
    await browser.sidePanel.open({ tabId: tab.id })
    return 'panel'
  } catch {
    return 'tab-only'
  }
}
