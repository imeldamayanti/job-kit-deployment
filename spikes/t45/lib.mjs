// Shared pieces of the T45 spike: env, pseudonymization (D13), prompts, Gemini call.
import { readFileSync } from 'node:fs'

export function loadEnv() {
  const raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  return Object.fromEntries(
    raw.split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  )
}

// USD per 1M tokens (paid tier), from ai.google.dev/gemini-api/docs/pricing as of 2026-10-14.
export const PRICES = {
  'gemini-2.5-flash-lite': [0.1, 0.4],
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.8-flash': [0.75, 3.75],
  'gemini-3.6-flash': [0.75, 3.75],
  'gemini-3.1-pro-preview': [2, 12],
}
export const cost = (model, inTok, outTok) => {
  const p = PRICES[model]
  return p ? (inTok * p[0] + outTok * p[1]) / 1e6 : null
}

// --- pseudonymization: company and campus names become codes in the payload, restored locally ---
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function pseudonymize(profile) {
  const map = new Map()
  const names = [
    ...profile.experience.map((e) => [e.company, 'C']),
    ...profile.education.map((e) => [e.institution, 'S']),
  ]
  const counters = { C: 0, S: 0 }
  for (const [name, kind] of names) if (!map.has(name)) map.set(name, `{${kind}${++counters[kind]}}`)
  const swap = (text) => {
    let out = text
    for (const [name, code] of [...map].sort((a, b) => b[0].length - a[0].length)) out = out.replace(new RegExp(escapeRe(name), 'gi'), code)
    return out
  }
  const restore = (text) => {
    let out = text
    for (const [name, code] of map) out = out.split(code).join(name)
    return out
  }
  const payload = {
    skills: profile.skills,
    experience: profile.experience.map((e) => ({ id: e.id, title: e.title, company: map.get(e.company), description: swap(e.description) })),
    education: profile.education.map((e) => ({ id: e.id, institution: map.get(e.institution), level: e.level, major: e.major })),
  }
  return { payload, swap, restore, names: [...map.keys()] }
}

// Pseudonymized profile in the shape the checker reads (descriptions swapped, so bullets compare in the same space).
export const pseudoProfile = (profile, ps) => ({
  ...profile,
  experience: profile.experience.map((e) => ({ ...e, description: ps.swap(e.description) })),
})

// --- prompts ---
const SHAPE = `{
  "skills": ["skill dari daftar skill profil, diurutkan dari yang paling relevan"],
  "experience": [{ "sourceId": "id pengalaman", "bullets": ["butir hasil penyesuaian"] }],
  "education": ["id pendidikan yang relevan"],
  "coverage": { "covered": ["requirement yang terpenuhi profil"], "missing": ["requirement yang tidak ada di profil"] }
}`

const RULES = `Aturan keras:
- Hanya gunakan fakta yang ada di profil. Jangan menambah skill, alat, angka, persen, atau pencapaian yang tidak tertulis di deskripsi pengalaman.
- "skills" hanya boleh berisi nama dari daftar skill profil.
- Tiap butir ditulis ulang dari deskripsi pengalaman asalnya, maksimal 3 butir per pengalaman, dalam bahasa yang sama dengan deskripsi asalnya. Urutkan pengalaman dan butir dari yang paling relevan dengan lowongan.
- Jangan menulis jabatan, nama perusahaan, institusi, atau tanggal. Kode seperti {C1} atau {S1} boleh muncul apa adanya.
- Requirement yang tidak didukung profil masuk "missing"; jangan ditambal.
- Balas hanya JSON, tanpa teks lain, tanpa code fence.`

export const SYSTEM_ONE = `Kamu menyesuaikan CV dengan lowongan. Dari teks lowongan, ambil requirement-nya, lalu pilih dan rapikan isi profil agar selaras.\n${RULES}\nBentuk JSON:\n{ "requirements": ["requirement lowongan, maksimal 8"], ...isi bentuk berikut }\n${SHAPE}`
export const SYSTEM_REQ = `Dari teks lowongan, ambil maksimal 8 requirement terpenting (skill, alat, pengalaman). Balas hanya JSON: { "requirements": ["..."] }`
export const SYSTEM_DRAFT = `Kamu menyesuaikan CV dengan requirement lowongan yang sudah diambil.\n${RULES}\nBentuk JSON:\n${SHAPE}`

export const userOne = (job, payload) => `LOWONGAN\nJudul: ${job.title}\n${job.text}\n\nPROFIL\n${JSON.stringify(payload, null, 1)}`
export const userReq = (job) => `LOWONGAN\nJudul: ${job.title}\n${job.text}`
export const userDraft = (job, requirements, payload) =>
  `LOWONGAN (judul): ${job.title}\nREQUIREMENT:\n${requirements.map((r) => `- ${r}`).join('\n')}\n\nPROFIL\n${JSON.stringify(payload, null, 1)}`

export function parseJson(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1))
    throw new Error('not json')
  }
}

// --- Gemini via the OpenAI-compatible endpoint (same URL the extension uses) ---
const URL_CHAT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

export async function gemini({ key, model, system, user, maxTokens = 6000 }) {
  const started = Date.now()
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(URL_CHAT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    })
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 6000 * (attempt + 1)))
      continue
    }
    const body = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, status: res.status, error: JSON.stringify(body?.error ?? body ?? '').slice(0, 300), ms: Date.now() - started }
    return {
      ok: true,
      text: body?.choices?.[0]?.message?.content ?? '',
      finish: body?.choices?.[0]?.finish_reason,
      inTokens: body?.usage?.prompt_tokens ?? 0,
      outTokens: body?.usage?.completion_tokens ?? 0,
      ms: Date.now() - started,
    }
  }
  return { ok: false, status: 429, error: 'rate limited after retries', ms: Date.now() - started }
}
