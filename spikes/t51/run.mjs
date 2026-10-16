// T51 spike: does the "no tools outside the Profile" rule cost too many refusals, and how do the letters read?
// Runs the real writeLetter (prompt, privacy, fact check) against Gemini. 3 profiles x 3 postings x 2 prompts.
//   A = production prompt (bans naming posting tools the Profile lacks)   B = same prompt without that ban
// Usage: npx esbuild spikes/t51/entry.ts --bundle --format=esm --platform=node --outfile=spikes/t51/.bundle.mjs && node spikes/t51/run.mjs [--model gemini-3.6-flash] [--delay 4000]
// Reads GEMINI_API_KEY from .env.local and never prints it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnv, gemini, cost } from '../t45/lib.mjs'
import { loadJobs } from '../t45/jobs.mjs'
import { writeLetter, SAMPLE_PROFILES } from './.bundle.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const model = flag('model', 'gemini-3.6-flash')
const delay = Number(flag('delay', 4000))
const key = loadEnv().GEMINI_API_KEY
if (!key) { console.error('GEMINI_API_KEY di .env.local masih kosong.'); process.exit(1) }

const BAN = /^- Jangan menyebut alat[^\n]*\n/m
const client = (variant) => ({
  complete: async ({ system, user, maxTokens, model: m }) => {
    const sys = variant === 'B' ? system.replace(BAN, '') : system
    const r = await gemini({ key, model: m, system: sys, user, maxTokens: Math.max(maxTokens, 4000) })
    if (!r.ok) {
      // writeLetter turns any thrown error into "network", which hides a quota stop; stop here instead of saving fake failures.
      if (r.status === 429) { console.error('Kuota Gemini habis (429): berhenti, tidak ada hasil yang disimpan.'); process.exit(2) }
      throw new Error(`HTTP ${r.status} ${r.error}`)
    }
    return { text: r.text, usage: { inputTokens: r.inTokens, outputTokens: r.outTokens } }
  },
})

const jobs = loadJobs()
const AT = new Date().toISOString()
const rows = []
for (const variant of ['A', 'B']) {
  for (const [pi, profile] of SAMPLE_PROFILES.entries()) {
    for (const job of jobs) {
      const application = { id: 'x', jobId: null, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', events: [], createdAt: AT, updatedAt: AT,
        job: { title: job.title, company: job.company, url: '', source: 'manual', description: job.text, capturedAt: AT } }
      let result
      try {
        result = await writeLetter({ profile, application, client: client(variant), key, model, now: new Date(), newId: () => 'l' })
      } catch (e) {
        result = { ok: false, reason: 'ai', message: String(e.message).slice(0, 200), usage: { inputTokens: 0, outputTokens: 0 } }
      }
      const row = {
        variant, profile: 'ABC'[pi], profileName: `${profile.personal.firstName} ${profile.personal.lastName}`, job: job.id, jobTitle: job.title, company: job.company,
        ok: result.ok, reason: result.ok ? null : result.reason, message: result.ok ? null : result.message,
        violations: result.ok ? [] : (result.violations ?? []), body: result.ok ? result.letter.body : null, lang: result.ok ? result.letter.lang : null,
        words: result.ok ? result.letter.body.split(/\s+/).length : 0,
        inTokens: result.usage.inputTokens, outTokens: result.usage.outputTokens, usd: cost(model, result.usage.inputTokens, result.usage.outputTokens),
      }
      rows.push(row)
      console.log(variant, row.profile, row.job, row.ok ? `ok ${row.words}w` : `${row.reason}: ${row.violations.map((v) => v.value).join(',') || row.message?.slice(0, 80)}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}
mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
const file = new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${model}.json`, import.meta.url)
writeFileSync(file, JSON.stringify({ model, at: AT, rows }, null, 1))
console.log('saved', file.pathname.split('/').pop())
