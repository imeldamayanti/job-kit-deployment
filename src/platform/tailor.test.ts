import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { AiError } from '../core/ai/errors'
import type { ScoringClient } from '../core/ai/score'
import type { Application } from '../core/applications/types'
import { createDefaultSettings, type FeedSettings } from '../core/feed/settings'
import { SAMPLE_WEB_DEV } from '../core/tailor/sample-profiles'
import { loadApplicationData, loadDocumentUsage, saveApplications } from './application-storage'
import { loadState, loadAiKey, saveAiKey, saveSettings, saveState, loadSettings } from './feed-storage'
import { buildCv, cvStatus, restoreCv, saveCvEdit } from './tailor'
import { saveProfile } from './storage'

const NOW = new Date(2026, 9, 15, 10, 0)
const AT = NOW.toISOString()

const answer = {
  requirements: ['Pengalaman React'],
  skills: ['React'],
  experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React untuk {C1}.'] }],
  education: ['edu-a1'],
}

function fake(reply: unknown | (() => never)) {
  let calls = 0
  const client: ScoringClient = {
    complete: async () => {
      calls += 1
      if (typeof reply === 'function') (reply as () => never)()
      return { text: JSON.stringify(reply), usage: { inputTokens: 800, outputTokens: 200 } }
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
    job: { title: 'Frontend Engineer', company: 'Acme', url: 'https://x.test/1', source: 'ashby', description: change.description ?? 'Kami mencari engineer React.', capturedAt: AT },
    events: [{ at: AT, type: 'created' }],
  }
  await saveApplications([app])
}

beforeEach(() => {
  fakeBrowser.reset()
})

describe('buildCv', () => {
  it('stores the CV, links it to the application, notes it in the history and counts it for today', async () => {
    await seed()
    const result = await buildCv('app-1', { client: fake(answer).client, now: NOW })
    expect(result.ok).toBe(true)
    const data = await loadApplicationData()
    expect(data.cvs).toHaveLength(1)
    expect(data.applications[0]).toMatchObject({ cvId: data.cvs[0]?.id })
    expect(data.applications[0]?.events.at(-1)).toMatchObject({ type: 'cv', text: 'CV dibuat' })
    expect(data.cvs[0]?.experience[0]?.bullets[0]).toBe('Membangun dashboard pelanggan dengan React untuk PT Contoh Teknologi.')
    expect(await loadDocumentUsage()).toEqual({ date: '2026-10-15', documents: 1 })
  })

  it('returns the tokens so the cost can be noted', async () => {
    await seed()
    const result = await buildCv('app-1', { client: fake(answer).client, now: NOW })
    expect(result.ok && result.usage).toEqual({ inputTokens: 800, outputTokens: 200 })
  })

  it('keeps the earlier CV when the new answer is rejected, and still counts the call', async () => {
    await seed()
    await buildCv('app-1', { client: fake(answer).client, now: NOW })
    const before = await loadApplicationData()
    const bad = { ...answer, experience: [{ sourceId: 'exp-a1', bullets: ['Memakai Kubernetes untuk memangkas 50%.'] }] }

    const result = await buildCv('app-1', { client: fake(bad).client, now: NOW })

    expect(result).toMatchObject({ ok: false, reason: 'ungrounded' })
    expect(await loadApplicationData()).toEqual(before)
    expect((await loadDocumentUsage()).documents).toBe(2)
  })

  it('does not call the model and says why when the key is missing', async () => {
    await seed({ key: '' })
    const { client, calls } = fake(answer)
    const result = await buildCv('app-1', { client, now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'blocked', block: 'no-key' })
    expect(calls()).toBe(0)
    expect((await loadApplicationData()).cvs).toEqual([])
  })

  it('turns the button off after the provider rejects the key, and back on when a new key is saved', async () => {
    await seed()
    const rejected = await buildCv('app-1', { client: fake(() => { throw new AiError('invalid-key') }).client, now: NOW })
    expect(rejected).toMatchObject({ ok: false, reason: 'ai', ai: 'invalid-key' })
    expect((await loadState()).aiProblem).toBe('invalid-key')
    expect(await cvStatus('app-1', NOW)).toMatchObject({ ok: false, reason: 'invalid-key' })
    expect((await loadDocumentUsage()).documents).toBe(0)

    await saveAiKey('k-new')

    expect((await loadState()).aiProblem).toBeNull()
    expect(await cvStatus('app-1', NOW)).toEqual({ ok: true })
  })

  it('stops at the daily limit the person set', async () => {
    await seed({ settings: { documentLimit: 2 } })
    const { client, calls } = fake(answer)
    await buildCv('app-1', { client, now: NOW })
    await buildCv('app-1', { client, now: NOW })
    const third = await buildCv('app-1', { client, now: NOW })
    expect(third).toMatchObject({ ok: false, reason: 'blocked', block: 'daily-limit' })
    expect(third.ok === false && third.message).toBe('Batas 2 panggilan AI hari ini tercapai. Batas kembali tengah malam.')
    expect(calls()).toBe(2)
    // The next day it works again.
    const tomorrow = new Date(2026, 9, 16, 0, 5)
    expect((await buildCv('app-1', { client, now: tomorrow })).ok).toBe(true)
  })

  it('asks once per application before a model that may train on the data, then goes on', async () => {
    await seed({ settings: { ai: { provider: 'opencode-zen', model: 'exo-free' } } })
    const { client, calls } = fake(answer)

    const asked = await buildCv('app-1', { client, now: NOW })
    expect(asked).toMatchObject({ ok: false, reason: 'notice' })
    expect(asked.ok === false && asked.message).toMatch(/melatih/)
    expect(calls()).toBe(0)

    const went = await buildCv('app-1', { client, now: NOW, acknowledged: true })
    expect(went.ok).toBe(true)
    expect((await loadApplicationData()).applications[0]?.aiNoticeAck).toBe('opencode-zen:exo-free')

    // Asked once: the second CV for the same application does not ask again.
    expect((await buildCv('app-1', { client, now: NOW })).ok).toBe(true)
  })

  it('does nothing for an application that is not there', async () => {
    await seed()
    const { client, calls } = fake(answer)
    expect(await buildCv('nope', { client, now: NOW })).toMatchObject({ ok: false, reason: 'missing' })
    expect(calls()).toBe(0)
  })

  it('uses the model and provider from the saved settings', async () => {
    await seed({ settings: { ai: { provider: 'anthropic', model: 'claude-haiku-5-5' } } })
    let seen = ''
    const client: ScoringClient = { complete: async (request) => { seen = `${request.model}|${request.key}`; return { text: JSON.stringify(answer), usage: { inputTokens: 1, outputTokens: 1 } } } }
    await buildCv('app-1', { client, now: NOW })
    expect(seen).toBe('claude-haiku-5-5|k-test')
    expect((await loadSettings()).ai.model).toBe('claude-haiku-5-5')
    expect(await loadAiKey()).toBe('k-test')
  })

  it('keeps the feed state it did not touch', async () => {
    await seed()
    await saveState({ ...(await loadState()), newJobs: 7 })
    await buildCv('app-1', { client: fake(answer).client, now: NOW })
    expect((await loadState()).newJobs).toBe(7)
  })
})

describe('editing a CV (FR-41)', () => {
  async function made() {
    await seed()
    await buildCv('app-1', { client: fake(answer).client, now: NOW })
    return (await loadApplicationData()).cvs[0]!
  }

  it('saves a hand edit, marks the CV edited and keeps the AI version', async () => {
    const cv = await made()
    const result = await saveCvEdit(cv.id, { skills: ['React'], experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard internal.'] }], education: [] })
    expect(result).toEqual({ ok: true })
    const stored = (await loadApplicationData()).cvs[0]!
    expect(stored).toMatchObject({ edited: true, skills: ['React'] })
    expect(stored.experience[0]?.bullets).toEqual(['Membangun dashboard internal.'])
    expect(stored.aiVersion).toEqual(cv.aiVersion)
  })

  it('restores the AI version and clears the mark', async () => {
    const cv = await made()
    await saveCvEdit(cv.id, { skills: [], experience: [], education: [] })
    await restoreCv(cv.id)
    expect((await loadApplicationData()).cvs[0]).toEqual(cv)
  })

  it('does not touch the applications, and does nothing for a CV that is not there', async () => {
    const cv = await made()
    const before = await loadApplicationData()
    await saveCvEdit(cv.id, { skills: ['React'], experience: [], education: [] })
    expect((await loadApplicationData()).applications).toEqual(before.applications)
    const after = await loadApplicationData()
    expect(await saveCvEdit('nope', { skills: [], experience: [], education: [] })).toEqual({ ok: true })
    expect(await loadApplicationData()).toEqual(after)
  })

  it('asks again before Buat ulang only once the CV was edited: the edit is gone after a new CV', async () => {
    const cv = await made()
    await saveCvEdit(cv.id, { skills: ['React'], experience: [], education: [] })
    await buildCv('app-1', { client: fake(answer).client, now: NOW })
    const data = await loadApplicationData()
    expect(data.cvs).toHaveLength(1)
    expect(data.cvs[0]?.edited).toBe(false)
  })
})
