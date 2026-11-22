// Cost spike (2026-11-19): token usage of CV, letter, and score with the real pipelines on long public postings (GitLab, Greenhouse).
// Usage: npx esbuild spikes/cost/entry.ts --bundle --format=esm --platform=node --outfile=spikes/cost/.bundle.mjs && node spikes/cost/run.mjs [--model deepseek-v4.1-flash]
// Reads DEEPSEEK_* from .env.local; never prints the key.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { loadEnv, gemini } from '../t45/lib.mjs'
import { tailorCv, writeLetter, scoreJobs, importIntoFeed, SAMPLE_PROFILES } from './.bundle.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d }
const model = flag('model', 'deepseek-v4.1-flash')
const env = loadEnv()
if (!env.DEEPSEEK_API_KEY) { console.error('DEEPSEEK_API_KEY di .env.local masih kosong.'); process.exit(1) }

const calls = []
const client = {
  complete: async ({ system, user, maxTokens, model: m }) => {
    const r = await gemini({ key: env.DEEPSEEK_API_KEY, url: `${env.DEEPSEEK_BASE_URL}/chat/completions`, model: m, system, user, maxTokens })
    calls.push({ ok: r.ok, inTokens: r.inTokens ?? 0, outTokens: r.outTokens ?? 0, ms: r.ms, promptChars: system.length + user.length })
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.error}`)
    return { text: r.text, usage: { inputTokens: r.inTokens, outputTokens: r.outTokens } }
  },
}

const raw = readFileSync(new URL('./jobs.json', import.meta.url), 'utf8')
const now = new Date()
const jobs = importIntoFeed([], raw, now.toISOString()).feed ?? importIntoFeed([], raw, now.toISOString()).jobs
if (!Array.isArray(jobs) || !jobs.length) throw new Error('import gagal: ' + JSON.stringify(Object.keys(importIntoFeed([], raw, now.toISOString()))))
const AT = now.toISOString()
const appFor = (job) => ({ id: 'x', jobId: null, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', events: [], createdAt: AT, updatedAt: AT,
  job: { title: job.title, company: job.company, url: '', source: 'manual', description: job.description, capturedAt: AT } })

const rows = []
const take = (kind, profile, job, result, from) => {
  const used = calls.slice(from)
  const row = { kind, profile, job: job?.title ?? '10 lowongan', jobChars: job?.description?.length ?? null, ok: result.ok !== false, reason: result.ok === false ? result.reason : null,
    requests: used.length, inTokens: used.reduce((s, c) => s + c.inTokens, 0), outTokens: used.reduce((s, c) => s + c.outTokens, 0), ms: used.reduce((s, c) => s + c.ms, 0) }
  rows.push(row)
  console.log(kind.padEnd(6), profile, String(row.job).slice(0, 40).padEnd(40), row.ok ? 'ok ' : row.reason, `${row.requests} req ${row.inTokens}+${row.outTokens} tok`)
}

const sample = jobs.slice(0, 3)
for (const [pi, profile] of SAMPLE_PROFILES.entries()) {
  for (const job of sample) {
    let from = calls.length
    const cv = await tailorCv({ profile, application: appFor(job), client, key: 'k', model, now, newId: () => 'c' }).catch((e) => ({ ok: false, reason: String(e.message).slice(0, 60) }))
    take('cv', 'ABC'[pi], job, cv, from)
    from = calls.length
    const letter = await writeLetter({ profile, application: appFor(job), client, key: 'k', model, now, newId: () => 'l' }).catch((e) => ({ ok: false, reason: String(e.message).slice(0, 60) }))
    take('letter', 'ABC'[pi], job, letter, from)
  }
  const from = calls.length
  const run = await scoreJobs({ jobs: jobs.slice(0, 10), profile, client, key: 'k', model, now, limit: 10 })
  take('score', 'ABC'[pi], null, { ok: !run.aiProblem, reason: run.aiProblem ?? null }, from)
}
mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
const file = new URL(`./results/${AT.replace(/[:.]/g, '-').slice(0, 19)}-${model}.json`, import.meta.url)
writeFileSync(file, JSON.stringify({ model, at: AT, jobChars: jobs.map((j) => j.description.length), rows }, null, 1))
console.log('saved', file.pathname.split('/').pop())
