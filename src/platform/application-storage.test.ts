import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { applyApplicationData } from '../core/applications/data'
import type { Application, ApplicationData, CoverLetter, TailoredCv } from '../core/applications/types'
import { buildExport } from '../core/data/export'
import { parseImport } from '../core/data/import'
import { createEmptyProfile } from '../core/profile/profile'
import {
  clearApplicationData,
  loadApplicationData,
  loadApplications,
  saveApplicationData,
  saveApplications,
  watchApplications,
} from './application-storage'

const AT = '2026-10-15T08:00:00.000Z'

function app(id: string, extra: Partial<Application> = {}): Application {
  return {
    id, jobId: `job-${id}`, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT,
    job: { title: `Judul ${id}`, company: `PT ${id}`, url: `https://x.test/${id}`, source: 'lever', description: '', capturedAt: AT },
    events: [{ at: AT, type: 'created' }],
    ...extra,
  }
}
const cv = { id: 'c1', applicationId: 'a', createdAt: AT, profileHash: 'h', skills: [], experience: [], education: [], coverage: { required: [], covered: [], missing: [] }, edited: false, aiVersion: { skills: [], experience: [], education: [] } } satisfies TailoredCv
const letter = { id: 'l1', applicationId: 'a', createdAt: AT, profileHash: 'h', lang: 'id', tone: 'formal', body: 'Yth.', aiBody: 'Yth.', edited: false } satisfies CoverLetter
const full: ApplicationData = { applications: [app('a', { cvId: 'c1', letterId: 'l1' })], cvs: [cv], letters: [letter] }

describe('application storage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('is empty when nothing has been saved', async () => {
    expect(await loadApplicationData()).toEqual({ applications: [], cvs: [], letters: [] })
  })

  it('returns what was saved, as after a page reload', async () => {
    await saveApplicationData(full)

    expect(await loadApplicationData()).toEqual(full)
  })

  it('keeps the applications apart from the documents, so the list does not load whole CVs', async () => {
    await saveApplicationData(full)

    const stored = await fakeBrowser.storage.local.get(['applications', 'tailoredCvs', 'coverLetters'])
    expect(Object.keys(stored).sort()).toEqual(['applications', 'coverLetters', 'tailoredCvs'])
    expect(await loadApplications()).toEqual(full.applications)
  })

  it('saves only the application list when only that changed', async () => {
    await saveApplicationData(full)
    const set = vi.spyOn(fakeBrowser.storage.local, 'set')

    await saveApplications([app('a', { cvId: 'c1', letterId: 'l1', status: 'interview' })])

    expect(set).toHaveBeenCalledTimes(1)
    expect((await loadApplicationData()).cvs).toEqual([cv])
  })

  it('drops a stored document whose application is gone, so nothing orphaned is ever shown', async () => {
    await saveApplicationData(full)
    await saveApplications([])

    expect(await loadApplicationData()).toEqual({ applications: [], cvs: [], letters: [] })
  })

  it('says storage is full when the browser refuses the write, and keeps the old data', async () => {
    await saveApplicationData(full)
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))

    const outcome = await saveApplications([])

    expect(outcome).toEqual({ ok: false, reason: 'storage-full' })
    expect((await loadApplicationData()).applications).toHaveLength(1)
  })

  it('does not hide other errors as storage-full', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('something else broke'))

    await expect(saveApplications([])).rejects.toThrow('something else broke')
  })

  it('clearApplicationData removes the applications, CVs and letters', async () => {
    await saveApplicationData(full)

    await clearApplicationData()

    expect(await fakeBrowser.storage.local.get(['applications', 'tailoredCvs', 'coverLetters'])).toEqual({})
  })

  it('tells the page when the applications change elsewhere', async () => {
    const seen: number[] = []
    const stop = watchApplications((apps) => seen.push(apps.length))

    await saveApplications([app('a'), app('b')])
    stop()

    expect(seen).toEqual([2])
  })
})

// FR-38: "Export lalu Hapus semua lalu Import (Ganti); lamaran, CV, dan surat kembali."
describe('export, delete everything, import', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  async function importBack(mode: 'merge' | 'replace') {
    const file = buildExport(createEmptyProfile(), new Date(AT), [], await loadApplicationData())
    await clearApplicationData()
    const parsed = parseImport(file)
    if (!parsed.ok) throw new Error('export was refused on import')
    await saveApplicationData(applyApplicationData(await loadApplicationData(), parsed.applications, mode))
    return loadApplicationData()
  }

  it.each(['replace', 'merge'] as const)('brings the applications, CVs and letters back with %s', async (mode) => {
    await saveApplicationData(full)

    expect(await importBack(mode)).toEqual(full)
  })
})
