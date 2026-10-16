import { describe, expect, it } from 'vitest'
import { AiError } from '../ai/errors'
import type { ScoringClient } from '../ai/score'
import type { Application } from '../applications/types'
import { profileHash } from '../tailor/hash'
import { SAMPLE_WEB_DEV } from '../tailor/sample-profiles'
import { writeLetter } from './pipeline'

const AT = '2026-10-16T08:00:00.000Z'
const ENGLISH = 'We are looking for a frontend engineer with experience in building web applications. You will work with our product team and use React.'
const application = (change: Partial<Application['job']> = {}): Application => ({
  id: 'app-1', jobId: 'j1', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', events: [], createdAt: AT, updatedAt: AT,
  job: { title: 'Frontend Engineer', company: 'Acme', url: 'https://x.test/1', source: 'ashby', description: ENGLISH, capturedAt: AT, ...change },
})

const LETTER = [
  'Dear Hiring Team at Acme,',
  'I am applying for the Frontend Engineer role. At PT Contoh Teknologi I build customer dashboards with React and TypeScript, and I raised test coverage from 40% to 70% with Jest.',
  'I would be glad to bring this experience to your product team. Thank you for your time.',
].join('\n\n')

type Request = Parameters<ScoringClient['complete']>[0]
function fake(reply: unknown | (() => never), usage = { inputTokens: 700, outputTokens: 260 }) {
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

const run = (client: ScoringClient, change: Partial<Parameters<typeof writeLetter>[0]> = {}) =>
  writeLetter({ profile: SAMPLE_WEB_DEV, application: application(), client, key: 'k-test', model: 'model-x', now: new Date(AT), newId: () => 'l-1', ...change })

describe('writeLetter', () => {
  it('writes an English letter for an English posting with one call', async () => {
    const { client, requests } = fake({ letter: LETTER })
    const result = await run(client)
    expect(requests).toHaveLength(1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.usage).toEqual({ inputTokens: 700, outputTokens: 260 })
    expect(result.letter).toMatchObject({ id: 'l-1', applicationId: 'app-1', createdAt: AT, lang: 'en', tone: 'formal', edited: false, profileHash: profileHash(SAMPLE_WEB_DEV) })
    expect(requests[0]?.system).toMatch(/English/)
  })

  it('puts the name in the closing locally, and never sends it', async () => {
    const { client, requests } = fake({ letter: LETTER })
    const result = await run(client)
    expect(result.ok && result.letter.body.endsWith('Sincerely,\nSari Contohwati')).toBe(true)
    expect(result.ok && result.letter.aiBody).toBe(result.ok ? result.letter.body : '')
    const sent = `${requests[0]?.system}\n${requests[0]?.user}`
    for (const secret of ['Sari', 'Contohwati', 'example.test', '081200000000', 'PT Contoh Teknologi', 'Universitas Contoh Nusantara']) expect(sent).not.toContain(secret)
  })

  it('puts the real employer back where the model used its code', async () => {
    const { client } = fake({ letter: LETTER.replace('PT Contoh Teknologi', '{C1}') })
    const result = await run(client)
    expect(result.ok && result.letter.body).toContain('At PT Contoh Teknologi I build')
    expect(result.ok && result.letter.body).not.toContain('{C1}')
  })

  it('does not refuse a letter for the placeholder or name the model put under its own sign-off', async () => {
    const { client } = fake({ letter: `${LETTER}\n\nSincerely,\n{NAMA}` })
    const result = await run(client)
    expect(result.ok).toBe(true)
    expect(result.ok && result.letter.body.endsWith('Thank you for your time.\n\nSincerely,\nSari Contohwati')).toBe(true)
    const other = await run(fake({ letter: `${LETTER}\n\nBest regards,\nBUDI SANTOSO` }).client)
    expect(other.ok && other.letter.body.endsWith('Sincerely,\nSari Contohwati')).toBe(true)
  })

  it('still checks the facts above the sign-off', async () => {
    const { client } = fake({ letter: `${LETTER.replace('with Jest', 'with Docker')}\n\nSincerely,\n{NAMA}` })
    expect(await run(client)).toMatchObject({ ok: false, reason: 'ungrounded' })
  })

  it('writes an Indonesian letter for an Indonesian posting', async () => {
    const { client, requests } = fake({ letter: LETTER })
    const result = await run(client, { application: application({ description: 'Kami mencari engineer yang memiliki pengalaman membangun aplikasi web dan bisa bekerja sama dalam tim.' }) })
    expect(result.ok && result.letter.lang).toBe('id')
    expect(requests[0]?.system).toMatch(/Indonesia/)
    expect(result.ok && result.letter.body.endsWith('Hormat saya,\nSari Contohwati')).toBe(true)
  })

  it('follows the language and tone the person chose', async () => {
    const { client, requests } = fake({ letter: LETTER })
    const result = await run(client, { lang: 'id', tone: 'casual' })
    expect(result.ok && [result.letter.lang, result.letter.tone]).toEqual(['id', 'casual'])
    expect(requests[0]?.system).toMatch(/santai/i)
    expect(result.ok && result.letter.body.endsWith('Salam hangat,\nSari Contohwati')).toBe(true)
  })

  it('makes no call and no letter without the posting text', async () => {
    const { client, requests } = fake({ letter: LETTER })
    const result = await run(client, { application: application({ description: '  ' }) })
    expect(requests).toHaveLength(0)
    expect(result).toMatchObject({ ok: false, reason: 'no-text' })
  })

  it('reports why when the provider fails, with no letter', async () => {
    const { client } = fake(() => {
      throw new AiError('invalid-key')
    })
    const result = await run(client)
    expect(result).toMatchObject({ ok: false, reason: 'ai', ai: 'invalid-key' })
    expect(!result.ok && result.message).toMatch(/kunci/i)
    expect(!result.ok && result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it('refuses an answer that is not a letter, but keeps the usage', async () => {
    const { client } = fake('Ini bukan JSON')
    const result = await run(client)
    expect(result).toMatchObject({ ok: false, reason: 'unreadable', usage: { inputTokens: 700, outputTokens: 260 } })
  })

  it('refuses the whole letter when it holds facts the Profile does not (FR-40)', async () => {
    const { client } = fake({ letter: LETTER.replace('with Jest', 'with Jest and Kubernetes').replace('40%', '45%') })
    const result = await run(client)
    expect(result).toMatchObject({ ok: false, reason: 'ungrounded' })
    if (result.ok) return
    expect(result.message).toContain('Hasil AI ditolak')
    expect(result.message).toContain('"kubernetes"')
    expect(result.message).toContain('"45"')
    expect(result.violations?.map((v) => v.type).sort()).toEqual(['number', 'term'])
  })

  it('does not take the posting\'s own tools as the person\'s', async () => {
    const { client } = fake({ letter: LETTER.replace('Thank you', 'I have not used GraphQL in production. Thank you') })
    const result = await run(client, { application: application({ description: `${ENGLISH} Experience with GraphQL is a plus.` }) })
    expect(result).toMatchObject({ ok: false, reason: 'ungrounded' })
  })
})
