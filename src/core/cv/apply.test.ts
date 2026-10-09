import { describe, expect, it } from 'vitest'
import { CLEAN_ID } from '../../../fixtures/cv/text-fixtures'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import { applyCvSelection, summarizeCvImport } from './apply'
import { parseCv } from './parse'
import { buildCvPreview, defaultSelection } from './preview'

const draft = parseCv(CLEAN_ID)
const ids = () => {
  let n = 0
  return () => `new-${(n += 1)}`
}

function profileWith(change: (profile: Profile) => void): Profile {
  const profile = createEmptyProfile()
  change(profile)
  return profile
}

describe('applyCvSelection', () => {
  it('fills the selected fields and leaves the rest alone', () => {
    const { profile } = applyCvSelection(createEmptyProfile(), draft, ['personal.firstName', 'contact.email'], ids())
    expect(profile.personal.firstName).toBe('Rani')
    expect(profile.contact.email).toBe('rani.contoh@example.test')
    expect(profile.personal.lastName).toBe('')
    expect(profile.contact.phone).toBe('')
  })

  it('does not overwrite a filled field that was not selected', () => {
    const before = profileWith((p) => {
      p.personal.lastName = 'Wijaya'
    })
    const selected = defaultSelection(buildCvPreview(draft, before).rows)
    const { profile } = applyCvSelection(before, draft, selected, ids())
    expect(profile.personal.lastName).toBe('Wijaya')
    expect(profile.personal.firstName).toBe('Rani')
  })

  it('overwrites a filled field only when it is selected explicitly', () => {
    const before = profileWith((p) => {
      p.personal.lastName = 'Wijaya'
    })
    const { profile } = applyCvSelection(before, draft, ['personal.lastName'], ids())
    expect(profile.personal.lastName).toBe('Contoh')
  })

  it('adds selected education and experience entries after the ones already there', () => {
    const before = profileWith((p) => {
      p.experience.push({ id: 'x0', company: 'PT Lain', title: 'Analis', start: '2019', end: '2021', current: false, description: '' })
    })
    const { profile } = applyCvSelection(before, draft, ['education.0', 'experience.1'], ids())
    expect(profile.education).toEqual([
      { id: 'new-1', institution: 'Universitas Contoh Nusantara', level: 'S1', major: 'Teknik Informatika', gpa: '3,62', year: '2022' },
    ])
    expect(profile.experience).toEqual([
      before.experience[0],
      {
        id: 'new-2',
        company: 'CV Contoh Digital',
        title: 'Staf Magang',
        start: 'Januari 2022',
        end: 'Juni 2022',
        current: false,
        description: 'Membantu pengujian aplikasi internal.',
      },
    ])
  })

  it('keeps a job that is still going as current, with no end date', () => {
    const { profile } = applyCvSelection(createEmptyProfile(), draft, ['experience.0'], ids())
    expect(profile.experience[0]).toMatchObject({ title: 'Software Engineer', start: 'Agustus 2022', end: '', current: true })
  })

  it('does not add entries that were not selected', () => {
    const { profile } = applyCvSelection(createEmptyProfile(), draft, ['personal.firstName'], ids())
    expect(profile.education).toEqual([])
    expect(profile.experience).toEqual([])
  })

  it('ignores a selected id the CV does not have', () => {
    const before = createEmptyProfile()
    const result = applyCvSelection(before, draft, ['personal.birthDate', 'education.9', 'nonsense'], ids())
    expect(result.profile).toEqual(before)
    expect(result.filled).toBe(0)
  })

  it('counts what was filled and what was skipped', () => {
    const before = profileWith((p) => {
      p.personal.lastName = 'Wijaya'
    })
    const rows = buildCvPreview(draft, before).rows
    const result = applyCvSelection(before, draft, defaultSelection(rows), ids())
    expect(result.filled).toBe(rows.length - 1)
    expect(result.skipped).toBe(1)
  })

  it('does not change the profile it was given', () => {
    const before = createEmptyProfile()
    applyCvSelection(before, draft, ['personal.firstName', 'education.0'], ids())
    expect(before).toEqual(createEmptyProfile())
  })
})

describe('summarizeCvImport', () => {
  it('states the numbers the way the screen shows them', () => {
    expect(summarizeCvImport({ filled: 8, skipped: 2 })).toEqual({
      title: '8 field diisi, 2 dilewati',
      detail: 'Yang tidak dicentang tidak diubah. Periksa hasilnya di halaman profil.',
    })
  })
})
