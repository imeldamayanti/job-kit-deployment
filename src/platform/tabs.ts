import { browser } from 'wxt/browser'

export type ActiveTab = { id: number; url: string | undefined; title: string | undefined }

export async function getActiveTab(): Promise<ActiveTab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id === undefined ? undefined : { id: tab.id, url: tab.url, title: tab.title }
}

// Fires when the tab the user is looking at changes: switched to, finished loading, or navigated.
export function watchTabs(onChange: () => void): () => void {
  const onUpdated = (_tabId: number, info: { status?: string; url?: string }, tab: { active?: boolean }) => {
    if (tab.active && (info.status === 'complete' || info.url !== undefined)) onChange()
  }
  browser.tabs.onActivated.addListener(onChange)
  browser.tabs.onUpdated.addListener(onUpdated)
  return () => {
    browser.tabs.onActivated.removeListener(onChange)
    browser.tabs.onUpdated.removeListener(onUpdated)
  }
}
