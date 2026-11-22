import { describe, expect, it } from 'vitest'
import type { Application } from '../applications/types'
import { AiError } from '../ai/errors'
import type { ScoringClient } from '../ai/score'
import { profileHash } from './hash'
import { RemoteRefusal, type CvRequest, type RemoteDocument } from '../generate/protocol'
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
    // The model wrote two bullets for exp-a1; a third comes from the Profile so the job keeps three. The experience the
    // model did not pick (exp-a2) is kept after it, with the Profile's own bullets.
    expect(result.cv.experience).toEqual([
      {
        sourceId: 'exp-a1',
        bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript untuk PT Contoh Teknologi.', 'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.', 'Menulis REST API dengan Node.js dan PostgreSQL.'],
      },
      { sourceId: 'exp-a2', bullets: ['Memperbaiki bug tampilan di situs perusahaan.', 'Membantu memindahkan halaman statis ke React.'] },
    ])
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

  describe('with a remote', () => {
    const remoteWith = (text: unknown, fallback = false) => {
      const requests: CvRequest[] = []
      const remote: RemoteDocument = async (request) => {
        requests.push(request as CvRequest)
        return { text: JSON.stringify(text), usage: { inputTokens: 5, outputTokens: 6 }, fallback }
      }
      return { remote, requests }
    }
    const runRemote = (remote: RemoteDocument, client: ScoringClient) =>
      tailorCv({ profile: SAMPLE_WEB_DEV, application: application(), client, remote, key: '', model: '', now: new Date(AT), newId: () => 'cv-1' })

    it('asks the remote instead of the client, with no name, email or phone', async () => {
      const { client, requests: clientCalls } = fake(good)
      const { remote, requests } = remoteWith(good)
      const result = await runRemote(remote, client)
      expect(clientCalls).toHaveLength(0)
      expect(requests).toHaveLength(1)
      expect(requests[0]).toMatchObject({ kind: 'cv', job: { title: 'Frontend Engineer', description: expect.stringContaining('Kotlin') } })
      const sent = JSON.stringify(requests[0])
      for (const secret of ['Sari', 'Contohwati', 'example.test', '081200000000', 'PT Contoh Teknologi']) expect(sent).not.toContain(secret)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 6 })
      // The rest of the chain is unchanged: the code is restored from the real Profile.
      expect(result.cv.experience[0]?.bullets[0]).toBe('Membangun dashboard pelanggan dengan React dan TypeScript untuk PT Contoh Teknologi.')
    })

    it('still rejects an answer the real Profile does not support', async () => {
      const { client } = fake(good)
      const { remote } = remoteWith({ ...good, skills: ['React', 'Kubernetes'] })
      expect(await runRemote(remote, client)).toMatchObject({ ok: false, reason: 'ungrounded' })
    })

    it('says the credit is spent when the server took it and this device then turns the answer down', async () => {
      const { client } = fake(good)
      const ungrounded = await runRemote(remoteWith({ ...good, skills: ['React', 'Kubernetes'] }).remote, client)
      expect(ungrounded).toMatchObject({ ok: false, reason: 'ungrounded' })
      expect(ungrounded.ok === false && ungrounded.message.endsWith(' 1 kredit sudah terpakai.')).toBe(true)
      expect(ungrounded.ok === false && ungrounded.message).not.toContain('tidak terpakai')
      const unreadable = await runRemote(remoteWith('bukan CV').remote, client)
      expect(unreadable).toMatchObject({ ok: false, reason: 'unreadable' })
      expect(unreadable.ok === false && unreadable.message.endsWith(' 1 kredit sudah terpakai.')).toBe(true)
    })

    it('does not say that when the server marked the answer as a fallback: it took no credit', async () => {
      const { client } = fake(good)
      const result = await runRemote(remoteWith({ ...good, skills: ['React', 'Kubernetes'] }, true).remote, client)
      expect(result.ok === false && result.message).not.toContain('kredit sudah terpakai')
    })

    it('takes the fallback from the flag of the server, not from the content', async () => {
      const { client } = fake(good)
      const empty = { requirements: ['x'], skills: ['React'], experience: [], education: [] }
      const unflagged = await runRemote(remoteWith(empty, false).remote, client)
      expect(unflagged).toMatchObject({ ok: true, fallback: false })
      const flagged = await runRemote(remoteWith(good, true).remote, client)
      expect(flagged).toMatchObject({ ok: true, fallback: true })
    })

    it('turns a refusal into a failure that keeps the code', async () => {
      const { client, requests } = fake(good)
      const remote: RemoteDocument = async () => {
        throw new RemoteRefusal('insufficient', 'Kredit tidak cukup')
      }
      const result = await runRemote(remote, client)
      expect(result).toMatchObject({ ok: false, reason: 'refused', refused: 'insufficient', message: 'Kredit tidak cukup' })
      expect(requests).toHaveLength(0)
    })

    it('keeps the violations of a refusal for the fact checker', async () => {
      const { client } = fake(good)
      const violations = [{ type: 'term' as const, value: 'kubernetes', where: 'exp-a1#1' }]
      const remote: RemoteDocument = async () => {
        throw new RemoteRefusal('ungrounded', 'Ditolak', violations)
      }
      expect(await runRemote(remote, client)).toMatchObject({ ok: false, reason: 'refused', refused: 'ungrounded', violations })
    })

    it('reports a network failure of the remote like one of the provider', async () => {
      const { client } = fake(good)
      const remote: RemoteDocument = async () => {
        throw new TypeError('Failed to fetch')
      }
      expect(await runRemote(remote, client)).toMatchObject({ ok: false, reason: 'ai', ai: 'network' })
    })

    it('does not call the remote for a posting without text', async () => {
      const { client } = fake(good)
      const { remote, requests } = remoteWith(good)
      const result = await tailorCv({ profile: SAMPLE_WEB_DEV, application: application({ description: ' ' }), client, remote, key: '', model: '', now: new Date(AT), newId: () => 'cv-1' })
      expect(result).toMatchObject({ ok: false, reason: 'no-text' })
      expect(requests).toHaveLength(0)
    })
  })
})
