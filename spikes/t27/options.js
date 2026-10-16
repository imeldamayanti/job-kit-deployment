const out = document.getElementById('out')
const log = (x) => { out.textContent = (typeof x === 'string' ? x : JSON.stringify(x, null, 2)) + '\n\n' + out.textContent }
const send = (m) => chrome.runtime.sendMessage({ target: 'sw', ...m })
const ORIGINS = [
  'https://boards-api.greenhouse.io/*', 'https://api.lever.co/*', 'https://api.ashbyhq.com/*',
  'https://remotive.com/*', 'https://www.linkedin.com/*', 'https://api.anthropic.com/*',
]
document.querySelectorAll('[data-src]').forEach((b) => (b.onclick = async () => log(await send({ type: 'source', name: b.dataset.src }))))
document.getElementById('li1').onclick = async () => log(await send({ type: 'linkedin', pages: 3 }))
document.getElementById('li5').onclick = async () => log(await send({ type: 'linkedin', pages: 8 }))
document.getElementById('all').onclick = async () => {
  for (const n of ['greenhouse', 'lever', 'ashby', 'remotive']) log(await send({ type: 'source', name: n }))
}
document.getElementById('perm').onclick = async () => {
  const before = await chrome.permissions.getAll()
  const granted = await chrome.permissions.request({ origins: ORIGINS })
  log({ granted, required_permissions_before: before.permissions, after: (await chrome.permissions.getAll()) })
}
document.getElementById('has').onclick = async () => log(await chrome.permissions.getAll())
document.getElementById('ai').onclick = async () => log(await send({ type: 'ai', key: document.getElementById('key').value, model: document.getElementById('model').value }))
document.getElementById('sp1').onclick = async () => {
  const tab = await chrome.tabs.create({ url: 'https://example.com', active: true })
  try { await chrome.sidePanel.open({ tabId: tab.id }); log({ sp1: 'ok', tabId: tab.id }) } catch (e) { log({ sp1: 'gagal', error: String(e) }) }
}
document.getElementById('sp2').onclick = async () => {
  try {
    const me = await chrome.tabs.getCurrent()
    const [other] = (await chrome.tabs.query({ windowId: me.windowId })).filter((t) => t.id !== me.id)
    if (!other) return log('buka tab lain di window ini dulu')
    await chrome.sidePanel.open({ tabId: other.id }); log({ sp2: 'ok', tabId: other.id })
  } catch (e) { log({ sp2: 'gagal', error: String(e) }) }
}
