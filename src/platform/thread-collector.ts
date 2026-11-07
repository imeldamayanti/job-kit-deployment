import { browser } from 'wxt/browser'
import type { ThreadRead, ThreadSession } from '../core/feed/sources/thread'
import { SourceError } from '../core/feed/sources/types'

const READER = '/thread-reader.js'
const LOAD_TIMEOUT_MS = 20_000
const FIRST_POSTS_MS = 12_000

type Reader = { read: () => ThreadRead }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Starts a navigation and waits for it to finish. The listener is in place before the navigation starts, so the
// finish cannot be missed; the blank page the window opens with does not count as the finish.
function navigate(tabId: number, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (done: () => void) => {
      clearTimeout(timer)
      browser.tabs.onUpdated.removeListener(onUpdated)
      done()
    }
    const onUpdated = (id: number, info: { status?: string }, tab: { url?: string }) => {
      if (id === tabId && info.status === 'complete' && !tab.url?.startsWith('about:')) finish(resolve)
    }
    const timer = setTimeout(() => finish(() => reject(new SourceError('timeout'))), LOAD_TIMEOUT_MS)
    browser.tabs.onUpdated.addListener(onUpdated)
    browser.tabs.update(tabId, { url }).catch(() => finish(() => reject(new SourceError('network'))))
  })
}

// Opens one small window that is not focused and moves it from search to search. A hidden tab often does not load
// the rest of a page, so the window stays visible but out of the way, and closes when the run ends.
export async function openThreadSession(): Promise<ThreadSession> {
  const win = await browser.windows.create({ url: 'about:blank', focused: false, type: 'popup', width: 520, height: 820 })
  if (!win) throw new SourceError('network')
  const tabId = win.tabs?.[0]?.id
  const close = () => (win.id === undefined ? Promise.resolve() : browser.windows.remove(win.id).catch(() => {}))
  if (tabId === undefined) {
    await close()
    throw new SourceError('network')
  }

  const read = async (): Promise<ThreadRead> => {
    await browser.scripting.executeScript({ target: { tabId }, files: [READER] })
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => (globalThis as { __jobkitThread?: Reader }).__jobkitThread?.read(),
    })
    return (injection?.result as ThreadRead | undefined) ?? { posts: [], loginWall: false }
  }
  const scroll = async () => {
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => window.scrollBy({ top: Math.round(window.innerHeight * (0.7 + Math.random() * 0.5)), behavior: 'smooth' }),
    })
  }
  const goto = async (url: string) => {
    await navigate(tabId, url)
    // The posts draw after the page loads; give them a few seconds before the first real read.
    const deadline = Date.now() + FIRST_POSTS_MS
    while (Date.now() < deadline) {
      const first = await read().catch(() => null)
      if (first && (first.loginWall || first.posts.length > 0)) break
      await wait(1000)
    }
  }
  return { goto, read, scroll, close }
}
