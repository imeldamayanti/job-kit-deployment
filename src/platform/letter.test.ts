import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { AiError } from '../core/ai/errors'
import type { ScoringClient } from '../core/ai/score'
import type { Application } from '../core/applications/types'
import { createDefaultSettings, type FeedSettings } from '../core/feed/settings'
import { profileHash } from '../core/tailor/hash'
import { SAMPLE_WEB_DEV } from '../core/tailor/sample-profiles'
import { loadApplicationData, loadDocumentUsage, saveApplications } from './application-storage'
import { loadAiKey, loadSettings, loadState, saveAiKey, saveSettings } from './feed-storage'
import { buildLetter, letterStatus, restoreLetter, saveLetterEdit } from './letter'
import { buildCv } from './tailor'
import { saveProfile } from './storage'

const NOW = new Date(2026, 9, 16, 10, 0)
const AT = NOW.toISOString()
const ENGLISH = 'We are looking for a frontend engineer with experience in building web applications. You will work with our product team and use React.'
const LETTER = [
  'Dear Hiring Team at Acme,',
  'I am applying for the Frontend Engineer role. At {C1} I build customer dashboards with React and TypeScript, and I raised test coverage from 40% to 70% with Jest.',
  'I would be glad to bring this experience to your product team. Thank you for your time and for reading my letter today.',
].join('\n\n')

function fake(reply: unknown | (() => never)) {
  let calls = 0
  const client: ScoringClient = {
    complete: async () => {
      calls += 1
      if (typeof reply === 'function') (reply as () => never)()
      return { text: JSON.stringify(reply), usage: { inputTokens: 600, outputTokens: 220 } }
    },
  }
  return { client, calls: () => calls }
}

async function seed(change: { description?: string; settings?: Partial<FeedSettings>; key?: string } = {}) {
  await saveProfile(SAMPLE_WEB_DEV)
  await saveAiKey(change.key ?? 'k-test')
  await saveSettings({ ...createDefaultSettings(), ...change.settings })
  const app: Application = {
    id: 'app-1', jobId: 'j1', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT,
    job: { title: 'Frontend Engineer', company: 'Acme', url: 'https://x.test/1', source: 'ashby', description: change.description ?? ENGLISH, capturedAt: AT },
    events: [{ at: AT, type: 'created' }],
  }
  await saveApplications([app])
}

beforeEach(() => {
  fakeBrowser.reset()
})

describe('buildLetter', () => {
  it('stores the letter, links it, notes it in the history, and counts it for today', async () => {
    await seed()
    const result = await buildLetter('app-1', { client: fake({ letter: LETTER }).client, now: NOW })
    expect(result.ok).toBe(true)
    const data = await loadApplicationData()
    expect(data.letters).toHaveLength(1)
    expect(data.applications[0]).toMatchObject({ letterId: data.letters[0]?.id })
    expect(data.applications[0]?.events.at(-1)).toMatchObject({ type: 'letter', text: 'Surat dibuat' })
    expect(data.letters[0]).toMatchObject({ lang: 'en', tone: 'formal', profileHash: profileHash(SAMPLE_WEB_DEV), edited: false })
    expect(data.letters[0]?.body).toContain('At PT Contoh Teknologi I build')
    expect(data.letters[0]?.body.endsWith('Sincerely,\nSari Contohwati')).toBe(true)
    expect(await loadDocumentUsage()).toEqual({ date: '2026-10-16', documents: 1 })
  })

  it('shares the daily limit with the CV', async () => {
    await seed({ settings: { documentLimit: 2 } })
    const cvAnswer = { requirements: ['React'], skills: ['React'], experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard dengan React.'] }], education: ['edu-a1'] }
    await buildCv('app-1', { client: fake(cvAnswer).client, now: NOW })
    const { client, calls } = fake({ letter: LETTER })
    expect((await buildLetter('app-1', { client, now: NOW })).ok).toBe(true)
    const third = await buildLetter('app-1', { client, now: NOW })
    expect(third).toMatchObject({ ok: false, reason: 'blocked', block: 'daily-limit' })
    expect(calls()).toBe(1)
    expect(await letterStatus('app-1', NOW)).toMatchObject({ ok: false, reason: 'daily-limit' })
  })

  it('keeps the earlier letter when the new answer is rejected, and still counts the call', async () => {
    await seed()
    await buildLetter('app-1', { client: fake({ letter: LETTER }).client, now: NOW })
    const before = await loadApplicationData()
    const result = await buildLetter('app-1', { client: fake({ letter: LETTER.replace('with Jest', 'with Kubernetes') }).client, now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'ungrounded' })
    expect(await loadApplicationData()).toEqual(before)
    expect((await loadDocumentUsage()).documents).toBe(2)
  })

  it('does not call the model and says why when the key is missing', async () => {
    await seed({ key: '' })
    const { client, calls } = fake({ letter: LETTER })
    expect(await buildLetter('app-1', { client, now: NOW })).toMatchObject({ ok: false, reason: 'blocked', block: 'no-key' })
    expect(calls()).toBe(0)
  })

  it('remembers a lasting provider problem, not counting the call', async () => {
    await seed()
    const result = await buildLetter('app-1', { client: fake(() => { throw new AiError('quota') }).client, now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'ai', ai: 'quota' })
    expect((await loadState()).aiProblem).toBe('quota')
    expect((await loadDocumentUsage()).documents).toBe(0)
  })

  it('follows the language and tone the person picked', async () => {
    await seed()
    await buildLetter('app-1', { client: fake({ letter: LETTER }).client, now: NOW, lang: 'id', tone: 'casual' })
    const letter = (await loadApplicationData()).letters[0]
    expect(letter).toMatchObject({ lang: 'id', tone: 'casual' })
    expect(letter?.body.endsWith('Salam hangat,\nSari Contohwati')).toBe(true)
  })

  it('asks once per application before a model that may train on the data', async () => {
    await seed({ settings: { ai: { provider: 'opencode-zen', model: 'exo-free' } } })
    const { client, calls } = fake({ letter: LETTER })
    expect(await buildLetter('app-1', { client, now: NOW })).toMatchObject({ ok: false, reason: 'notice' })
    expect(calls()).toBe(0)
    expect((await buildLetter('app-1', { client, now: NOW, acknowledged: true })).ok).toBe(true)
    expect((await buildLetter('app-1', { client, now: NOW })).ok).toBe(true)
  })

  it('does nothing for an application that is not there', async () => {
    await seed()
    expect(await buildLetter('nope', { client: fake({ letter: LETTER }).client, now: NOW })).toMatchObject({ ok: false, reason: 'missing' })
  })

  it('never keeps the key anywhere but the key item', async () => {
    await seed()
    await buildLetter('app-1', { client: fake({ letter: LETTER }).client, now: NOW })
    expect(JSON.stringify(await loadApplicationData())).not.toContain('k-test')
    expect(await loadAiKey()).toBe('k-test')
    expect(JSON.stringify(await loadSettings())).not.toContain('k-test')
  })
})

describe('saveLetterEdit and restoreLetter', () => {
  it('saves a hand edit with the mark, and gives the AI text back', async () => {
    await seed()
    await buildLetter('app-1', { client: fake({ letter: LETTER }).client, now: NOW })
    const stored = (await loadApplicationData()).letters[0]!

    await saveLetterEdit(stored.id, 'Teks saya sendiri.')
    expect((await loadApplicationData()).letters[0]).toMatchObject({ body: 'Teks saya sendiri.', edited: true, aiBody: stored.aiBody })

    await restoreLetter(stored.id)
    expect((await loadApplicationData()).letters[0]).toMatchObject({ body: stored.aiBody, edited: false })
  })

  it('ignores a letter that is gone', async () => {
    await seed()
    expect(await saveLetterEdit('nope', 'x')).toEqual({ ok: true })
    expect(await restoreLetter('nope')).toEqual({ ok: true })
  })
})
