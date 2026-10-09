import { browser } from 'wxt/browser'
import type { Job } from '../core/feed/types'

// "Buka & isi": opens the posting in a new tab. T38 adds the side panel and the Dilamar status.
export async function openJob(job: Job): Promise<void> {
  await browser.tabs.create({ url: job.url, active: true })
}
