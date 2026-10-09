import { browser } from 'wxt/browser'

export type ActiveTab = { id: number; url: string | undefined }

export async function getActiveTab(): Promise<ActiveTab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  return tab?.id === undefined ? undefined : { id: tab.id, url: tab.url }
}
