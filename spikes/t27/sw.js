const UA_FREE = { Accept: 'application/json' }
const SOURCES = {
  greenhouse: { url: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true', kind: 'json', list: (d) => d.jobs },
  lever: { url: 'https://api.lever.co/v0/postings/spotify?mode=json&limit=30', kind: 'json', list: (d) => d },
  ashby: { url: 'https://api.ashbyhq.com/posting-api/job-board/ashby?includeCompensation=true', kind: 'json', list: (d) => d.jobs },
  remotive: { url: 'https://remotive.com/api/remote-jobs?category=software-dev', kind: 'json', list: (d) => d.jobs },
}
const LI = (start) =>
  `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=frontend%20engineer&location=Indonesia&f_WT=2&start=${start}`

async function timed(url, init) {
  const t = performance.now()
  try {
    const res = await fetch(url, { credentials: 'omit', ...init })
    const text = await res.text()
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - t), bytes: new Blob([text]).size, text }
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t), error: String(e) }
  }
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return
  await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['DOM_PARSER'], justification: 'Parse HTML LinkedIn' })
}

async function runSource(name) {
  const s = SOURCES[name]
  const r = await timed(s.url, { headers: UA_FREE })
  if (!r.ok) return { source: name, ...strip(r) }
  const data = JSON.parse(r.text)
  const list = s.list(data)
  return { source: name, ...strip(r), jobs: list.length, fields: Object.keys(list[0] ?? {}) }
}

async function runLinkedIn(maxPages) {
  await ensureOffscreen()
  const pages = []
  let sample = null
  for (let i = 0; i < maxPages; i++) {
    if (i) await new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000))
    const r = await timed(LI(i * 10))
    if (!r.ok) { pages.push({ page: i, ...strip(r) }); break }
    const parsed = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'parse-linkedin', html: r.text })
    pages.push({ page: i, ...strip(r), cards: parsed.count })
    sample ??= parsed.first
    if (!parsed.count) break
  }
  return { source: 'linkedin', pages, sample }
}

function strip(r) { const { text, ...rest } = r; return rest }

async function runAi(key, model) {
  const r = await timed('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 20, messages: [{ role: 'user', content: 'Balas satu kata: ok' }] }),
  })
  let body = null
  try { body = JSON.parse(r.text ?? '') } catch {}
  return { source: 'ai', ...strip(r), reply: body?.content?.[0]?.text ?? null, error_body: body?.error ?? null }
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.target !== 'sw') return
  const job =
    msg.type === 'source' ? runSource(msg.name)
    : msg.type === 'linkedin' ? runLinkedIn(msg.pages ?? 3)
    : msg.type === 'ai' ? runAi(msg.key, msg.model)
    : Promise.resolve({ error: 'unknown' })
  job.then(reply, (e) => reply({ error: String(e) }))
  return true
})
