import { describe, expect, it } from 'vitest'
import { applyApplicationData, countAddedApplications, countApplications, normalizeApplicationData } from './data'
import type { Application, ApplicationData, CoverLetter, TailoredCv } from './types'

const AT = '2026-10-15T08:00:00.000Z'

function app(id: string, jobId: string | null = `job-${id}`, extra: Partial<Application> = {}): Application {
  return {
    id, jobId, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: AT, updatedAt: AT,
    job: { title: `Judul ${id}`, company: `PT ${id}`, url: `https://x.test/${id}`, source: 'lever', description: '', capturedAt: AT },
    events: [{ at: AT, type: 'created' }],
    ...extra,
  }
}

const cv = (id: string, applicationId: string): TailoredCv => ({
  id, applicationId, createdAt: AT, profileHash: 'h', skills: ['TypeScript'], experience: [{ sourceId: 'x1', bullets: ['Membangun UI'] }], education: ['e1'],
  coverage: { required: ['React'], covered: [], missing: ['React'] }, edited: false,
  aiVersion: { skills: ['TypeScript'], experience: [{ sourceId: 'x1', bullets: ['Membangun UI'] }], education: ['e1'] },
})
const letter = (id: string, applicationId: string): CoverLetter => ({
  id, applicationId, createdAt: AT, profileHash: 'h', lang: 'id', tone: 'formal', body: 'Yth.', aiBody: 'Yth.', edited: false,
})

const data = (applications: Application[], cvs: TailoredCv[] = [], letters: CoverLetter[] = []): ApplicationData => ({ applications, cvs, letters })

describe('normalizeApplicationData', () => {
  it('keeps well-formed data as it is', () => {
    const full = data([app('a', 'job-a', { cvId: 'c1', letterId: 'l1', status: 'interview', followUpAt: '2026-10-21', notes: 'HR: Rina' })], [cv('c1', 'a')], [letter('l1', 'a')])

    expect(normalizeApplicationData(JSON.parse(JSON.stringify(full)))).toEqual(full)
  })

  it('keeps the data-notice acknowledgement (T47) and drops a non-text one', () => {
    const acked = data([app('a', 'job-a', { aiNoticeAck: 'opencode-zen:exo-free' })])
    expect(normalizeApplicationData(JSON.parse(JSON.stringify(acked)))).toEqual(acked)
    const bad = JSON.parse(JSON.stringify(data([app('a')])))
    bad.applications[0].aiNoticeAck = 7
    expect(normalizeApplicationData(bad).applications[0]).not.toHaveProperty('aiNoticeAck')
  })

  it('returns nothing for input that is not the expected shape', () => {
    expect(normalizeApplicationData(undefined)).toEqual(data([]))
    expect(normalizeApplicationData('x')).toEqual(data([]))
    expect(normalizeApplicationData({ applications: 'x', cvs: 3, letters: null })).toEqual(data([]))
  })

  it('drops an application with an unknown status, no id, or no job', () => {
    const raw = {
      applications: [{ ...app('ok') }, { ...app('bad'), status: 'ghosted' }, { ...app(''), id: '' }, { ...app('nojob'), job: null }, 'junk'],
    }

    expect(normalizeApplicationData(raw).applications.map((item) => item.id)).toEqual(['ok'])
  })

  it('fills in what an older file did not have', () => {
    const { notes: _n, followUpAt: _f, events: _e, ...bare } = app('a')

    const [item] = normalizeApplicationData({ applications: [bare] }).applications

    expect(item).toMatchObject({ notes: '', followUpAt: null, events: [], cvId: null, letterId: null })
  })

  it('drops history entries it cannot read and keeps the rest', () => {
    const events = [{ at: AT, type: 'created' }, { at: AT, type: 'teleport' }, { type: 'status' }, { at: AT, type: 'status', from: 'draft', to: 'applied', text: 'Fill berhasil' }, { at: AT, type: 'status', from: 'nope', to: 'applied' }]

    const [item] = normalizeApplicationData({ applications: [{ ...app('a'), events }] }).applications

    expect(item?.events).toEqual([
      { at: AT, type: 'created' },
      { at: AT, type: 'status', from: 'draft', to: 'applied', text: 'Fill berhasil' },
      { at: AT, type: 'status', to: 'applied' },
    ])
  })

  it('reads an application that was added by hand, with source manual and no feed job', () => {
    const manual = app('m', null, { job: { ...app('m').job, source: 'manual' as never } })

    const [item] = normalizeApplicationData(JSON.parse(JSON.stringify({ applications: [manual] }))).applications

    expect(item).toMatchObject({ id: 'm', jobId: null, job: { source: 'manual' } })
  })

  it('keeps the first of two applications that share an id', () => {
    const result = normalizeApplicationData({ applications: [app('a', 'one'), app('a', 'two')] })

    expect(result.applications.map((item) => item.jobId)).toEqual(['one'])
  })

  it('drops a CV or letter that belongs to no application, and a link to a document that is not there', () => {
    const raw = data([app('a', 'job-a', { cvId: 'gone', letterId: 'l1' })], [cv('c9', 'nobody')], [letter('l1', 'a')])

    const result = normalizeApplicationData(JSON.parse(JSON.stringify(raw)))

    expect(result.cvs).toEqual([])
    expect(result.applications[0]).toMatchObject({ cvId: null, letterId: 'l1' })
    expect(result.letters).toHaveLength(1)
  })
})

describe('applyApplicationData', () => {
  const current = data([app('a')], [cv('c-a', 'a')])

  it('merge adds the applications that are not there yet, with their CV and letter', () => {
    const incoming = data([app('b', 'job-b', { cvId: 'c-b', letterId: 'l-b' })], [cv('c-b', 'b')], [letter('l-b', 'b')])

    const merged = applyApplicationData(current, incoming, 'merge')

    expect(merged.applications.map((item) => item.id)).toEqual(['a', 'b'])
    expect(merged.cvs.map((item) => item.id)).toEqual(['c-a', 'c-b'])
    expect(merged.letters.map((item) => item.id)).toEqual(['l-b'])
  })

  it('merge leaves an application alone when the same id is already there', () => {
    const incoming = data([app('a', 'job-a', { status: 'offer', notes: 'dari berkas' })], [cv('other', 'a')])

    const merged = applyApplicationData(current, incoming, 'merge')

    expect(merged).toEqual(current)
  })

  it('merge treats the same job as the same application even under another id', () => {
    const incoming = data([app('zzz', 'job-a')], [cv('c-z', 'zzz')])

    expect(applyApplicationData(current, incoming, 'merge')).toEqual(current)
  })

  it('merge matches by posting URL when neither application is tied to a feed job', () => {
    const manual = data([app('m1', null, { job: { ...app('m').job, url: 'https://x.test/same' } })])
    const incoming = data([app('m2', null, { job: { ...app('m').job, url: 'https://x.test/same' } })])

    expect(applyApplicationData(manual, incoming, 'merge')).toEqual(manual)
  })

  it('merge never removes what is there', () => {
    expect(applyApplicationData(current, data([]), 'merge')).toEqual(current)
  })

  it('replace swaps everything for the file', () => {
    const incoming = data([app('b')], [], [letter('l-b', 'b')])

    expect(applyApplicationData(current, incoming, 'replace')).toEqual(incoming)
  })

  it('a file from before applications existed changes nothing, in either mode', () => {
    expect(applyApplicationData(current, null, 'merge')).toBe(current)
    expect(applyApplicationData(current, null, 'replace')).toBe(current)
  })

  it('drops an incoming document whose id a different CV already uses, and unlinks it', () => {
    const incoming = data([app('b', 'job-b', { cvId: 'c-a' })], [cv('c-a', 'b')])

    const merged = applyApplicationData(current, incoming, 'merge')

    expect(merged.cvs).toEqual(current.cvs)
    expect(merged.applications.find((item) => item.id === 'b')?.cvId).toBeNull()
  })
})

describe('countApplications', () => {
  it('counts applications, not documents', () => {
    expect(countApplications(data([app('a'), app('b')], [cv('c', 'a')]))).toBe(2)
  })
})

describe('countAddedApplications', () => {
  it('counts the applications that were not there before', () => {
    const before = data([app('a')])
    const after = data([app('a'), app('b'), app('c')])

    expect(countAddedApplications(before, after)).toBe(2)
    expect(countAddedApplications(after, before)).toBe(0)
  })
})
