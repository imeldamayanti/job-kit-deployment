import { describe, expect, it } from 'vitest'
import type { Application } from '../applications/types'
import { AiError } from '../ai/errors'
import type { ScoringClient } from '../ai/score'
import { profileHash } from './hash'
import { tailorCv } from './pipeline'
import { SAMPLE_WEB_DEV } from './sample-profiles'

const AT = '2026-10-15T08:00:00.000Z'
const application = (change: Partial<Application['job']> = {}): Application => ({
  id: 'app-1', jobId: 'j1', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', events: [], createdAt: AT, updatedAt: AT,
  job: { title: 'Frontend Engineer', company: 'Acme', url: 'https://x.test/1', source: 'ashby', description: 'Kami mencari engineer React, TypeScript, dan Kotlin.', capturedAt: AT, ...change },
})

const good = {
  requirements: ['Pengalaman React dan TypeScript', 'Pengalaman Kotlin', 'Bekerja sama dalam tim'],
  covered: ['Pengalaman React dan TypeScript', 'Pengalaman Kotlin', 'Bekerja sama dalam tim'],
  skills: ['React', 'TypeScript'],
  experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript untuk {C1}.', 'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.'] }],
  education: ['edu-a1'],
}

type Request = Parameters<ScoringClient['complete']>[0]
function fake(reply: unknown | (() => never), usage = { inputTokens: 900, outputTokens: 300 }) {
  const requests: Request[] = []
  const client: ScoringClient = {
    complete: async (request) => {
      requests.push(request)
      if (typeof reply === 'function') (reply as () => never)()
      return { text: typeof reply === 'string' ? reply : JSON.stringify(reply), usage }
    },
  }
  return { client, requests }
}

const run = (client: ScoringClient, profile = SAMPLE_WEB_DEV, app = application()) =>
  tailorCv({ profile, application: app, client, key: 'k-test', model: 'model-x', now: new Date(AT), newId: () => 'cv-1' })

describe('tailorCv', () => {
  it('makes a CV with one call, from the Profile and the answer', async () => {
    const { client, requests } = fake(good)
    const result = await run(client)
    expect(requests).toHaveLength(1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.usage).toEqual({ inputTokens: 900, outputTokens: 300 })
    expect(result.fallback).toBe(false)
    expect(result.cv).toMatchObject({
      id: 'cv-1', applicationId: 'app-1', createdAt: AT, profileHash: profileHash(SAMPLE_WEB_DEV), edited: false,
      skills: ['React', 'TypeScript'], education: ['edu-a1'],
    })
    // The code the model echoed is restored before the bullet is kept.
    expect(result.cv.experience).toEqual([{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript untuk PT Contoh Teknologi.', 'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.'] }])
    expect(result.cv.aiVersion).toEqual({ skills: result.cv.skills, experience: result.cv.experience, education: result.cv.education })
  })

  it('reports what the CV covers and what it cannot', async () => {
    const { client } = fake(good)
    const result = await run(client)
    expect(result.ok && result.cv.coverage).toEqual({
      required: ['Pengalaman React dan TypeScript', 'Pengalaman Kotlin', 'Bekerja sama dalam tim'],
      // The model claimed all three; Kotlin is not in the Profile, so only the claim about teamwork stands.
      covered: ['Pengalaman React dan TypeScript', 'Bekerja sama dalam tim'],
      missing: ['Pengalaman Kotlin'],
    })
  })

  it('sends no identity and no employer or school name, and uses the model and key it was given', async () => {
    const { client, requests } = fake(good)
    await run(client)
    const request = requests[0] as Request
    expect(request.key).toBe('k-test')
    expect(request.model).toBe('model-x')
    const sent = `${request.system}\n${request.user}`
    for (const value of ['Sari', 'Contohwati', 'sari@example.test', '081200000000', 'PT Contoh Teknologi', 'Contoh Digital', 'Universitas Contoh Nusantara']) expect(sent, value).not.toContain(value)
    expect(request.user).toContain('Kami mencari engineer React')
  })

  it('rejects an answer with an invented Kubernetes and 50%: no CV, the reason says what', async () => {
    const bad = { ...good, experience: [{ sourceId: 'exp-a1', bullets: ['Mengelola cluster Kubernetes dan memangkas waktu deploy 50%.'] }] }
    const result = await run(fake(bad).client)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('ungrounded')
    expect(result.violations?.map((v) => `${v.type}:${v.value}`).sort()).toEqual(['number:50', 'term:kubernetes'])
    expect(result.message).toContain('tidak ada di')
    expect(result.message).toContain('kubernetes')
    expect(result.message).toContain('50')
    expect(result.usage).toEqual({ inputTokens: 900, outputTokens: 300 })
  })

  it('rejects a skill outside the Profile and an unknown sourceId', async () => {
    const bad = { ...good, skills: ['React', 'Kotlin'], experience: [{ sourceId: 'exp-zzz', bullets: ['x'] }] }
    const result = await run(fake(bad).client)
    expect(!result.ok && result.violations?.map((v) => v.type).sort()).toEqual(['skill', 'source'])
  })

  it('rejects a code the run never issued', async () => {
    const bad = { ...good, experience: [{ sourceId: 'exp-a1', bullets: ['Bekerja di {C9}.'] }] }
    const result = await run(fake(bad).client)
    expect(!result.ok && result.reason).toBe('ungrounded')
  })

  it('refuses an answer it cannot read, naming the problem', async () => {
    const result = await run(fake('maaf, tidak bisa').client)
    expect(result).toMatchObject({ ok: false, reason: 'unreadable', message: 'Jawaban penyedia bukan JSON.' })
    const shape = await run(fake({ ...good, skills: 'React' }).client)
    expect(shape).toMatchObject({ ok: false, reason: 'unreadable', message: 'Jawaban penyedia tidak berbentuk CV: skills.' })
  })

  it('names the provider problem, and keeps the reason for the screen', async () => {
    const rejected = await run(fake(() => { throw new AiError('invalid-key') }).client)
    expect(rejected).toMatchObject({ ok: false, reason: 'ai', ai: 'invalid-key', message: 'Kunci ditolak penyedia.' })
    const quota = await run(fake(() => { throw new AiError('quota') }).client)
    expect(quota).toMatchObject({ ok: false, reason: 'ai', ai: 'quota' })
    const network = await run(fake(() => { throw new TypeError('boom') }).client)
    expect(network).toMatchObject({ ok: false, reason: 'ai', ai: 'network' })
    expect(!rejected.ok && rejected.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it('falls back to the Profile as written when the model returns no bullets (T45: small models do)', async () => {
    const empty = { requirements: ['React'], skills: [], experience: [], education: [] }
    const result = await run(fake(empty).client)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fallback).toBe(true)
    expect(result.cv.experience.map((e) => e.sourceId)).toEqual(['exp-a1', 'exp-a2'])
    expect(result.cv.experience[0]?.bullets[0]).toBe('Membangun fitur dashboard pelanggan dengan React dan TypeScript.')
    expect(result.cv.skills).toEqual(SAMPLE_WEB_DEV.skills.map((s) => s.name))
    expect(result.cv.education).toEqual(['edu-a1'])
  })

  it('ignores a company or date the model volunteers', async () => {
    const sneaky = { ...good, experience: [{ sourceId: 'exp-a1', company: 'PT Karangan', start: '1999-01', bullets: ['Membangun dashboard dengan React.'] }] }
    const result = await run(fake(sneaky).client)
    expect(result.ok && JSON.stringify(result.cv)).not.toContain('Karangan')
  })

  it('does not call the model for a posting without text', async () => {
    const { client, requests } = fake(good)
    const result = await run(client, SAMPLE_WEB_DEV, application({ description: '  ' }))
    expect(result).toMatchObject({ ok: false, reason: 'no-text' })
    expect(requests).toHaveLength(0)
  })
})
