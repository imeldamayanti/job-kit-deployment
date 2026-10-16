import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { Application } from '../core/applications/types'
import type { Job, JobStatus } from '../core/feed/types'
import {
  addManualApplication,
  changeApplicationStatus,
  markJobApplied,
  patchApplication,
  prepareApplication,
  recordFill,
  recordOpenedFill,
  removeApplication,
  syncFeedWithApplications,
} from './applications'
import { loadApplicationData, loadApplications, saveApplicationData, saveApplications } from './application-storage'
import { loadFeed, saveFeed } from './feed-storage'

const NOW = new Date('2026-10-15T08:00:00.000Z')

function job(id: string, status: JobStatus = 'new'): Job {
  return {
    id, status, score: null, aiFilled: [], firstSeenAt: '', lastSeenAt: '', source: 'lever', title: `Judul ${id}`, company: `PT ${id}`,
    location: '', workplace: 'unknown', contract: '', level: '', salary: '', experience: '', postedAt: '', deadline: '',
    url: `https://x.test/${id}`, description: `Deskripsi ${id}`, logoUrl: '',
  }
}

const statusesInFeed = async () => Object.fromEntries((await loadFeed()).map((item) => [item.id, item.status]))

async function seedApplication(id: string, jobId: string, extra: Partial<Application> = {}): Promise<Application> {
  const at = NOW.toISOString()
  const app: Application = {
    id, jobId, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: at, updatedAt: at,
    job: { title: `Judul ${jobId}`, company: `PT ${jobId}`, url: `https://x.test/${jobId}`, source: 'lever', description: '', capturedAt: at },
    events: [{ at, type: 'created' }],
    ...extra,
  }
  await saveApplications([...(await loadApplications()), app])
  return app
}

beforeEach(() => {
  fakeBrowser.reset()
})

describe('prepareApplication', () => {
  it('makes a draft application and saves the job, which leaves Rekomendasi', async () => {
    await saveFeed([job('a'), job('b')])

    const result = await prepareApplication(job('a'), NOW)

    if (!result.ok) throw new Error('expected ok')
    expect(result.created).toBe(true)
    expect(await loadApplications()).toEqual([result.app])
    expect(result.app).toMatchObject({ jobId: 'a', status: 'draft' })
    expect(await statusesInFeed()).toEqual({ a: 'saved', b: 'new' })
  })

  it('opens the application that is already there instead of making a second one', async () => {
    await saveFeed([job('a')])
    const first = await prepareApplication(job('a'), NOW)
    const second = await prepareApplication(job('a'), NOW)

    if (!first.ok || !second.ok) throw new Error('expected ok')
    expect(second.created).toBe(false)
    expect(second.app.id).toBe(first.app.id)
    expect(await loadApplications()).toHaveLength(1)
  })

  it('says storage is full and changes nothing when the write is refused', async () => {
    await saveFeed([job('a')])
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))

    const result = await prepareApplication(job('a'), NOW)

    expect(result).toEqual({ ok: false, reason: 'storage-full' })
    expect(await loadApplications()).toEqual([])
    expect(await statusesInFeed()).toEqual({ a: 'new' })
  })
})

describe('recordFill', () => {
  it('moves a draft application to applied and the job in the feed with it', async () => {
    await saveFeed([job('a', 'saved')])
    await seedApplication('app-a', 'a')

    await recordFill('a', 11, NOW)

    const [app] = await loadApplications()
    expect(app?.status).toBe('applied')
    expect(app?.events.at(-1)).toMatchObject({ type: 'status', from: 'draft', to: 'applied', text: 'Fill berhasil, 11 field' })
    expect(await statusesInFeed()).toEqual({ a: 'applied' })
  })

  it('makes the application when the job has none', async () => {
    await saveFeed([job('a')])

    await recordFill('a', 4, NOW)

    const apps = await loadApplications()
    expect(apps).toHaveLength(1)
    expect(apps[0]).toMatchObject({ jobId: 'a', status: 'applied', job: { title: 'Judul a' } })
    expect(await statusesInFeed()).toEqual({ a: 'applied' })
  })

  it.each(['in-review', 'interview', 'offer', 'rejected'] as const)('does not move a %s application backwards', async (status) => {
    await saveFeed([job('a', 'applied')])
    await seedApplication('app-a', 'a', { status })

    await recordFill('a', 11, NOW)

    expect((await loadApplications())[0]).toMatchObject({ status })
    expect(await statusesInFeed()).toEqual({ a: 'applied' })
  })

  it('moves an application whose job the feed has pruned, without an error', async () => {
    await saveFeed([job('other')])
    await seedApplication('app-gone', 'gone')

    await recordFill('gone', 3, NOW)

    expect((await loadApplications())[0]?.status).toBe('applied')
    expect(await statusesInFeed()).toEqual({ other: 'new' })
  })

  it('does nothing for a job that has neither an application nor a place in the feed', async () => {
    await saveFeed([job('other')])

    await recordFill('gone', 3, NOW)

    expect(await loadApplications()).toEqual([])
  })
})

describe('recordOpenedFill (T52)', () => {
  it('marks an application added by hand, which no feed job leads to, and says it moved', async () => {
    await seedApplication('app-m', 'x', { jobId: null })

    const record = await recordOpenedFill({ jobId: '', applicationId: 'app-m' }, 6, NOW)

    expect(record).toEqual({ applicationId: 'app-m', company: 'PT x', status: 'applied', advanced: true })
    expect((await loadApplications())[0]).toMatchObject({ status: 'applied' })
    expect((await loadApplications())[0]?.events.at(-1)).toMatchObject({ type: 'status', to: 'applied', text: 'Fill berhasil, 6 field' })
  })

  it('uses the application the tab was opened from even when its feed job has another one', async () => {
    await saveFeed([job('a', 'saved')])
    await seedApplication('app-a', 'a')
    await seedApplication('app-b', 'b')

    await recordOpenedFill({ jobId: 'a', applicationId: 'app-b' }, 5, NOW)

    expect(Object.fromEntries((await loadApplications()).map((app) => [app.id, app.status]))).toEqual({ 'app-a': 'draft', 'app-b': 'applied' })
  })

  it('says it did not move an application that is already further on', async () => {
    await seedApplication('app-i', 'i', { status: 'interview' })

    const record = await recordOpenedFill({ jobId: 'i', applicationId: 'app-i' }, 6, NOW)

    expect(record).toMatchObject({ status: 'interview', advanced: false })
    expect((await loadApplications())[0]?.status).toBe('interview')
  })

  it('goes by the feed job when the tab names no application, making one when needed', async () => {
    await saveFeed([job('a')])

    const record = await recordOpenedFill({ jobId: 'a' }, 4, NOW)

    expect(record).toMatchObject({ status: 'applied', advanced: true, company: 'PT a' })
    expect(await loadApplications()).toHaveLength(1)
  })

  it('does nothing when neither an application nor a job is there', async () => {
    expect(await recordOpenedFill({ jobId: '', applicationId: 'gone' }, 3, NOW)).toBeUndefined()
    expect(await recordOpenedFill({ jobId: 'gone' }, 3, NOW)).toBeUndefined()
    expect(await loadApplications()).toEqual([])
  })
})

describe('markJobApplied (Tandai dilamar on a card)', () => {
  it('goes through an application, so the two cannot disagree', async () => {
    await saveFeed([job('a')])

    await markJobApplied('a', NOW)

    const [app] = await loadApplications()
    expect(app).toMatchObject({ jobId: 'a', status: 'applied' })
    expect(app?.events.at(-1)?.text).toBe('Ditandai dilamar')
    expect(await statusesInFeed()).toEqual({ a: 'applied' })
  })
})

describe('changeApplicationStatus', () => {
  it('records the change and moves the job in the feed to match', async () => {
    await saveFeed([job('a', 'saved')])
    await seedApplication('app-a', 'a')

    await changeApplicationStatus('app-a', 'interview', NOW)

    expect((await loadApplications())[0]).toMatchObject({ status: 'interview' })
    expect(await statusesInFeed()).toEqual({ a: 'applied' })
  })

  it('takes the job back to saved when the application becomes withdrawn', async () => {
    await saveFeed([job('a', 'applied')])
    await seedApplication('app-a', 'a', { status: 'applied' })

    await changeApplicationStatus('app-a', 'withdrawn', NOW)

    expect(await statusesInFeed()).toEqual({ a: 'saved' })
  })

  it('lets the person move a status backwards by hand', async () => {
    await saveFeed([job('a', 'applied')])
    await seedApplication('app-a', 'a', { status: 'interview' })

    await changeApplicationStatus('app-a', 'draft', NOW)

    expect((await loadApplications())[0]?.status).toBe('draft')
    expect(await statusesInFeed()).toEqual({ a: 'saved' })
  })

  it('works for a job that is no longer in the feed', async () => {
    await saveFeed([])
    await seedApplication('app-a', 'gone')

    const outcome = await changeApplicationStatus('app-a', 'offer', NOW)

    expect(outcome).toEqual({ ok: true })
    expect((await loadApplications())[0]?.status).toBe('offer')
  })
})

describe('patchApplication', () => {
  it('keeps notes and the follow-up date across a reload', async () => {
    await seedApplication('app-a', 'a')

    await patchApplication('app-a', { notes: 'HR: Rina', followUpAt: '2026-10-21' }, NOW)

    expect((await loadApplications())[0]).toMatchObject({ notes: 'HR: Rina', followUpAt: '2026-10-21', updatedAt: NOW.toISOString() })
  })
})

describe('removeApplication', () => {
  it('deletes the application with its CV and letter, and leaves the job saved', async () => {
    await saveFeed([job('a', 'applied'), job('b', 'applied')])
    const at = NOW.toISOString()
    const a = await seedApplication('app-a', 'a', { status: 'offer', cvId: 'cv-a', letterId: 'l-a' })
    const b = await seedApplication('app-b', 'b', { status: 'applied' })
    await saveApplicationData({
      applications: [a, b],
      cvs: [{ id: 'cv-a', applicationId: 'app-a', createdAt: at, profileHash: '', skills: [], experience: [], education: [], coverage: { required: [], covered: [], missing: [] }, edited: false, aiVersion: { skills: [], experience: [], education: [] } }],
      letters: [{ id: 'l-a', applicationId: 'app-a', createdAt: at, profileHash: '', lang: 'id', tone: 'formal', body: '', aiBody: '', edited: false }],
    })

    await removeApplication('app-a')

    const data = await loadApplicationData()
    expect(data.applications.map((app) => app.id)).toEqual(['app-b'])
    expect(data.cvs).toEqual([])
    expect(data.letters).toEqual([])
    expect(await statusesInFeed()).toEqual({ a: 'saved', b: 'applied' })
  })

  it('deletes an application whose job is gone from the feed without an error', async () => {
    await saveFeed([])
    await seedApplication('app-a', 'gone')

    await removeApplication('app-a')

    expect(await loadApplications()).toEqual([])
  })

  it('does nothing for an id that does not exist', async () => {
    await seedApplication('app-a', 'a')

    await removeApplication('nope')

    expect(await loadApplications()).toHaveLength(1)
  })
})

describe('syncFeedWithApplications', () => {
  it('brings every job that has an application in line, for example after an Import', async () => {
    await saveFeed([job('a', 'new'), job('b', 'applied'), job('c', 'new')])
    await seedApplication('app-a', 'a', { status: 'interview' })
    await seedApplication('app-b', 'b', { status: 'draft' })

    await syncFeedWithApplications()

    expect(await statusesInFeed()).toEqual({ a: 'applied', b: 'saved', c: 'new' })
  })
})

describe('addManualApplication', () => {
  const input = { title: 'Backend Developer', company: 'PT Luar Feed', url: 'https://example.test/lowongan/1', description: '', status: 'draft' as const }

  it('saves an application that is not tied to the feed, and leaves the feed alone', async () => {
    await saveFeed([job('a')])

    const result = await addManualApplication(input, NOW)

    if (!result.ok) throw new Error('expected ok')
    expect(result.created).toBe(true)
    expect(await loadApplications()).toEqual([result.app])
    expect(result.app).toMatchObject({ jobId: null, status: 'draft', job: { source: 'manual', title: 'Backend Developer', company: 'PT Luar Feed' } })
    expect(await statusesInFeed()).toEqual({ a: 'new' })
  })

  it('can add one that was already applied to', async () => {
    const result = await addManualApplication({ ...input, status: 'applied' }, NOW)

    if (!result.ok) throw new Error('expected ok')
    expect((await loadApplications())[0]).toMatchObject({ status: 'applied' })
  })

  it('opens the application that already has the same link instead of adding a second', async () => {
    const first = await addManualApplication(input, NOW)
    const second = await addManualApplication({ ...input, title: 'Beda' }, NOW)

    if (!first.ok || !second.ok) throw new Error('expected ok')
    expect(second.created).toBe(false)
    expect(second.app.id).toBe(first.app.id)
    expect(await loadApplications()).toHaveLength(1)
  })

  it('says storage is full and adds nothing when the write is refused', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))

    const result = await addManualApplication(input, NOW)

    expect(result).toEqual({ ok: false, reason: 'storage-full' })
    expect(await loadApplications()).toEqual([])
  })
})
