// Parsing HTML LinkedIn di sini karena service worker tidak punya DOMParser.
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.target !== 'offscreen' || msg.type !== 'parse-linkedin') return
  const doc = new DOMParser().parseFromString(msg.html, 'text/html')
  const cards = [...doc.querySelectorAll('.base-search-card')].map((c) => ({
    title: c.querySelector('.base-search-card__title')?.textContent.trim() ?? null,
    company: c.querySelector('.base-search-card__subtitle')?.textContent.trim() ?? null,
    location: c.querySelector('.job-search-card__location')?.textContent.trim() ?? null,
    listed: c.querySelector('.job-search-card__listdate')?.textContent.trim() ?? null,
    url: c.querySelector('a.base-card__full-link')?.href.split('?')[0] ?? null,
  }))
  reply({ count: cards.length, first: cards[0] ?? null })
})
