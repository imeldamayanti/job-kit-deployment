import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'
import type { OpenedJob } from '../core/feed/opened'

// Which tabs were opened from the feed. Lives only as long as the browser session.
const openedItem = storage.defineItem<Record<string, OpenedJob>>('session:openedJobs', { fallback: {} })

export async function rememberOpened(tabId: number, opened: OpenedJob): Promise<void> {
  await openedItem.setValue({ ...(await openedItem.getValue()), [String(tabId)]: opened })
}

export async function loadOpened(tabId: number): Promise<OpenedJob | undefined> {
  return (await openedItem.getValue())[String(tabId)]
}

export async function forgetOpened(tabId: number): Promise<void> {
  const { [String(tabId)]: _gone, ...rest } = await openedItem.getValue()
  await openedItem.setValue(rest)
}

export function watchClosedTabs(): void {
  browser.tabs.onRemoved.addListener((tabId) => void forgetOpened(tabId))
}
