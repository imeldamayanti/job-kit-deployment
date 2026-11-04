// Every guess about the Threads page lives here, so a layout change is a one-file fix.
// These have not been checked against a live logged-in feed yet: the first real run shows if they hold.
export const THREAD_ORIGIN = 'https://www.threads.com'
// The home page: "For you". It is what the account sees once it has no follows; with follows, point this at the Following feed instead.
export const THREAD_FEED_URL = `${THREAD_ORIGIN}/`

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
