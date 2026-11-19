import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { buildProfileSummary, hashSummary } from '../core/ai/score'
import type { Application } from '../core/applications/types'
import { createDefaultSettings } from '../core/feed/settings'
import type { Job } from '../core/feed/types'
import { RemoteRefusal, SCORE_BATCH, type GenerateRequest, type GenerateResponse } from '../core/generate/protocol'
import { createEmptyProfile } from '../core/profile/profile'
import { SAMPLE_WEB_DEV } from '../core/tailor/sample-profiles'

vi.mock('./account', () => ({ callGenerate: vi.fn(), noteCredits: vi.fn(), loadAccountStatus: vi.fn() }))
vi.mock('./sync', () => ({ storedUserId: vi.fn(), currentSession: vi.fn() }))
vi.mock('./ai-client', () => ({ clientWithPermission: vi.fn() }))

import { callGenerate, loadAccountStatus, noteCredits } from './account'
import { clientWithPermission } from './ai-client'
import { loadApplicationData, loadDocumentUsage, saveApplications } from './application-storage'
import { loadFeed, loadState, saveFeed, saveSettings } from './feed-storage'
import { buildLetter, letterStatus } from './letter'
import { describeScore, doneLine, remoteDocument, remoteScore, scoreTopWithAi } from './remote'
import { saveProfile } from './storage'
import { storedUserId } from './sync'
import { buildCv, cvStatus, isRejection } from './tailor'

const NOW = new Date(2026, 9, 15, 10, 0)
const AT = NOW.toISOString()
const USAGE = { inputTokens: 700, outputTokens: 150 }
const SUMMARY = { roles: [], level: '' as const, skills: [], experience: { titles: [], years: 0 }, education: [], locations: [], workModes: [] }

const cvAnswer = JSON.stringify({
  requirements: ['Pengalaman React'],
  skills: ['React'],
  experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React untuk {C1}.'] }],
  education: ['edu-a1'],
})
const emptyAnswer = JSON.stringify({ requirements: ['Pengalaman React'], skills: ['React'], experience: [], education: [] })
const letterAnswer = JSON.stringify({
  letter: [
    'Yth. Tim Rekrutmen Acme,',
    'Saya melamar posisi Frontend Engineer. Di {C1} saya membangun dashboard pelanggan dengan React dan TypeScript, dan saya menikmati bekerja bersama tim produk.',
    'Saya senang bila bisa membawa pengalaman ini ke tim Anda. Terima kasih atas waktu dan perhatian Anda membaca surat saya hari ini.',
  ].join('\n\n'),
})

const ok = (text: string, credits = 41, fallback = false): GenerateResponse => ({ ok: true, kind: 'cv', text, fallback, credits, usage: USAGE })
const refusal = (error: Extract<GenerateResponse, { ok: false }>['error'], credits: number | null = null, message = 'server text'): GenerateResponse => ({ ok: false, error, message, credits })

const generate = vi.mocked(callGenerate)

function app(): Application {
  return {
    id: 'app-1', jobId: 'j1', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT,
    job: { title: 'Frontend Engineer', company: 'Acme', url: 'https://x.test/1', source: 'ashby', description: 'Kami mencari engineer React.', capturedAt: AT },
    events: [{ at: AT, type: 'created' }],
  }
}

function job(id: string, value: number | null, change: Partial<Job> = {}): Job {
  return {
    id, source: 'ashby', title: `Frontend ${id}`, company: 'PT Contoh', location: 'Remote', workplace: 'remote', contract: '', level: '', salary: '', experience: '',
    postedAt: '2026-10-09', deadline: '', url: `https://x.test/${id}`, description: 'React', logoUrl: '', status: 'new', aiFilled: [],
    score: value === null ? null : { value, matches: [], gaps: [], summary: '', rough: true, inputHash: 'old' },
    firstSeenAt: AT, lastSeenAt: AT, ...change,
  }
}

const scoreRows = (request: GenerateRequest) =>
  request.kind === 'score' ? request.jobs.map((item) => ({ id: item.id, score: 88, matches: ['React'], gaps: [], summary: 'Cocok.', fill: {} })) : []

beforeEach(async () => {
  fakeBrowser.reset()
  generate.mockReset()
  vi.mocked(noteCredits).mockReset()
  vi.mocked(loadAccountStatus).mockReset()
  vi.mocked(loadAccountStatus).mockResolvedValue({ credits: 42, paid: false, trialGranted: true, expiresAt: null, checkedAt: AT })
  vi.mocked(storedUserId).mockReset()
  vi.mocked(storedUserId).mockResolvedValue('u1')
  vi.mocked(clientWithPermission).mockReset()
  await saveProfile(SAMPLE_WEB_DEV)
  await saveSettings(createDefaultSettings())
  await saveApplications([app()])
})

describe('remoteDocument', () => {
  const request = { kind: 'cv' as const, job: { title: 'T', description: 'D' }, payload: { skills: [], experience: [], education: [] } }

  it('returns the text and usage, and keeps the cached balance in step with the server', async () => {
    generate.mockResolvedValue(ok('jawaban', 41))
    await expect(remoteDocument(request)).resolves.toEqual({ text: 'jawaban', usage: USAGE })
    expect(noteCredits).toHaveBeenCalledWith(41)
  })

  it('turns a budget refusal into a RemoteRefusal with its own message, and updates the balance it reports', async () => {
    generate.mockResolvedValue(refusal('budget', 42, ''))
    const error = await remoteDocument(request).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RemoteRefusal)
    expect(error).toMatchObject({ code: 'budget', message: 'Layanan AI penuh bulan ini. Kreditmu tidak terpakai.' })
    expect(noteCredits).toHaveBeenCalledWith(42)
  })

  it('says to slow down for the rate limit', async () => {
    generate.mockResolvedValue(refusal('rate-limit'))
    await expect(remoteDocument(request)).rejects.toMatchObject({ code: 'rate-limit', message: 'Terlalu cepat, coba lagi sebentar. Kreditmu tidak terpakai.' })
  })

  it('asks to sign in again when the session is gone, and leaves the cached balance alone', async () => {
    generate.mockResolvedValue(refusal('unauthenticated', null))
    await expect(remoteDocument(request)).rejects.toMatchObject({ code: 'unauthenticated', message: 'Masuk lagi untuk memakai AI.' })
    expect(noteCredits).not.toHaveBeenCalled()
  })

  it('keeps the server message and the violations of a refused document', async () => {
    const violations = [{ kind: 'number' as const, text: '50%' }]
    generate.mockResolvedValue({ ok: false, error: 'ungrounded', message: 'Hasil AI ditolak. Kreditmu tidak terpakai.', credits: 42, violations: violations as never })
    await expect(remoteDocument(request)).rejects.toMatchObject({ code: 'ungrounded', message: 'Hasil AI ditolak. Kreditmu tidak terpakai.', violations })
  })

  it('treats an answer of the wrong kind or without text as a failure of the AI', async () => {
    generate.mockResolvedValue({ ok: true, kind: 'score', results: [], credits: 41, usage: USAGE })
    await expect(remoteDocument(request)).rejects.toMatchObject({ code: 'ai' })
    generate.mockResolvedValue({ ok: true, kind: 'cv', text: 7 as never, fallback: false, credits: 41, usage: USAGE })
    await expect(remoteDocument(request)).rejects.toMatchObject({ code: 'ai' })
  })
})

describe('remoteScore', () => {
  const request = { kind: 'score' as const, summary: SUMMARY, jobs: [job('a', 50), job('b', 40)].map(({ id, title, company, location, workplace, level, contract, salary, experience, description }) => ({ id, title, company, location, workplace, level, contract, salary, experience, description })) }

  it('keeps only valid results for the jobs that were sent', async () => {
    generate.mockResolvedValue({
      ok: true, kind: 'score', credits: 41, usage: USAGE,
      results: [
        { id: 'a', score: 80, matches: ['React'], gaps: [], summary: 'Cocok.', fill: {} },
        { id: 'b', score: 500, matches: [], gaps: [], summary: 'Di luar rentang.', fill: {} },
        { id: 'zzz', score: 70, matches: [], gaps: [], summary: 'Bukan yang dikirim.', fill: {} },
        { id: 'a', score: 10, matches: [], gaps: [], summary: 'Dobel.', fill: {} },
      ],
    })
    const reply = await remoteScore(request)
    expect(reply.results.map((r) => [r.id, r.score])).toEqual([['a', 80]])
    expect(reply.usage).toEqual(USAGE)
    expect(noteCredits).toHaveBeenCalledWith(41)
  })

  it('drops a malformed payload instead of passing it on', async () => {
    generate.mockResolvedValue({ ok: true, kind: 'score', credits: 41, usage: USAGE, results: 'bukan daftar' as never })
    expect((await remoteScore(request)).results).toEqual([])
    generate.mockResolvedValue({ ok: true, kind: 'score', credits: 41, usage: USAGE, results: [{ id: 'a', score: 'tinggi' }, null, 3] as never })
    expect((await remoteScore(request)).results).toEqual([])
  })

  it('refuses with the server reason', async () => {
    generate.mockResolvedValue(refusal('insufficient', 0, 'Kredit tidak cukup.'))
    await expect(remoteScore(request)).rejects.toMatchObject({ code: 'insufficient', message: 'Kredit tidak cukup.' })
    expect(noteCredits).toHaveBeenCalledWith(0)
  })
})

describe('buildCv in the server mode', () => {
  it('asks the server, never the person\'s own provider, and needs no key', async () => {
    generate.mockResolvedValue(ok(cvAnswer))
    const result = await buildCv('app-1', { now: NOW })
    expect(result.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ kind: 'cv' })
    expect(clientWithPermission).not.toHaveBeenCalled()
    const data = await loadApplicationData()
    expect(data.cvs).toHaveLength(1)
    // The names come back from the Profile on this device.
    expect(data.cvs[0]?.experience[0]?.bullets[0]).toBe('Membangun dashboard pelanggan dengan React untuk PT Contoh Teknologi.')
    // Credits replace the daily count.
    expect(await loadDocumentUsage()).toEqual({ date: '', documents: 0 })
  })

  it.each([
    ['budget', 'Layanan AI penuh bulan ini'],
    ['rate-limit', 'Terlalu cepat, coba lagi sebentar'],
    ['unauthenticated', 'Masuk lagi untuk memakai AI'],
  ] as const)('shows a %s refusal as refused and stores nothing', async (code, text) => {
    generate.mockResolvedValue(refusal(code))
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'refused', refused: code })
    expect(result.ok === false && result.message).toContain(text)
    expect((await loadApplicationData()).cvs).toEqual([])
    expect(noteCredits).not.toHaveBeenCalledWith(null)
  })

  it('refuses without a charge on a server fact-check failure, as a rejected document', async () => {
    generate.mockResolvedValue({ ok: false, error: 'ungrounded', message: 'Hasil AI ditolak. Kreditmu tidak terpakai.', credits: 42 })
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'refused', refused: 'ungrounded' })
  })

  it('still checks the answer against the real Profile, whatever the server said', async () => {
    const bad = JSON.stringify({ requirements: ['x'], skills: ['React'], experience: [{ sourceId: 'exp-a1', bullets: ['Memakai Kubernetes untuk memangkas 50%.'] }], education: [] })
    generate.mockResolvedValue(ok(bad))
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'ungrounded' })
    expect((await loadApplicationData()).cvs).toEqual([])
  })

  it('says the CV came from the Profile when the server marks the answer as a fallback', async () => {
    generate.mockResolvedValue(ok(emptyAnswer, 42, true))
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: true, fallback: true, note: 'CV disusun dari profilmu apa adanya; kredit tidak terpakai.' })
  })

  it('has no note when the answer is a normal one', async () => {
    generate.mockResolvedValue(ok(cvAnswer))
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: true, note: null })
  })

  it('does not call the server when the balance is 0', async () => {
    vi.mocked(loadAccountStatus).mockResolvedValue({ credits: 0, paid: false, trialGranted: true, expiresAt: null, checkedAt: AT })
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'blocked', block: 'no-credits', message: 'Kredit tidak cukup.' })
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not ask about training data: the server model is ours', async () => {
    generate.mockResolvedValue(ok(cvAnswer))
    const result = await buildCv('app-1', { now: NOW })
    expect(result.ok || result.reason !== 'notice').toBe(true)
  })

  it('never sets the key problem of the feed state', async () => {
    generate.mockResolvedValue(refusal('ai', 42, 'AI sedang gangguan. Kreditmu tidak terpakai.'))
    const result = await buildCv('app-1', { now: NOW })
    expect(result).toMatchObject({ ok: false, reason: 'refused', refused: 'ai', message: 'AI sedang gangguan. Kreditmu tidak terpakai.' })
    expect((await loadState()).aiProblem).toBeNull()
  })
})

describe('buildLetter in the server mode', () => {
  it('asks the server and stores the letter', async () => {
    generate.mockResolvedValue({ ok: true, kind: 'letter', text: letterAnswer, fallback: false, credits: 41, usage: USAGE })
    const result = await buildLetter('app-1', { now: NOW, lang: 'id' })
    expect(result.ok).toBe(true)
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ kind: 'letter', lang: 'id', tone: 'formal' })
    expect(clientWithPermission).not.toHaveBeenCalled()
    expect((await loadApplicationData()).letters).toHaveLength(1)
  })

  it('shows a refusal as refused', async () => {
    generate.mockResolvedValue(refusal('budget'))
    expect(await buildLetter('app-1', { now: NOW })).toMatchObject({ ok: false, reason: 'refused', refused: 'budget' })
  })
})

describe('availability in the server mode', () => {
  it('is on with credits left, whatever the key or the daily limit', async () => {
    expect(await cvStatus('app-1', NOW)).toEqual({ ok: true })
    expect(await letterStatus('app-1', NOW)).toEqual({ ok: true })
  })

  it('is on when the balance is not known yet: the server decides', async () => {
    vi.mocked(loadAccountStatus).mockResolvedValue(null)
    expect(await cvStatus('app-1', NOW)).toEqual({ ok: true })
  })

  it('asks to sign in when nobody is signed in', async () => {
    vi.mocked(storedUserId).mockResolvedValue(null)
    expect(await cvStatus('app-1', NOW)).toMatchObject({ ok: false, reason: 'signed-out', message: 'Masuk untuk memakai' })
  })

  it('names the offline reason', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await cvStatus('app-1', NOW)).toMatchObject({ ok: false, reason: 'offline', message: 'Tidak ada koneksi internet. Sambungkan dulu untuk memakai AI.' })
    online.mockRestore()
  })

  it('is off with no credits left', async () => {
    vi.mocked(loadAccountStatus).mockResolvedValue({ credits: 0, paid: true, trialGranted: true, expiresAt: null, checkedAt: AT })
    expect(await cvStatus('app-1', NOW)).toMatchObject({ ok: false, reason: 'no-credits', message: 'Kredit tidak cukup.', link: 'none' })
  })
})

describe('scoreTopWithAi', () => {
  it('sends exactly the ten best roughly scored jobs in one call, and keeps what comes back', async () => {
    const jobs = [
      ...Array.from({ length: 12 }, (_, i) => job(`r${i}`, 10 + i)),
      job('hidden', 99, { status: 'hidden' }),
      job('ai', 95, { score: { value: 95, matches: [], gaps: [], summary: 's', rough: false, inputHash: hashSummary(buildProfileSummary(SAMPLE_WEB_DEV, NOW)) } }),
    ]
    await saveFeed(jobs)
    // The job whose AI score is still for this profile is not asked again; stale AI scores would be.
    generate.mockImplementation(async (request) => ({ ok: true, kind: 'score', results: scoreRows(request) as never, credits: 41, usage: USAGE }))

    const outcome = await scoreTopWithAi(NOW)

    expect(generate).toHaveBeenCalledTimes(1)
    const sent = generate.mock.calls[0]?.[0]
    expect(sent?.kind).toBe('score')
    const ids = sent?.kind === 'score' ? sent.jobs.map((j) => j.id) : []
    expect(ids).toHaveLength(SCORE_BATCH)
    expect(ids).toEqual(['r11', 'r10', 'r9', 'r8', 'r7', 'r6', 'r5', 'r4', 'r3', 'r2'])
    expect(outcome).toEqual({ scored: 10 })
    const feed = await loadFeed()
    expect(feed.filter((j) => j.score && !j.score.rough).map((j) => j.id).sort()).toEqual(['ai', 'r10', 'r11', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'].sort())
    expect(feed.find((j) => j.id === 'r0')?.score?.rough).toBe(true)
    expect(feed.find((j) => j.id === 'hidden')?.score?.value).toBe(99)
  })

  it('sends fewer when fewer need it, and ones without any score yet go last', async () => {
    await saveFeed([job('x', null), job('y', 30), job('z', 60)])
    generate.mockImplementation(async (request) => ({ ok: true, kind: 'score', results: scoreRows(request) as never, credits: 41, usage: USAGE }))
    await scoreTopWithAi(NOW)
    const sent = generate.mock.calls[0]?.[0]
    expect(sent?.kind === 'score' && sent.jobs.map((j) => j.id)).toEqual(['z', 'y', 'x'])
  })

  it('does not call the server, or charge, when nothing needs scoring', async () => {
    await saveFeed([job('h', 50, { status: 'hidden' })])
    expect(await scoreTopWithAi(NOW)).toEqual({ scored: 0 })
    expect(generate).not.toHaveBeenCalled()
  })

  it('reports the refusal and leaves the feed as it was', async () => {
    const before = [job('a', 50), job('b', 40)]
    await saveFeed(before)
    generate.mockResolvedValue(refusal('budget'))
    expect(await scoreTopWithAi(NOW)).toEqual({ scored: 0, refused: 'budget', message: 'Layanan AI penuh bulan ini. Kreditmu tidak terpakai.' })
    expect(await loadFeed()).toEqual(before)
  })

  it('reports the cost-free failure of the AI with the server message', async () => {
    await saveFeed([job('a', 50)])
    generate.mockResolvedValue(refusal('ai', 42, 'AI sedang gangguan. Kreditmu tidak terpakai.'))
    expect(await scoreTopWithAi(NOW)).toEqual({ scored: 0, refused: 'ai', message: 'AI sedang gangguan. Kreditmu tidak terpakai.' })
  })
})

// Guards the profile helper used above against drifting from what buildCv reads.
it('has a Profile with experience for the tests', () => {
  expect(SAMPLE_WEB_DEV.experience.length).toBeGreaterThan(0)
  expect(createEmptyProfile().experience).toEqual([])
})

describe('doneLine', () => {
  it('reports the balance the server last gave', async () => {
    vi.mocked(loadAccountStatus).mockResolvedValue({ credits: 41, paid: false, trialGranted: true, expiresAt: null, checkedAt: AT })
    expect(await doneLine('CV')).toBe('CV siap. 1 kredit terpakai, sisa 41.')
    expect(await doneLine('Surat')).toBe('Surat siap. 1 kredit terpakai, sisa 41.')
  })

  it('leaves the balance out when it is not known', async () => {
    vi.mocked(loadAccountStatus).mockResolvedValue(null)
    expect(await doneLine('CV')).toBe('CV siap. 1 kredit terpakai.')
  })
})

describe('describeScore', () => {
  it('says how many were scored and what is left', () => {
    expect(describeScore({ scored: 10 }, 41)).toEqual({ ok: true, text: '10 lowongan dinilai. 1 kredit terpakai, sisa 41.' })
    expect(describeScore({ scored: 4 }, null)).toEqual({ ok: true, text: '4 lowongan dinilai. 1 kredit terpakai.' })
  })

  it('says why nothing was spent', () => {
    expect(describeScore({ scored: 0 }, 41)).toEqual({ ok: true, text: 'Tidak ada lowongan yang perlu dinilai AI.' })
    expect(describeScore({ scored: 0, refused: 'ai', message: 'AI sedang gangguan. Kreditmu tidak terpakai.' }, 41)).toEqual({ ok: false, text: 'AI sedang gangguan. Kreditmu tidak terpakai.' })
    expect(describeScore({ scored: 0, refused: 'insufficient' }, 0)).toEqual({ ok: false, text: 'Kredit tidak cukup.' })
  })
})

describe('isRejection', () => {
  it('is true for a fact-check or unreadable answer, whether our own check or the server\'s said so', () => {
    expect(isRejection({ reason: 'ungrounded' })).toBe(true)
    expect(isRejection({ reason: 'unreadable' })).toBe(true)
    expect(isRejection({ reason: 'refused', refused: 'ungrounded' })).toBe(true)
    expect(isRejection({ reason: 'refused', refused: 'unreadable' })).toBe(true)
  })

  it('is false for the rest: no credits, the ceiling, a failure of the AI', () => {
    for (const refused of ['budget', 'rate-limit', 'insufficient', 'unauthenticated', 'ai', 'expired']) expect(isRejection({ reason: 'refused', refused })).toBe(false)
    expect(isRejection({ reason: 'ai' })).toBe(false)
    expect(isRejection({ reason: 'blocked' })).toBe(false)
  })
})
