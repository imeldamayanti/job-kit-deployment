import { browser } from 'wxt/browser'
import type { RunStart } from './feed-runner'

// Asks the background to run the feed now ("Segarkan"). The answer is immediate.
export function requestRefresh(): Promise<RunStart> {
  return browser.runtime.sendMessage({ type: 'feed:refresh' }) as Promise<RunStart>
}
