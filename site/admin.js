import { adminRequest, parseStats, sections } from './admin-core.js'
import { SUPABASE } from './config.js'
import { isPublicKey } from './feedback-core.js'

// Private page for the owner. Everything shown comes from admin_stats(), which answers only the emails in admin_users.
// The session lives in sessionStorage (gone when the tab closes), never in localStorage.
const $ = (id) => document.getElementById(id)
const status = $('status')
const KEY = 'jobkit-admin-session'
const base = SUPABASE.url.replace(/\/$/, '')
const headers = { 'Content-Type': 'application/json', apikey: SUPABASE.key }

const say = (text) => { status.textContent = text }
const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'omit' })

function show(view) {
  const out = $('out')
  out.replaceChildren()
  const heads = document.createElement('div')
  heads.className = 'cards'
  for (const h of view.headline) {
    const li = document.createElement('li')
    const b = document.createElement('b')
    b.textContent = h.value
    li.append(b, h.label)
    heads.append(li)
  }
  out.append(heads)
  for (const t of view.tables) {
    const h2 = document.createElement('h2')
    h2.textContent = t.title
    const table = document.createElement('table')
    const thead = table.createTHead().insertRow()
    for (const c of t.head) thead.insertCell().textContent = c
    const body = table.createTBody()
    if (t.rows.length === 0) body.insertRow().insertCell().textContent = 'Belum ada data.'
    for (const r of t.rows) { const tr = body.insertRow(); for (const c of r) tr.insertCell().textContent = c }
    out.append(h2, table)
  }
}

async function load(token) {
  const request = adminRequest(SUPABASE, token)
  const response = await fetch(request.url, { ...request.init, credentials: 'omit' })
  if (response.status === 401 || response.status === 403 || response.status === 400) {
    sessionStorage.removeItem(KEY)
    return say('Bukan admin, atau sesi habis. Masuk lagi.')
  }
  if (!response.ok) return say('Gagal mengambil angka. Coba lagi.')
  say('')
  $('login').hidden = true
  show(sections(parseStats(await response.json())))
}

if (!SUPABASE.url || !isPublicKey(SUPABASE.key)) {
  say('Supabase belum diatur (site/config.js).')
  $('login').hidden = true
} else {
  const saved = sessionStorage.getItem(KEY)
  if (saved) void load(saved)

  $('send').addEventListener('click', async () => {
    const email = $('email').value.trim()
    if (!email) return say('Isi email dulu.')
    const response = await post('/auth/v1/otp', { email, create_user: false }).catch(() => null)
    say(response?.ok ? 'Kode dikirim. Cek emailmu.' : 'Gagal mengirim kode.')
  })

  $('verify').addEventListener('click', async () => {
    const response = await post('/auth/v1/verify', { type: 'email', email: $('email').value.trim(), token: $('code').value.trim() }).catch(() => null)
    if (!response?.ok) return say('Kode salah atau kedaluwarsa.')
    const token = (await response.json()).access_token
    if (typeof token !== 'string') return say('Jawaban tidak dikenal.')
    sessionStorage.setItem(KEY, token)
    await load(token)
  })
}
