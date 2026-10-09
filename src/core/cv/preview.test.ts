import { describe, expect, it } from 'vitest'
import { CLEAN_ID, NO_IDENTITY, TWO_COLUMN_EN } from '../../../fixtures/cv/text-fixtures'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import { parseCv } from './parse'
import { buildCvPreview, defaultSelection, toggleSelection } from './preview'

function profileWith(change: (profile: Profile) => void): Profile {
  const profile = createEmptyProfile()
  change(profile)
  return profile
}

describe('buildCvPreview', () => {
  it('lists every detected field with its old and new value, in the order the forms use', () => {
    const { rows } = buildCvPreview(parseCv(CLEAN_ID), createEmptyProfile())
    const scalar = rows.filter((row) => row.group === 'personal' || row.group === 'contact')
    expect(scalar.map((row) => [row.id, row.label, row.oldValue, row.newValue])).toEqual([
      ['personal.firstName', 'Nama depan', '', 'Rani'],
      ['personal.middleName', 'Nama tengah', '', 'Wijaya'],
      ['personal.lastName', 'Nama belakang', '', 'Contoh'],
      ['contact.email', 'Email', '', 'rani.contoh@example.test'],
      ['contact.phone', 'Telepon', '', '+62 812-0000-0001'],
      ['contact.linkedin', 'LinkedIn', '', 'linkedin.com/in/rani-contoh-sintetis'],
      ['contact.city', 'Kota', '', 'Bandung'],
    ])
  })

  it('shows the value already in the profile next to the detected one', () => {
    const profile = profileWith((p) => {
      p.personal.lastName = 'Wijaya'
    })
    const row = buildCvPreview(parseCv(CLEAN_ID), profile).rows.find((r) => r.id === 'personal.lastName')
    expect(row).toMatchObject({ oldValue: 'Wijaya', newValue: 'Contoh', occupied: true })
  })

  it('carries the parser confidence over so the preview can say "Periksa lagi"', () => {
    const rows = buildCvPreview(parseCv(TWO_COLUMN_EN), createEmptyProfile()).rows
    expect(rows.find((r) => r.id === 'contact.linkedin')?.confidence).toBe('low')
    expect(rows.find((r) => r.id === 'contact.email')?.confidence).toBe('high')
  })

  it('makes one row per education and experience entry, summarised on a few lines', () => {
    const rows = buildCvPreview(parseCv(CLEAN_ID), createEmptyProfile()).rows
    expect(rows.find((r) => r.id === 'education.0')).toMatchObject({
      group: 'education',
      label: 'Universitas Contoh Nusantara',
      newValue: 'S1 Teknik Informatika · IPK 3,62 · 2022',
    })
    expect(rows.find((r) => r.id === 'experience.0')).toMatchObject({
      group: 'experience',
      label: 'Software Engineer',
      newValue: 'PT Contoh Teknologi · Agustus 2022 - sekarang',
    })
    expect(rows.find((r) => r.id === 'experience.1')).toMatchObject({ newValue: 'CV Contoh Digital · Januari 2022 - Juni 2022' })
  })

  it('marks an entry low when any of its parts is low', () => {
    const text = `Education
Sample University
Jurusan Teknik Sipil
2015 - 2019`
    expect(buildCvPreview(parseCv(text), createEmptyProfile()).rows[0]?.confidence).toBe('low')
  })

  it('passes the text it could not place through, as written', () => {
    const text = `Pengalaman
Kasir
2020 - 2021`
    expect(buildCvPreview(parseCv(text), createEmptyProfile()).unparsed).toEqual([{ kind: 'experience', text: 'Kasir\n2020 - 2021' }])
  })

  it('has no rows when nothing was detected', () => {
    expect(buildCvPreview(parseCv(NO_IDENTITY), createEmptyProfile())).toEqual({ rows: [], unparsed: [] })
  })

  it('flags an entry the profile already has', () => {
    const profile = profileWith((p) => {
      p.education.push({ id: 'e1', institution: 'universitas contoh nusantara', level: 'S1', major: 'Informatika', gpa: '', year: '2022' })
    })
    expect(buildCvPreview(parseCv(CLEAN_ID), profile).rows.find((r) => r.id === 'education.0')).toMatchObject({
      duplicate: true,
      occupied: true,
    })
  })
})

describe('defaultSelection', () => {
  it('selects only the fields that are still empty in the profile', () => {
    const profile = profileWith((p) => {
      p.personal.firstName = 'Dewi'
      p.contact.email = 'dewi@example.test'
    })
    const { rows } = buildCvPreview(parseCv(CLEAN_ID), profile)
    const selected = defaultSelection(rows)
    expect(selected).not.toContain('personal.firstName')
    expect(selected).not.toContain('contact.email')
    expect(selected).toContain('personal.lastName')
    expect(selected).toContain('contact.phone')
  })

  it('selects every entry of a section that is empty in the profile', () => {
    const { rows } = buildCvPreview(parseCv(CLEAN_ID), createEmptyProfile())
    expect(defaultSelection(rows)).toEqual(expect.arrayContaining(['education.0', 'experience.0', 'experience.1']))
  })

  it('leaves entries unselected when the profile already has entries in that section', () => {
    const profile = profileWith((p) => {
      p.experience.push({ id: 'x1', company: 'PT Lain', title: 'Analis', start: '2019', end: '2021', current: false, description: '' })
    })
    const selected = defaultSelection(buildCvPreview(parseCv(CLEAN_ID), profile).rows)
    expect(selected).not.toContain('experience.0')
    expect(selected).toContain('education.0')
  })
})

describe('toggleSelection', () => {
  it('adds an id that is not selected and removes one that is', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b'])
  })
})
