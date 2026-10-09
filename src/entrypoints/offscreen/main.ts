import { browser } from 'wxt/browser'
import { parseDetailPage, parseSearchPage } from '../../core/feed/sources/linkedin-parse'

// The service worker has no DOMParser, so it sends the HTML here to be read (T27 spike).
browser.runtime.onMessage.addListener((message: { target?: string; type?: string; html?: string }, _sender, reply) => {
  if (message.target !== 'offscreen' || typeof message.html !== 'string') return
  if (message.type === 'parse-search') reply(parseSearchPage(message.html))
  else if (message.type === 'parse-detail') reply(parseDetailPage(message.html))
})
