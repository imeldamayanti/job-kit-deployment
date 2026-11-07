// Every guess about the Threads page lives here, so a layout change is a one-file fix.
// Checked on the logged-in home feed (Nov 2026); the search page is assumed to draw posts the same way.
export const THREAD_ORIGIN = 'https://www.threads.com'
// The feed is mostly chatter; a keyword search gathers the hiring posts. Each run reads these searches, in order.
export const THREAD_KEYWORDS = ['loker', 'lowongan kerja', 'hiring']
// "Terbaru" tab of the search, so a daily run sees what was posted since the last one, not the same top posts.
export const threadSearchUrl = (keyword: string) => `${THREAD_ORIGIN}/search?q=${encodeURIComponent(keyword)}&serp_type=default&filter=recent`

export const THREAD_SELECTORS = {
  post: '[data-pressable-container="true"]',
  permalink: 'a[href*="/post/"]',
  time: 'time[datetime]',
  text: 'span[dir="auto"]',
  // The author's name and the post's own link: both start with /@, and neither is part of the post text.
  author: 'a[href^="/@"]',
}

export const LOGIN_FORM = 'input[type="password"], input[name="username"]'
export const LOGIN_PATHS = ['/login', '/challenge', '/accounts/login']
