// T45 spike runner. 3 profiles x 3 jobs x {one call, two calls} x models. Reads GEMINI_API_KEY from .env.local; never prints it.
// Usage: node run.mjs --models gemini-3.5-flash-lite,gemini-3.8-flash [--modes one,two] [--mock] [--limit 1]
import { mkdirSync, writeFileSync } from 'node:fs'
import { PROFILES } from './profiles.mjs'
import { loadJobs } from './jobs.mjs'
import { checkOutput, checkCoverage } from './check.mjs'
import { loadEnv, pseudonymize, pseudoProfile, parseJson, gemini, cost, SYSTEM_ONE, SYSTEM_REQ, SYSTEM_DRAFT, userOne, userReq, userDraft } from './lib.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] ?? true : fallback
}
const mock = args.includes('--mock')
const models = String(flag('models', 'gemini-3.5-flash-lite')).split(',')
const modes = String(flag('modes', 'one,two')).split(',')
const limit = Number(flag('limit', 99))
const only = flag('only', null) // e.g. B:J2,C:J1 re-runs just those profile:job pairs
const onlyPairs = only ? new Set(String(only).split(',')) : null
const delayMs = Number(flag('delay', 1500))

const key = mock ? 'mock' : loadEnv().GEMINI_API_KEY
if (!key) {
  console.error('GEMINI_API_KEY di .env.local masih kosong.')
  process.exit(1)
}

// Offline stand-in so the pipeline can be exercised without a key. It fabricates on purpose.
async function call(req) {
  if (!mock) return gemini({ key, ...req })
  const wantsReq = req.system === SYSTEM_REQ
  const out = wantsReq
    ? { requirements: ['Kotlin', '3 tahun Android'] }
    : { requirements: ['Kotlin'], skills: ['React', 'Kotlin'], experience: [{ sourceId: 'exp-a1', bullets: ['Memimpin migrasi ke Kubernetes, memangkas biaya 50%.'] }], education: ['edu-a1'], coverage: { covered: ['Kotlin'], missing: [] } }
  return { ok: true, text: JSON.stringify(out), inTokens: 100, outTokens: 50, ms: 5 }
}

const jobs = loadJobs()
const results = []
let n = 0
for (const model of models) {
  for (const mode of modes) {
    for (const profile of PROFILES) {
      for (const job of jobs) {
        if (onlyPairs && !onlyPairs.has(`${profile.id}:${job.id}`)) continue
        if (n++ >= limit) continue
        const ps = pseudonymize(profile)
        const sentinel = JSON.stringify(ps.payload)
        const leaked = ps.names.filter((name) => sentinel.includes(name))
        if (leaked.length) throw new Error(`pseudonymization leak: ${leaked.join(', ')}`)

        const calls = []
        let parsed = null
        let error = null
        try {
          if (mode === 'one') {
            const r = await call({ model, system: SYSTEM_ONE, user: userOne(job, ps.payload) })
            calls.push(r)
            if (!r.ok) throw new Error(`HTTP ${r.status} ${r.error}`)
            parsed = parseJson(r.text)
          } else {
            const r1 = await call({ model, system: SYSTEM_REQ, user: userReq(job) })
            calls.push(r1)
            if (!r1.ok) throw new Error(`HTTP ${r1.status} ${r1.error}`)
            const req = parseJson(r1.text).requirements ?? []
            const r2 = await call({ model, system: SYSTEM_DRAFT, user: userDraft(job, req, ps.payload) })
            calls.push(r2)
            if (!r2.ok) throw new Error(`HTTP ${r2.status} ${r2.error}`)
            parsed = { requirements: req, ...parseJson(r2.text) }
          }
        } catch (e) {
          error = String(e.message ?? e)
        }

        const inTokens = calls.reduce((s, c) => s + (c.inTokens ?? 0), 0)
        const outTokens = calls.reduce((s, c) => s + (c.outTokens ?? 0), 0)
        let violations = []
        let coverageViolations = []
        let restored = parsed
        if (parsed) {
          // Check in pseudonym space (bullets compare against swapped descriptions), then restore for display.
          const clean = JSON.parse(JSON.stringify(parsed).replace(/\{[CS]\d+\}/g, ''))
          violations = checkOutput(clean, pseudoProfile(profile, ps))
          coverageViolations = checkCoverage(parsed.coverage?.covered, profile)
          restored = JSON.parse(ps.restore(JSON.stringify(parsed)))
        }
        const row = {
          model, mode, profile: profile.id, job: job.id, error, output: restored, violations, coverageViolations,
          inTokens, outTokens, ms: calls.reduce((s, c) => s + (c.ms ?? 0), 0), calls: calls.length,
          estCostUsd: cost(model, inTokens, outTokens),
          finish: calls.map((c) => c.finish).filter(Boolean),
        }
        results.push(row)
        console.log(`${model} ${mode} ${profile.id}x${job.id}: ${error ? 'ERROR ' + error.slice(0, 120) : `${violations.length} pelanggaran, ${inTokens}+${outTokens} tok, ${row.ms} ms`}`)
        if (!mock) await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
}

mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const file = new URL(`./results/${mock ? 'mock-' : ''}${stamp}.json`, import.meta.url)
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), models, modes, jobs: jobs.map(({ id, title, company, text }) => ({ id, title, company, textLength: text.length })), results }, null, 1))
console.log(`Tersimpan: ${file.pathname}`)
