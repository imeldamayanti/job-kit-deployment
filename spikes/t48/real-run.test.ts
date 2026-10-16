// T48: one real run of Buat CV against a real posting, to note tokens, time and estimated cost.
// Skipped unless T48_REAL_RUN=1. The key is read from .env.local (git-ignored) and never printed.
//   T48_REAL_RUN=1 T48_MODEL=gemini-3.6-flash npx vitest run spikes/t48
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Application } from '../../src/core/applications/types'
import { htmlToText } from '../../src/core/feed/text'
import { pseudonymize } from '../../src/core/tailor/privacy'
import { tailorCv } from '../../src/core/tailor/pipeline'
import { assemble } from '../../src/core/tailor/grounded'
import { SAMPLE_IT_SUPPORT } from '../../src/core/tailor/sample-profiles'
import { createGeminiClient } from '../../src/platform/ai-client'

const root = process.cwd()
const model = process.env.T48_MODEL ?? 'gemini-3.6-flash'
// USD per 1M tokens, paid tier (ai.google.dev pricing as of 2026-10-14, same table as spikes/t45/lib.mjs).
const PRICES: Record<string, [number, number]> = { 'gemini-3.5-flash-lite': [0.3, 2.5], 'gemini-3.6-flash': [0.75, 3.75] }

function envKey(): string {
  const line = readFileSync(resolve(root, '.env.local'), 'utf8').split('\n').find((l) => l.startsWith('GEMINI_API_KEY='))
  return (line ?? '').slice('GEMINI_API_KEY='.length).trim()
}

const remotive = JSON.parse(readFileSync(resolve(root, 'fixtures/jobs/remotive.json'), 'utf8')) as { jobs: { title: string; company_name: string; description: string }[] }
const posting = remotive.jobs.find((j) => j.title.startsWith('Tier III'))

describe.skipIf(process.env.T48_REAL_RUN !== '1')('T48 real run', () => {
  it('makes a CV for a real posting', async () => {
    expect(posting).toBeDefined()
    const at = new Date().toISOString()
    const application: Application = {
      id: 'real-1', jobId: 'j', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', events: [], createdAt: at, updatedAt: at,
      job: { title: posting!.title, company: posting!.company_name, url: 'https://x.test', source: 'remotive', description: htmlToText(posting!.description), capturedAt: at },
    }
    const profile = SAMPLE_IT_SUPPORT
    const started = Date.now()
    const result = await tailorCv({ profile, application, client: createGeminiClient(undefined, 90000), key: envKey(), model, now: new Date(), newId: () => 'cv-real' })
    const seconds = (Date.now() - started) / 1000
    const price = PRICES[model]
    const cost = price ? (result.usage.inputTokens * price[0] + result.usage.outputTokens * price[1]) / 1e6 : null
    const sent = JSON.stringify(pseudonymize(profile).payload)
    const summary = {
      model, ok: result.ok, seconds, tokens: result.usage, estimatedCostUsd: cost,
      posting: { title: posting!.title, chars: application.job.description.length },
      payloadLeaksIdentity: ['Made', 'Contohan', 'example.test', 'PT Contoh', 'Politeknik Contoh'].some((value) => sent.includes(value)),
      ...(result.ok
        ? {
            fallback: result.fallback, coverage: result.cv.coverage, skills: result.cv.skills,
            bullets: assemble(profile, { skills: result.cv.skills, experience: result.cv.experience, education: result.cv.education }).experience.map((e) => ({ title: e.title, bullets: e.bullets })),
          }
        : { reason: result.reason, message: result.message, ai: result.ai, violations: result.violations }),
    }
    const out = process.env.T48_OUT
    if (out) writeFileSync(out, JSON.stringify(summary, null, 1))
    console.log(`T48_REAL_RUN ${JSON.stringify(summary, null, 1)}`)
  }, 120000)
})
