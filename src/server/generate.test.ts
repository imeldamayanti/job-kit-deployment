// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError } from '../core/ai/errors'
import { SCORE_SYSTEM, scorePrompt, type ProfileSummary } from '../core/ai/score'
import { CV_SYSTEM, cvUserPrompt } from '../core/tailor/prompt'
import { letterSystem, letterUserPrompt } from '../core/letters/prompt'
import type { GenerateResponse, ScoreJob } from '../core/generate/protocol'
import { handleGenerate } from './generate'
import type { Complete, Db, ServerEnv } from './ports'

const env: ServerEnv = { aiBaseUrl: 'https://ai.example.test/v1', aiKey: 'sk', aiModel: 'deepseek-chat', priceIn: 0.28, priceOut: 0.42, budgetUsd: 50, rateLimit: 30 }
const USER = '11111111-1111-1111-1111-111111111111'
const SECRET = 'RAHASIA-LOWONGAN-XYZ'

const payload = {
  skills: ['React', 'TypeScript'],
  experience: [{ id: 'exp-1', title: 'Software Engineer', company: '{C1}', description: 'Membangun dashboard pelanggan dengan React dan TypeScript.' }],
  education: [{ id: 'edu-1', institution: '{S1}', level: 'S1', major: 'Informatika' }],
}
const cvBody = { kind: 'cv', job: { title: 'Frontend Engineer', description: `Kami mencari engineer React. ${SECRET}` }, payload }
const letterBody = { kind: 'letter', job: { title: 'Frontend Engineer', company: 'Acme', description: `Kami mencari engineer React. ${SECRET}` }, payload, lang: 'id', tone: 'formal' }
const summary: ProfileSummary = { roles: ['Frontend Engineer'], level: 'Mid', skills: ['React'], experience: { titles: ['Software Engineer'], years: 3 }, education: ['S1'], locations: ['Jakarta'], workModes: ['Remote'] }
const scoreJob = (id: string): ScoreJob => ({ id, title: 'Frontend', company: 'Acme', location: 'Remote', workplace: 'remote', level: '', contract: '', salary: '', experience: '', description: 'React' })
const scoreBody = (count: number) => ({ kind: 'score', summary, jobs: Array.from({ length: count }, (_, i) => scoreJob(`j${i}`)) })

const goodCv = JSON.stringify({
  requirements: ['React'], covered: ['React'], skills: ['React'],
  experience: [{ sourceId: 'exp-1', bullets: ['Membangun dashboard pelanggan dengan React untuk {C1}.'] }], education: ['edu-1'],
})
const LETTER_TEXT =
  'Yth. Tim Rekrutmen Acme,\n\nSaya melamar posisi Frontend Engineer di Acme. Di {C1} saya membangun dashboard pelanggan dengan React dan TypeScript, dan saya terbiasa bekerja sama dengan tim produk untuk memastikan setiap fitur berguna bagi pengguna.\n\nSaya senang berdiskusi lebih lanjut tentang kebutuhan tim Anda.'
const goodLetter = JSON.stringify({ letter: LETTER_TEXT })
const scoreRow = (id: string) => ({ id, score: 80, matches: ['React'], gaps: [], summary: 'Cocok.' })
const usage = { inputTokens: 1000, outputTokens: 500 }

type Settle = Parameters<Db['settle']>
function fakes(options: { guard?: Awaited<ReturnType<Db['guard']>>; reserve?: Awaited<ReturnType<Db['reserve']>>; replies?: (string | Error)[] } = {}) {
  const settles: Settle[] = []
  const calls = { reserve: [] as Parameters<Db['reserve']>[], guard: 0, prompts: [] as { system: string; user: string; maxTokens: number }[] }
  const replies = [...(options.replies ?? [])]
  const db: Db = {
    guard: vi.fn(async () => (calls.guard++, options.guard ?? 'ok')),
    reserve: vi.fn(async (...args: Parameters<Db['reserve']>) => (calls.reserve.push(args), options.reserve ?? { ok: true as const, id: 'gen-1' })),
    settle: vi.fn(async (...args: Settle) => (settles.push(args), 9)),
    balance: vi.fn(async () => 4),
  }
  const complete: Complete = vi.fn(async (system, user, maxTokens) => {
    calls.prompts.push({ system, user, maxTokens })
    const next = replies.shift()
    if (next instanceof Error) throw next
    return { text: next ?? '', usage }
  })
  return { db, complete, settles, calls }
}
const run = (body: unknown, deps: ReturnType<typeof fakes>, userId: string | null = USER) =>
  handleGenerate({ userId, body }, { db: deps.db, complete: deps.complete, env })
const expectFailure = (body: GenerateResponse) => {
  if (body.ok) throw new Error('expected a failure')
  return body
}

afterEach(() => vi.restoreAllMocks())

describe('before any credit moves', () => {
  it('refuses a caller with no user: 401, no guard, no reserve', async () => {
    const deps = fakes()
    const { status, body } = await run(cvBody, deps, null)
    expect(status).toBe(401)
    expect(expectFailure(body).error).toBe('unauthenticated')
    expect(deps.db.guard).not.toHaveBeenCalled()
    expect(deps.db.reserve).not.toHaveBeenCalled()
    expect(deps.complete).not.toHaveBeenCalled()
  })

  it('refuses an invalid body: 400, no reserve', async () => {
    const deps = fakes()
    for (const bad of [null, 'cv', { kind: 'chat' }, { ...cvBody, payload: { skills: 'React' } }]) {
      const { status, body } = await run(bad, deps)
      expect(status).toBe(400)
      expect(expectFailure(body).error).toBe('invalid-request')
    }
    expect(deps.db.reserve).not.toHaveBeenCalled()
  })

  it.each(['budget', 'rate-limit'] as const)('stops at the %s guard with 429 and no reserve', async (guard) => {
    const deps = fakes({ guard })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(429)
    expect(expectFailure(body).error).toBe(guard)
    expect(deps.db.guard).toHaveBeenCalledWith(USER, env.budgetUsd, env.rateLimit)
    expect(deps.db.reserve).not.toHaveBeenCalled()
    expect(deps.complete).not.toHaveBeenCalled()
  })

  it.each(['insufficient', 'expired'] as const)('answers 402 %s when the credits cannot be reserved', async (error) => {
    const deps = fakes({ reserve: { ok: false, error } })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(402)
    expect(expectFailure(body)).toMatchObject({ error, credits: 4 })
    expect(deps.complete).not.toHaveBeenCalled()
    expect(deps.settles).toEqual([])
  })

  it('still answers 402 when the balance cannot be read', async () => {
    const deps = fakes({ reserve: { ok: false, error: 'insufficient' } })
    deps.db.balance = async () => { throw new Error('down') }
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(402)
    expect(expectFailure(body).credits).toBeNull()
  })
})

describe('cv', () => {
  it('reserves one credit, charges on success and returns the model text', async () => {
    const deps = fakes({ replies: [goodCv] })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true, kind: 'cv', text: goodCv, fallback: false, credits: 9, usage })
    expect(deps.calls.reserve).toEqual([[USER, 'cv', 1]])
    expect(deps.calls.prompts).toEqual([{ system: CV_SYSTEM, user: cvUserPrompt({ title: cvBody.job.title, description: cvBody.job.description }, payload), maxTokens: 3000 }])
    expect(deps.settles).toHaveLength(1)
    const [id, ok, reason, model, inTok, outTok, cost] = deps.settles[0] as Settle
    expect([id, ok, reason, model, inTok, outTok]).toEqual(['gen-1', true, null, 'deepseek-chat', 1000, 500])
    expect(cost).toBeCloseTo((1000 * 0.28 + 500 * 0.42) / 1e6, 10)
  })

  it('refunds with "ai" and answers 502 when the model fails', async () => {
    const deps = fakes({ replies: [new AiError('server')] })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(502)
    expect(expectFailure(body)).toMatchObject({ error: 'ai', credits: 9 })
    expect(body.ok === false && body.message).toContain('Kreditmu tidak terpakai')
    expect(deps.settles).toEqual([['gen-1', false, 'ai', 'deepseek-chat', 0, 0, 0]])
  })

  it('does not leak the provider failure to the caller', async () => {
    const deps = fakes({ replies: [new AiError('invalid-key')] })
    const { body } = await run(cvBody, deps)
    expect(JSON.stringify(body)).not.toMatch(/kunci|key|quota|kuota/i)
  })

  it('refunds with "unreadable" when the answer is not a CV, and still counts the tokens spent', async () => {
    const deps = fakes({ replies: ['maaf, saya tidak bisa'] })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(502)
    expect(expectFailure(body).error).toBe('unreadable')
    expect(body.ok === false && body.credits).toBe(9)
    const [, ok, reason, , inTok, outTok, cost] = deps.settles[0] as Settle
    expect([ok, reason, inTok, outTok]).toEqual([false, 'unreadable', 1000, 500])
    expect(cost).toBeGreaterThan(0)
  })

  it('refunds with "ungrounded" and returns the violations when the AI adds a skill', async () => {
    const invented = JSON.stringify({ ...JSON.parse(goodCv), skills: ['React', 'Kubernetes'] })
    const deps = fakes({ replies: [invented] })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(422)
    expect(expectFailure(body)).toMatchObject({ error: 'ungrounded', credits: 9, violations: [{ type: 'skill', value: 'Kubernetes', where: 'skills' }] })
    expect(deps.settles[0]?.[1]).toBe(false)
    expect(deps.settles[0]?.[2]).toBe('ungrounded')
  })

  it('refunds with "fallback" but still answers 200 with the text when the AI leaves the experience empty', async () => {
    const empty = JSON.stringify({ ...JSON.parse(goodCv), experience: [] })
    const deps = fakes({ replies: [empty] })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true, kind: 'cv', text: empty, fallback: true, credits: 9, usage })
    expect(deps.settles[0]?.slice(0, 3)).toEqual(['gen-1', false, 'fallback'])
  })

  it('treats an experience whose bullets are all blank as a fallback too', async () => {
    const blank = JSON.stringify({ ...JSON.parse(goodCv), experience: [{ sourceId: 'exp-1', bullets: ['', ' '] }] })
    const deps = fakes({ replies: [blank] })
    const { body } = await run(cvBody, deps)
    expect(body.ok && body.kind === 'cv' && body.fallback).toBe(true)
    expect(deps.settles[0]?.[2]).toBe('fallback')
  })
})

describe('letter', () => {
  it('uses letterSystem(lang, tone), validates on the payload profile and charges on success', async () => {
    const deps = fakes({ replies: [goodLetter] })
    const { status, body } = await run(letterBody, deps)
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true, kind: 'letter', text: goodLetter, fallback: false, credits: 9, usage })
    expect(deps.calls.reserve).toEqual([[USER, 'letter', 1]])
    expect(deps.calls.prompts).toEqual([
      { system: letterSystem('id', 'formal'), user: letterUserPrompt(letterBody.job, payload), maxTokens: 2000 },
    ])
    expect(deps.settles[0]?.slice(0, 3)).toEqual(['gen-1', true, null])
  })

  it('refunds with "ungrounded" when the letter names a tool the payload does not have', async () => {
    const letter = JSON.stringify({ letter: `${LETTER_TEXT}\n\nSaya juga berpengalaman dengan Kubernetes dan Docker.` })
    const deps = fakes({ replies: [letter] })
    const { status, body } = await run(letterBody, deps)
    expect(status).toBe(422)
    const failure = expectFailure(body)
    expect(failure.error).toBe('ungrounded')
    expect(failure.violations?.map((v) => v.value)).toEqual(expect.arrayContaining(['kubernetes', 'docker']))
    expect(deps.settles[0]?.slice(0, 3)).toEqual(['gen-1', false, 'ungrounded'])
  })

  it('refunds with "unreadable" when the letter is too short', async () => {
    const deps = fakes({ replies: [JSON.stringify({ letter: 'Terlalu pendek.' })] })
    const { body } = await run(letterBody, deps)
    expect(expectFailure(body).error).toBe('unreadable')
    expect(deps.settles[0]?.[2]).toBe('unreadable')
  })

  it('ignores the sign-off the model wrote when it checks the facts', async () => {
    const signed = JSON.stringify({ letter: `${LETTER_TEXT}\n\nHormat saya,\n{NAMA}` })
    const deps = fakes({ replies: [signed] })
    const { body } = await run(letterBody, deps)
    expect(body.ok).toBe(true)
  })
})

describe('score', () => {
  const reply = (ids: string[]) => JSON.stringify(ids.map(scoreRow))

  it('splits ten jobs into two calls of five and merges the results', async () => {
    const deps = fakes({ replies: [reply(['j0', 'j1', 'j2', 'j3', 'j4']), reply(['j5', 'j6', 'j7', 'j8', 'j9'])] })
    const { status, body } = await run(scoreBody(10), deps)
    expect(status).toBe(200)
    expect(deps.complete).toHaveBeenCalledTimes(2)
    const sent = scoreBody(10)
    expect(deps.calls.prompts.map((p) => p.maxTokens)).toEqual([1500, 1500])
    expect(deps.calls.prompts.every((p) => p.system === SCORE_SYSTEM)).toBe(true)
    expect(deps.calls.prompts.map((p) => p.user).sort()).toEqual(
      [scorePrompt(summary, sent.jobs.slice(0, 5)), scorePrompt(summary, sent.jobs.slice(5))].sort(),
    )
    expect(body.ok && body.kind === 'score' && body.results.map((r) => r.id)).toEqual(['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9'])
    expect(body.ok && body.usage).toEqual({ inputTokens: 2000, outputTokens: 1000 })
    expect(deps.calls.reserve).toEqual([[USER, 'score', 1]])
    const [, ok, reason, , inTok, outTok, cost] = deps.settles[0] as Settle
    expect([ok, reason, inTok, outTok]).toEqual([true, null, 2000, 1000])
    expect(cost).toBeCloseTo((2000 * 0.28 + 1000 * 0.42) / 1e6, 10)
  })

  it('makes one call for five jobs or fewer', async () => {
    const deps = fakes({ replies: [reply(['j0', 'j1'])] })
    await run(scoreBody(2), deps)
    expect(deps.complete).toHaveBeenCalledTimes(1)
  })

  it('validates each batch: out-of-range scores and ids from another batch are dropped', async () => {
    const mixed = JSON.stringify([scoreRow('j0'), { ...scoreRow('j1'), score: 150 }, scoreRow('j9')])
    const deps = fakes({ replies: [mixed, reply(['j5'])] })
    const { body } = await run(scoreBody(10), deps)
    expect(body.ok && body.kind === 'score' && body.results.map((r) => r.id)).toEqual(['j0', 'j5'])
  })

  it('refunds everything and returns no results when one batch fails', async () => {
    const deps = fakes({ replies: [reply(['j0', 'j1', 'j2', 'j3', 'j4']), new AiError('network')] })
    const { status, body } = await run(scoreBody(10), deps)
    expect(status).toBe(502)
    const failure = expectFailure(body)
    expect(failure).toMatchObject({ error: 'ai', credits: 9 })
    expect('results' in failure).toBe(false)
    expect(deps.settles).toHaveLength(1)
    const [, ok, reasonCode, , inTok, outTok] = deps.settles[0] as Settle
    // The batch that did answer was paid for, so its tokens still count toward the monthly budget.
    expect([ok, reasonCode, inTok, outTok]).toEqual([false, 'ai', 1000, 500])
  })

  it('refunds with "unreadable" when a batch comes back with nothing usable', async () => {
    const deps = fakes({ replies: [reply(['j0']), 'bukan json'] })
    const { body } = await run(scoreBody(10), deps)
    expect(expectFailure(body).error).toBe('unreadable')
    expect(deps.settles[0]?.[2]).toBe('unreadable')
  })
})

describe('when something unexpected throws', () => {
  it('never leaves a reservation unsettled: refunds with "ai" and answers a generic 500', async () => {
    const deps = fakes({ replies: [goodCv] })
    deps.db.settle = vi.fn(async (...args: Settle) => {
      deps.settles.push(args)
      if (args[1]) throw new Error('connection reset secret-detail')
      return 9
    })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(500)
    expect(expectFailure(body)).toMatchObject({ error: 'ai', credits: 9 })
    expect(JSON.stringify(body)).not.toContain('secret-detail')
    expect(deps.settles.map((s) => [s[1], s[2]])).toEqual([[true, null], [false, 'ai']])
  })

  it('refunds when the model throws something that is not an AiError', async () => {
    const deps = fakes({ replies: [new TypeError('boom')] })
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(502)
    expect(expectFailure(body).error).toBe('ai')
    expect(deps.settles[0]?.slice(0, 3)).toEqual(['gen-1', false, 'ai'])
  })

  it('answers 500 with no credits when even the refund fails', async () => {
    const deps = fakes({ replies: [new AiError('server')] })
    deps.db.settle = async () => { throw new Error('db down') }
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(500)
    expect(expectFailure(body)).toMatchObject({ error: 'ai', credits: null })
  })

  it.each(['guard', 'reserve'] as const)('answers a generic 500 when %s throws, with nothing to settle', async (name) => {
    const deps = fakes()
    deps.db[name] = async () => { throw new Error('db down secret-detail') }
    const { status, body } = await run(cvBody, deps)
    expect(status).toBe(500)
    expect(expectFailure(body)).toMatchObject({ error: 'ai', credits: null })
    expect(JSON.stringify(body)).not.toContain('secret-detail')
    expect(deps.settles).toEqual([])
    expect(deps.complete).not.toHaveBeenCalled()
  })

  it('reports the error to the optional hook, never the request body', async () => {
    const deps = fakes({ replies: [new TypeError('boom')] })
    const seen: [string, unknown][] = []
    await handleGenerate({ userId: USER, body: cvBody }, { db: deps.db, complete: deps.complete, env, report: (stage, error) => seen.push([stage, error]) })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.[0]).toBe('model')
    expect(JSON.stringify(seen)).not.toContain(SECRET)
  })
})

describe('privacy of the request', () => {
  it('writes nothing from the posting to the console, on success or failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}))
    await run(cvBody, fakes({ replies: [goodCv] }))
    await run(cvBody, fakes({ replies: [new AiError('server')] }))
    await run(letterBody, fakes({ replies: ['bukan json'] }))
    await run({ ...cvBody, payload: null }, fakes())
    const written = JSON.stringify(spies.flatMap((s) => s.mock.calls))
    expect(written).not.toContain(SECRET)
    expect(written).not.toContain('Membangun dashboard')
  })
})

describe('the server folder', () => {
  it('imports nothing from wxt, browser or Deno', () => {
    const dir = __dirname
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    expect(files).toEqual(expect.arrayContaining(['db.ts', 'generate.ts', 'model.ts', 'ports.ts']))
    for (const name of files) {
      const source = readFileSync(join(dir, name), 'utf8')
      expect(source, name).not.toMatch(/from\s+['"](?:wxt|wxt\/[^'"]*|webextension-polyfill)['"]/)
      expect(source, name).not.toMatch(/\bbrowser\./)
      expect(source, name).not.toMatch(/\bDeno\b/)
    }
  })
})
