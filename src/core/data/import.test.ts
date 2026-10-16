import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import { EMPTY_APPLICATION_DATA, type Application, type ApplicationData } from '../applications/types'
import { buildExport } from './export'
import { applyImport, diffApplications, diffImport, eventForImportFile, mergeProfile, parseImport, summarizeImport } from './import'

const NOW = new Date('2026-10-10T08:00:00Z')

function profileWith(change: (profile: Profile) => void): Profile {
  const profile = createEmptyProfile()
  change(profile)
  return profile
}

function application(id: string, jobId: string | null = `job-${id}`): Application {
  const at = '2026-10-15T08:00:00.000Z'
  return {
    id, jobId, status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', createdAt: at, updatedAt: at,
    job: { title: `Judul ${id}`, company: `PT ${id}`, url: `https://x.test/${id}`, source: 'lever', description: '', capturedAt: at },
    events: [{ at, type: 'created' }],
  }
}

const sample = profileWith((p) => {
  p.personal.firstName = 'Sari'
  p.personal.lastName = 'Contoh'
  p.contact.email = 'sari@example.test'
  p.education.push({ id: 'e1', institution: 'Universitas Contoh', level: 'S1', major: 'Informatika', gpa: '3.6', year: '2022' })
  p.experience.push({ id: 'x1', company: 'PT Contoh', title: 'Engineer', start: '2022-08', end: '', current: true, description: '' })
  p.skills.push({ group: 'teknis', name: 'TypeScript' })
  p.custom.push({ id: 'c1', key: 'Gaji', value: '10 juta' })
})

describe('parseImport', () => {
  it('reads a file produced by Export', () => {
    const result = parseImport(buildExport(sample, NOW))
    expect(result).toEqual({ ok: true, profile: sample, applications: EMPTY_APPLICATION_DATA })
  })

  it('reads the applications, CVs and letters of a version 3 file', () => {
    const data = { applications: [application('a1')], cvs: [], letters: [] }
    const result = parseImport(buildExport(sample, NOW, [], data))
    expect(result).toEqual({ ok: true, profile: sample, applications: data })
  })

  it('says a version 1 or 2 file has no applications, so importing it cannot wipe the ones already here', () => {
    const v2 = JSON.stringify({ app: 'job-kit', version: 2, profile: sample, jobs: [] })
    expect(parseImport(v2)).toEqual({ ok: true, profile: sample, applications: null })
  })

  it('ignores applications that are malformed instead of refusing the whole file', () => {
    const text = JSON.stringify({ app: 'job-kit', version: 3, profile: sample, applications: [{ id: 'x', status: 'ghosted' }, 'junk'], cvs: 7, letters: {} })
    expect(parseImport(text)).toEqual({ ok: true, profile: sample, applications: EMPTY_APPLICATION_DATA })
  })

  it('rejects text that is not JSON', () => {
    expect(parseImport('bukan json {')).toMatchObject({ ok: false, reason: 'not-json' })
  })

  it('rejects JSON that is not a job-kit export', () => {
    expect(parseImport('{"hello":"world"}')).toMatchObject({ ok: false, reason: 'wrong-shape' })
    expect(parseImport('[1,2]')).toMatchObject({ ok: false, reason: 'wrong-shape' })
    expect(parseImport('{"app":"job-kit","version":1}')).toMatchObject({ ok: false, reason: 'wrong-shape' })
  })

  it('reads job preferences from the file', () => {
    const withPrefs = profileWith((p) => {
      p.jobPrefs.roles = ['Frontend Engineer']
      p.jobPrefs.workModes = ['Remote']
      p.jobPrefs.minSalary = '15000000'
    })
    const result = parseImport(buildExport(withPrefs, NOW))
    expect(result).toEqual({ ok: true, profile: withPrefs, applications: EMPTY_APPLICATION_DATA })
  })

  it('still reads an older version 1 file that has no job preferences', () => {
    const { jobPrefs: _unused, ...legacy } = sample
    const text = JSON.stringify({ app: 'job-kit', version: 1, exportedAt: NOW.toISOString(), profile: { ...legacy, version: 1 } })
    const result = parseImport(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.jobPrefs).toEqual(createEmptyProfile().jobPrefs)
    expect(result.profile.personal.firstName).toBe('Sari')
  })

  it('rejects an unknown version and says which one', () => {
    const text = JSON.stringify({ app: 'job-kit', version: 4, profile: sample })
    expect(parseImport(text)).toEqual({ ok: false, reason: 'unknown-version', detail: '4' })
  })

  it('fills fields missing from an older file and drops unknown ones', () => {
    const text = JSON.stringify({
      app: 'job-kit',
      version: 1,
      profile: { personal: { firstName: 'Sari', bogus: 'x' }, education: [{ institution: 'Universitas Contoh' }] },
    })
    const result = parseImport(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.personal.firstName).toBe('Sari')
    expect(result.profile.personal).not.toHaveProperty('bogus')
    expect(result.profile.contact.email).toBe('')
    expect(result.profile.education[0]).toMatchObject({ institution: 'Universitas Contoh', level: '', gpa: '' })
    expect(result.profile.education[0]?.id).toBeTruthy()
  })
})

describe('mergeProfile', () => {
  it('keeps every filled field and only fills the empty ones', () => {
    const current = profileWith((p) => {
      p.personal.firstName = 'Dewi'
    })
    const merged = mergeProfile(current, sample)
    expect(merged.personal.firstName).toBe('Dewi')
    expect(merged.personal.lastName).toBe('Contoh')
    expect(merged.contact.email).toBe('sari@example.test')
  })

  it('adds entries that are not already there and skips duplicates', () => {
    const merged = mergeProfile(sample, sample)
    expect(merged.education).toHaveLength(1)
    expect(merged.experience).toHaveLength(1)
    expect(merged.skills).toHaveLength(1)
    expect(merged.custom).toHaveLength(1)
  })

  it('gives an incoming entry a new id when its id is already taken by a different entry', () => {
    const current = profileWith((p) => {
      p.education.push({ id: 'e1', institution: 'Kampus Lain', level: 'S2', major: 'Data', gpa: '', year: '2024' })
    })
    const merged = mergeProfile(current, sample)
    expect(merged.education).toHaveLength(2)
    expect(new Set(merged.education.map((e) => e.id)).size).toBe(2)
  })

  it('fills empty job preferences and keeps the ones already chosen', () => {
    const current = profileWith((p) => {
      p.jobPrefs.level = 'Senior'
      p.jobPrefs.roles = ['UI Engineer']
      p.jobPrefs.workModes = ['Hybrid']
    })
    const incoming = profileWith((p) => {
      p.jobPrefs.level = 'Mid'
      p.jobPrefs.roles = ['ui engineer', 'Frontend Engineer']
      p.jobPrefs.workModes = ['Remote']
      p.jobPrefs.minSalary = '15000000'
    })
    const merged = mergeProfile(current, incoming).jobPrefs
    expect(merged.level).toBe('Senior')
    expect(merged.roles).toEqual(['UI Engineer', 'Frontend Engineer'])
    expect(merged.workModes).toEqual(['Remote', 'Hybrid'])
    expect(merged.minSalary).toBe('15000000')
  })

  it('does not overwrite a custom field with the same key', () => {
    const current = profileWith((p) => {
      p.custom.push({ id: 'k1', key: 'gaji', value: '8 juta' })
    })
    const merged = mergeProfile(current, sample)
    expect(merged.custom).toEqual([{ id: 'k1', key: 'gaji', value: '8 juta' }])
  })
})

describe('applyImport', () => {
  it('replaces the whole profile in replace mode', () => {
    const current = profileWith((p) => {
      p.personal.firstName = 'Dewi'
    })
    expect(applyImport(current, sample, 'replace')).toEqual(sample)
  })

  it('merges in merge mode', () => {
    const current = profileWith((p) => {
      p.personal.firstName = 'Dewi'
    })
    expect(applyImport(current, sample, 'merge').personal.firstName).toBe('Dewi')
  })
})

describe('diffImport', () => {
  it('lists only the sections that would change', () => {
    const changes = diffImport(createEmptyProfile(), sample, 'merge')
    expect(changes.map((c) => c.label)).toEqual(['Personal Info', 'Contact & Address', 'Education', 'Work Experience', 'Skill', 'Custom Field'])
    expect(changes.find((c) => c.label === 'Education')).toEqual({ label: 'Education', before: '0 entri', after: '1 entri' })
  })

  it('is empty when importing the same profile', () => {
    expect(diffImport(sample, sample, 'merge')).toEqual([])
    expect(diffImport(sample, sample, 'replace')).toEqual([])
  })

  it('shows replace removing what the file does not have', () => {
    const changes = diffImport(sample, createEmptyProfile(), 'replace')
    expect(changes.find((c) => c.label === 'Work Experience')).toEqual({ label: 'Work Experience', before: '1 entri', after: '0 entri' })
  })

  it('lists job preferences when they would change', () => {
    const incoming = profileWith((p) => {
      p.jobPrefs.roles = ['Frontend Engineer']
      p.jobPrefs.level = 'Mid'
    })
    expect(diffImport(createEmptyProfile(), incoming, 'merge')).toEqual([
      { label: 'Preferensi kerja', before: '0 bagian', after: '2 bagian' },
    ])
  })

  it('shows merge leaving current-only data alone', () => {
    expect(diffImport(sample, createEmptyProfile(), 'merge')).toEqual([])
  })
})

describe('summarizeImport', () => {
  it('counts the fields filled and entries added', () => {
    const result = applyImport(createEmptyProfile(), sample, 'merge')
    expect(summarizeImport(createEmptyProfile(), result)).toEqual({
      title: '7 entri diimpor',
      detail: '3 field terisi · 1 pendidikan, 1 pengalaman, 1 skill, 1 custom field ditambah.',
    })
  })

  it('counts job preferences that were filled', () => {
    const incoming = profileWith((p) => {
      p.jobPrefs.roles = ['Frontend Engineer']
    })
    expect(summarizeImport(createEmptyProfile(), applyImport(createEmptyProfile(), incoming, 'merge'))).toEqual({
      title: '1 entri diimpor',
      detail: '1 preferensi kerja terisi',
    })
  })

  it('says so when nothing changed', () => {
    expect(summarizeImport(sample, sample)).toEqual({
      title: '0 entri diimpor',
      detail: 'Profil sudah sama dengan isi berkas.',
    })
  })
})

describe('eventForImportFile', () => {
  const file = { name: 'job-kit-export.json', size: 321 }

  it('opens a preview with the changes for both modes', () => {
    const event = eventForImportFile(file, buildExport(sample, NOW), createEmptyProfile())
    expect(event).toEqual({
      type: 'preview-import',
      fileName: 'job-kit-export.json',
      fileSize: 321,
      profile: sample,
      applications: EMPTY_APPLICATION_DATA,
      changes: {
        merge: diffImport(createEmptyProfile(), sample, 'merge'),
        replace: diffImport(createEmptyProfile(), sample, 'replace'),
      },
    })
  })

  it('adds the application changes to the preview', () => {
    const data: ApplicationData = { applications: [application('a1'), application('a2')], cvs: [], letters: [] }
    const event = eventForImportFile(file, buildExport(sample, NOW, [], data), sample, EMPTY_APPLICATION_DATA)
    if (event.type !== 'preview-import') throw new Error('expected a preview')
    expect(event.applications).toEqual(data)
    expect(event.changes.merge).toEqual([{ label: 'Lamaran', before: '0 lamaran', after: '2 lamaran' }])
    expect(event.changes.replace).toEqual([{ label: 'Lamaran', before: '0 lamaran', after: '2 lamaran' }])
  })

  it('turns a bad file into a rejection that names the cause', () => {
    expect(eventForImportFile(file, 'bukan json', createEmptyProfile())).toEqual({
      type: 'reject-import',
      fileName: 'job-kit-export.json',
      reason: 'not-json',
      detail: '',
    })
  })
})

describe('diffApplications', () => {
  const two: ApplicationData = { applications: [application('a1'), application('a2')], cvs: [], letters: [] }
  const one: ApplicationData = { applications: [application('a1')], cvs: [], letters: [] }

  it('shows merge adding the applications that are new', () => {
    expect(diffApplications(one, two, 'merge')).toEqual([{ label: 'Lamaran', before: '1 lamaran', after: '2 lamaran' }])
  })

  it('shows replace removing the ones the file does not have', () => {
    expect(diffApplications(two, one, 'replace')).toEqual([{ label: 'Lamaran', before: '2 lamaran', after: '1 lamaran' }])
  })

  it('is empty when nothing would change, and when the file has no applications at all', () => {
    expect(diffApplications(one, one, 'merge')).toEqual([])
    expect(diffApplications(two, null, 'replace')).toEqual([])
  })

  it('shows a replace that swaps one application for another', () => {
    const other: ApplicationData = { applications: [application('b1')], cvs: [], letters: [] }
    expect(diffApplications(one, other, 'replace')).toEqual([{ label: 'Lamaran', before: '1 lamaran', after: '1 lamaran' }])
  })
})

describe('summarizeImport with applications', () => {
  it('counts the applications that were added', () => {
    expect(summarizeImport(sample, sample, 3)).toEqual({ title: '3 entri diimpor', detail: '3 lamaran ditambah.' })
  })
})
