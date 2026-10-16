import { describe, expect, it } from 'vitest'
import type { Job, JobStatus } from '../feed/types'
import { advanceApplication, advanceOnFill, attachCv, attachLetter, noteDownload, createApplication, createManualApplication, deleteApplication, findByJobId, setStatus, updateApplication, validateManual } from './applications'
import { APP_STATUSES, type AppStatus, type Application, type ApplicationData, type CoverLetter, type TailoredCv } from './types'

const NOW = new Date('2026-10-15T08:00:00.000Z')
const LATER = new Date('2026-10-16T09:30:00.000Z')

function job(id: string, status: JobStatus = 'new'): Job {
  return {
    id, status, score: null, aiFilled: [], firstSeenAt: '', lastSeenAt: '', source: 'lever', title: `Judul ${id}`, company: `PT ${id}`,
    location: 'Jakarta', workplace: 'remote', contract: '', level: '', salary: '', experience: '', postedAt: '', deadline: '',
    url: `https://x.test/${id}`, description: `Deskripsi ${id}`, logoUrl: '',
  }
}

function counter() {
  let n = 0
  return () => `app-${++n}`
}

function appWith(status: AppStatus): Application {
  const { app } = createApplication([], job('j'), NOW, counter())
  return { ...app, status }
}

describe('createApplication', () => {
  it('makes a draft that keeps a copy of the job', () => {
    const { apps, app, created } = createApplication([], job('a'), NOW, counter())

    expect(created).toBe(true)
    expect(apps).toEqual([app])
    expect(app).toMatchObject({
      id: 'app-1', jobId: 'a', status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '',
      createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
      job: { title: 'Judul a', company: 'PT a', url: 'https://x.test/a', source: 'lever', description: 'Deskripsi a', capturedAt: NOW.toISOString() },
    })
    expect(app.events).toEqual([{ at: NOW.toISOString(), type: 'created' }])
  })

  it('returns the application that already exists for the job instead of a second one', () => {
    const first = createApplication([], job('a'), NOW, counter())
    const second = createApplication(first.apps, job('a'), LATER, counter())

    expect(second.created).toBe(false)
    expect(second.app).toBe(first.app)
    expect(second.apps).toBe(first.apps)
  })

  it('gives each job its own application', () => {
    const newId = counter()
    const first = createApplication([], job('a'), NOW, newId)
    const second = createApplication(first.apps, job('b'), NOW, newId)

    expect(second.apps.map((app) => app.jobId)).toEqual(['a', 'b'])
    expect(second.apps[0]).toBe(first.app)
  })

  it('starts at applied when the job was already marked applied, so the two never disagree', () => {
    const { app } = createApplication([], job('a', 'applied'), NOW, counter())

    expect(app.status).toBe('applied')
  })
})

describe('findByJobId', () => {
  it('finds the application of a job, and nothing for a job without one', () => {
    const { apps, app } = createApplication([], job('a'), NOW, counter())

    expect(findByJobId(apps, 'a')).toBe(app)
    expect(findByJobId(apps, 'zzz')).toBeUndefined()
  })
})

describe('setStatus', () => {
  it('changes the status and records who moved from where to where', () => {
    const next = setStatus(appWith('draft'), 'interview', LATER)

    expect(next.status).toBe('interview')
    expect(next.updatedAt).toBe(LATER.toISOString())
    expect(next.events.at(-1)).toEqual({ at: LATER.toISOString(), type: 'status', from: 'draft', to: 'interview' })
  })

  it('keeps the reason in the event when one is given', () => {
    const next = setStatus(appWith('draft'), 'applied', LATER, 'Fill berhasil, 11 field')

    expect(next.events.at(-1)).toMatchObject({ type: 'status', text: 'Fill berhasil, 11 field' })
  })

  it('does nothing when the status is the same', () => {
    const app = appWith('offer')

    expect(setStatus(app, 'offer', LATER)).toBe(app)
  })

  it('lets the person move a status backwards by hand', () => {
    expect(setStatus(appWith('interview'), 'applied', LATER).status).toBe('applied')
  })

  it('never edits the application it was given', () => {
    const app = appWith('draft')
    setStatus(app, 'applied', LATER)

    expect(app.status).toBe('draft')
    expect(app.events).toHaveLength(1)
  })
})

describe('advanceOnFill', () => {
  it('moves a draft to applied and says why', () => {
    const { apps } = createApplication([], job('a'), NOW, counter())

    const result = advanceOnFill(apps, job('a'), LATER, counter(), 'Fill berhasil, 11 field')

    expect(result.app.status).toBe('applied')
    expect(result.apps).toEqual([result.app])
    expect(result.app.events.at(-1)).toEqual({ at: LATER.toISOString(), type: 'status', from: 'draft', to: 'applied', text: 'Fill berhasil, 11 field' })
  })

  it('makes the application first when the job has none, and ends at applied', () => {
    const result = advanceOnFill([], job('a'), LATER, counter(), 'Fill berhasil')

    expect(result.apps).toHaveLength(1)
    expect(result.app).toMatchObject({ jobId: 'a', status: 'applied' })
    expect(result.app.events.map((event) => event.type)).toEqual(['created', 'status'])
  })

  it.each(APP_STATUSES.filter((status) => status !== 'draft'))('leaves %s alone: a Fill never moves a status backwards', (status) => {
    const app = { ...appWith(status), jobId: 'j' }

    const result = advanceOnFill([app], job('j'), LATER, counter(), 'Fill berhasil')

    expect(result.app).toBe(app)
    expect(result.apps).toEqual([app])
  })
})

describe('advanceApplication', () => {
  it('moves a draft to applied without needing the job, which the feed may have pruned', () => {
    const next = advanceApplication(appWith('draft'), LATER, 'Ditandai dilamar')

    expect(next.status).toBe('applied')
    expect(next.events.at(-1)).toMatchObject({ type: 'status', from: 'draft', to: 'applied', text: 'Ditandai dilamar' })
  })

  it.each(APP_STATUSES.filter((status) => status !== 'draft'))('leaves %s as it is', (status) => {
    const app = appWith(status)

    expect(advanceApplication(app, LATER, 'x')).toBe(app)
  })
})

describe('updateApplication', () => {
  it('changes notes and follow-up date without touching status or history', () => {
    const app = appWith('applied')

    const next = updateApplication(app, { notes: 'HR: Rina', followUpAt: '2026-10-21' }, LATER)

    expect(next).toMatchObject({ notes: 'HR: Rina', followUpAt: '2026-10-21', status: 'applied', updatedAt: LATER.toISOString() })
    expect(next.events).toBe(app.events)
  })

  it('puts pasted posting text into the copy of the job', () => {
    const next = updateApplication(appWith('draft'), { description: 'Teks yang ditempel' }, LATER)

    expect(next.job.description).toBe('Teks yang ditempel')
    expect(next.job.title).toBe('Judul j')
  })

  it('sets the link of the posting, trimmed', () => {
    const next = updateApplication(appWith('draft'), { url: ' https://example.test/baru ' }, LATER)

    expect(next.job.url).toBe('https://example.test/baru')
    expect(next.job.title).toBe('Judul j')
  })

  it('clears the follow-up date with null', () => {
    const next = updateApplication({ ...appWith('draft'), followUpAt: '2026-10-21' }, { followUpAt: null }, LATER)

    expect(next.followUpAt).toBeNull()
  })
})

describe('deleteApplication', () => {
  const doc = (id: string, applicationId: string) => ({ id, applicationId })

  it('takes the CV and the letter of that application with it, and nothing else', () => {
    const a: Application = { ...appWith('draft'), id: 'a', cvId: 'cv-a', letterId: 'l-a' }
    const b: Application = { ...appWith('draft'), id: 'b', cvId: 'cv-b', letterId: null }
    const data = {
      applications: [a, b],
      cvs: [doc('cv-a', 'a'), doc('cv-b', 'b')],
      letters: [doc('l-a', 'a')],
    } as unknown as ApplicationData

    const next = deleteApplication(data, 'a')

    expect(next.applications.map((app) => app.id)).toEqual(['b'])
    expect(next.cvs.map((cv) => cv.id)).toEqual(['cv-b'])
    expect(next.letters).toEqual([])
  })

  it('returns the same data when there is no such application', () => {
    const data: ApplicationData = { applications: [appWith('draft')], cvs: [], letters: [] }

    expect(deleteApplication(data, 'nope')).toEqual(data)
  })
})

describe('createManualApplication', () => {
  const input = { title: '  Frontend Engineer ', company: ' PT Luar Feed ', url: ' https://example.test/lowongan/1 ', description: '', status: 'draft' as const }

  it('makes a draft that is not tied to a feed job, from what the person typed', () => {
    const { apps, app, created } = createManualApplication([], input, NOW, counter())

    expect(created).toBe(true)
    expect(apps).toEqual([app])
    expect(app).toMatchObject({
      id: 'app-1', jobId: null, status: 'draft', cvId: null, letterId: null, notes: '', followUpAt: null,
      job: { title: 'Frontend Engineer', company: 'PT Luar Feed', url: 'https://example.test/lowongan/1', source: 'manual', description: '', capturedAt: NOW.toISOString() },
    })
    expect(app.events).toEqual([{ at: NOW.toISOString(), type: 'created' }])
  })

  it('can start as already applied, and says so in the history', () => {
    const { app } = createManualApplication([], { ...input, status: 'applied' }, NOW, counter())

    expect(app.status).toBe('applied')
    expect(app.events.at(-1)).toEqual({ at: NOW.toISOString(), type: 'status', from: 'draft', to: 'applied', text: 'Ditambahkan manual' })
  })

  it('keeps the pasted posting text', () => {
    const { app } = createManualApplication([], { ...input, description: ' Teks lowongan ' }, NOW, counter())

    expect(app.job.description).toBe('Teks lowongan')
  })

  it('returns the application that already has the same link instead of adding a second', () => {
    const first = createManualApplication([], input, NOW, counter())
    const second = createManualApplication(first.apps, { ...input, title: 'Lain' }, LATER, counter())

    expect(second.created).toBe(false)
    expect(second.app).toBe(first.app)
    expect(second.apps).toBe(first.apps)
  })

  it('finds the same posting even when the link differs only by a trailing slash or case of the host', () => {
    const first = createManualApplication([], input, NOW, counter())
    const again = createManualApplication(first.apps, { ...input, url: 'https://EXAMPLE.test/lowongan/1/' }, LATER, counter())

    expect(again.created).toBe(false)
  })

  it('treats two applications without a link as different ones', () => {
    const newId = counter()
    const first = createManualApplication([], { ...input, url: '' }, NOW, newId)
    const second = createManualApplication(first.apps, { ...input, url: '' }, NOW, newId)

    expect(second.created).toBe(true)
    expect(second.apps).toHaveLength(2)
  })

  it('does not take the place of an application that came from the feed', () => {
    const fromFeed = createApplication([], job('a'), NOW, counter())
    const manual = createManualApplication(fromFeed.apps, { ...input, url: 'https://x.test/a' }, NOW, counter())

    expect(manual.created).toBe(false)
    expect(manual.app).toBe(fromFeed.app)
  })
})

describe('validateManual', () => {
  const ok = { title: 'Engineer', company: 'PT A', url: '', description: '', status: 'draft' as const }

  it('is fine with a title and a company; the link is optional', () => {
    expect(validateManual(ok)).toEqual({})
    expect(validateManual({ ...ok, url: 'https://example.test/x' })).toEqual({})
  })

  it('asks for a title and a company, ignoring blanks', () => {
    expect(validateManual({ ...ok, title: '   ', company: '' })).toEqual({ title: 'Isi judul lowongan.', company: 'Isi nama perusahaan.' })
  })

  it('refuses a link that is not http or https', () => {
    expect(validateManual({ ...ok, url: 'bukan url' })).toEqual({ url: 'Link harus diawali http:// atau https://.' })
    expect(validateManual({ ...ok, url: 'ftp://example.test/x' })).toEqual({ url: 'Link harus diawali http:// atau https://.' })
  })
})

describe('attachCv (T48)', () => {
  const cvOf = (id: string, applicationId: string): TailoredCv => ({
    id, applicationId, createdAt: NOW.toISOString(), profileHash: 'h', skills: ['React'], experience: [{ sourceId: 'x', bullets: ['a'] }], education: [],
    coverage: { required: [], covered: [], missing: [] }, edited: false, aiVersion: { skills: ['React'], experience: [{ sourceId: 'x', bullets: ['a'] }], education: [] },
  })
  const data = (): ApplicationData => ({ applications: [appWith('draft')], cvs: [], letters: [] })

  it('stores the CV, points the application at it and notes it in the history', () => {
    const base = data()
    const next = attachCv(base, cvOf('cv-1', 'app-1'), LATER)
    expect(next.cvs.map((cv) => cv.id)).toEqual(['cv-1'])
    expect(next.applications[0]).toMatchObject({ cvId: 'cv-1', updatedAt: LATER.toISOString() })
    expect(next.applications[0]?.events.at(-1)).toEqual({ at: LATER.toISOString(), type: 'cv', text: 'CV dibuat' })
  })

  it('replaces the earlier CV of that application and says it was made again', () => {
    const first = attachCv(data(), cvOf('cv-1', 'app-1'), NOW)
    const second = attachCv(first, cvOf('cv-2', 'app-1'), LATER)
    expect(second.cvs.map((cv) => cv.id)).toEqual(['cv-2'])
    expect(second.applications[0]?.cvId).toBe('cv-2')
    expect(second.applications[0]?.events.at(-1)?.text).toBe('CV dibuat ulang')
  })

  it('leaves other applications, their CVs and the letters alone', () => {
    const other: Application = { ...appWith('applied'), id: 'app-9', cvId: 'cv-9' }
    const base: ApplicationData = { applications: [appWith('draft'), other], cvs: [cvOf('cv-9', 'app-9')], letters: [] }
    const next = attachCv(base, cvOf('cv-1', 'app-1'), LATER)
    expect(next.cvs.map((cv) => cv.id).sort()).toEqual(['cv-1', 'cv-9'])
    expect(next.applications[1]).toEqual(other)
  })

  it('changes nothing for an application that is not there', () => {
    const base = data()
    expect(attachCv(base, cvOf('cv-1', 'nope'), LATER)).toBe(base)
  })
})

describe('attachLetter (T51)', () => {
  const letterOf = (id: string, applicationId: string): CoverLetter => ({
    id, applicationId, createdAt: NOW.toISOString(), profileHash: 'h', lang: 'id', tone: 'formal', body: 'Isi', aiBody: 'Isi', edited: false,
  })
  const data = (): ApplicationData => ({ applications: [appWith('draft')], cvs: [], letters: [] })

  it('stores the letter, points the application at it and notes it in the history', () => {
    const next = attachLetter(data(), letterOf('l-1', 'app-1'), LATER)
    expect(next.letters.map((letter) => letter.id)).toEqual(['l-1'])
    expect(next.applications[0]).toMatchObject({ letterId: 'l-1', updatedAt: LATER.toISOString() })
    expect(next.applications[0]?.events.at(-1)).toEqual({ at: LATER.toISOString(), type: 'letter', text: 'Surat dibuat' })
  })

  it('replaces the earlier letter of that application and says it was made again', () => {
    const second = attachLetter(attachLetter(data(), letterOf('l-1', 'app-1'), NOW), letterOf('l-2', 'app-1'), LATER)
    expect(second.letters.map((letter) => letter.id)).toEqual(['l-2'])
    expect(second.applications[0]?.letterId).toBe('l-2')
    expect(second.applications[0]?.events.at(-1)?.text).toBe('Surat dibuat ulang')
  })

  it('leaves other letters and the CVs alone', () => {
    const other: Application = { ...appWith('applied'), id: 'app-9', letterId: 'l-9' }
    const base: ApplicationData = { applications: [appWith('draft'), other], cvs: [], letters: [letterOf('l-9', 'app-9')] }
    const next = attachLetter(base, letterOf('l-1', 'app-1'), LATER)
    expect(next.letters.map((letter) => letter.id).sort()).toEqual(['l-1', 'l-9'])
    expect(next.applications[1]).toEqual(other)
    expect(next.cvs).toBe(base.cvs)
  })

  it('changes nothing for an application that is not there', () => {
    const base = data()
    expect(attachLetter(base, letterOf('l-1', 'nope'), LATER)).toBe(base)
  })
})

describe('noteDownload (T50)', () => {
  it('adds a download event to the history and touches the time, nothing else', () => {
    const app = appWith('draft')
    const next = noteDownload(app, LATER)
    expect(next.events.at(-1)).toEqual({ at: LATER.toISOString(), type: 'download' })
    expect(next.events).toHaveLength(app.events.length + 1)
    expect(next.updatedAt).toBe(LATER.toISOString())
    expect({ ...next, events: app.events, updatedAt: app.updatedAt }).toEqual(app)
  })

  it('does not change the application it was given', () => {
    const app = appWith('draft')
    noteDownload(app, LATER)
    expect(app.events).toHaveLength(1)
  })
})
