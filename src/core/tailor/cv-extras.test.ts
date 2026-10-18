import { describe, expect, it } from 'vitest'
import { createProject } from '../profile/entries'
import { parseImport, mergeProfile } from '../data/import'
import type { Profile } from '../profile/types'
import { assemble } from './grounded'
import { profileHash } from './hash'
import { A4, layoutCv, type Measure, type PdfOp } from './pdf-layout'
import { cvToText } from './cv-text'
import { SAMPLE_WEB_DEV } from './sample-profiles'

const measure: Measure = (text, _bold, size) => text.length * size * 0.5
const empty = { skills: [], experience: [], education: [] }
const texts = (pages: PdfOp[][]) => pages.flat().flatMap((op) => (op.kind === 'text' ? [op] : []))

// A profile with every optional field filled, all invented.
function full(): Profile {
  const base = structuredClone(SAMPLE_WEB_DEV)
  base.summary = 'Pengembang web dengan pengalaman membangun dashboard.'
  base.experience[0]!.location = 'Denpasar'
  base.education[0]!.location = 'Bandung'
  base.education[0]!.publication = 'Judul Makalah Contoh, IEEE (2025)'
  base.education[0]!.achievements = 'Juara 1 Lomba Contoh (2024)\n\nTop 10 Kompetisi Contoh (2024)'
  base.projects = [{ id: 'p1', name: 'BukuContoh', role: 'Fullstack', date: 'Nov 2024', description: 'Platform ulasan buku\nForum diskusi\n' }]
  return base
}

describe('assemble with the optional Profile fields', () => {
  it('carries the summary, locations, publication, achievements and projects from the Profile', () => {
    const doc = assemble(full(), empty)
    expect(doc.summary).toBe('Pengembang web dengan pengalaman membangun dashboard.')
    expect(doc.experience[0]!.location).toBe('Denpasar')
    expect(doc.education[0]).toMatchObject({ location: 'Bandung', publication: 'Judul Makalah Contoh, IEEE (2025)', achievements: ['Juara 1 Lomba Contoh (2024)', 'Top 10 Kompetisi Contoh (2024)'] })
    expect(doc.projects).toEqual([{ id: 'p1', name: 'BukuContoh', role: 'Fullstack', date: 'Nov 2024', bullets: ['Platform ulasan buku', 'Forum diskusi'] }])
  })

  it('leaves them empty for a profile that has none', () => {
    const doc = assemble(SAMPLE_WEB_DEV, empty)
    expect(doc.summary).toBe('')
    expect(doc.projects).toEqual([])
    expect(doc.education[0]).toMatchObject({ location: '', publication: '', achievements: [] })
  })

  it('skips a project that has no name', () => {
    const profile = full()
    profile.projects = [createProject('x')]
    expect(assemble(profile, empty).projects).toEqual([])
  })
})

describe('layoutCv with the optional parts', () => {
  const ops = () => texts(layoutCv(assemble(full(), empty), 'en', measure))

  it('centres the summary under the contacts', () => {
    const summary = ops().find((op) => op.text.startsWith('Pengembang web'))!
    expect(summary.x).toBeCloseTo((A4.width - measure(summary.text, false, 10)) / 2)
  })

  it('puts the place in grey after the company, with the dates on the same line', () => {
    const all = ops()
    const company = all.find((op) => op.text === 'PT Contoh Teknologi')!
    const place = all.find((op) => op.text === '- Denpasar')!
    expect(place).toMatchObject({ bold: true, y: company.y })
    expect(place.gray).toBeGreaterThan(company.gray)
    expect(place.x).toBeGreaterThan(company.x)
  })

  it('writes GPA, Publication and Achievements with a bold label, achievements as dashes', () => {
    const all = ops()
    for (const label of ['GPA:', 'Publication:', 'Achievements:']) expect(all.find((op) => op.text === label), label).toMatchObject({ bold: true })
    expect(all.filter((op) => op.text === '-').length).toBeGreaterThanOrEqual(2)
    expect(all.some((op) => op.text === 'Top 10 Kompetisi Contoh (2024)')).toBe(true)
  })

  it('adds a Projects section between Experience and Skills, with name, dates, role and bullets', () => {
    const all = ops()
    const heading = (title: string) => all.findIndex((op) => op.size === 12 && op.text === title)
    expect(heading('Experience')).toBeLessThan(heading('Projects'))
    expect(heading('Projects')).toBeLessThan(heading('Skills'))
    const name = all.find((op) => op.text === 'BukuContoh')!
    expect(all.find((op) => op.text === 'Nov 2024')!.y).toBe(name.y)
    expect(all.find((op) => op.text === 'Fullstack')).toMatchObject({ italic: true })
    expect(all.some((op) => op.text === 'Forum diskusi')).toBe(true)
  })

  it('keeps every line inside the margins', () => {
    for (const op of ops()) expect(op.x + measure(op.text, op.bold, op.size)).toBeLessThanOrEqual(A4.width - A4.margin + 0.001)
  })
})

describe('plain text copy with the optional parts', () => {
  it('includes the summary, GPA, publication, achievements and projects', () => {
    const text = cvToText(assemble(full(), empty), 'en')
    for (const part of ['Pengembang web dengan', 'Denpasar', 'GPA: 3.5', 'Publication: Judul Makalah', '- Juara 1 Lomba Contoh (2024)', 'PROJECTS', 'BukuContoh', '- Forum diskusi']) {
      expect(text, part).toContain(part)
    }
  })
})

describe('profileHash', () => {
  it('does not change for a profile that has none of the optional fields', () => {
    const plain = structuredClone(SAMPLE_WEB_DEV)
    const withEmpty: Profile = { ...plain, summary: '', projects: [] }
    expect(profileHash(withEmpty)).toBe(profileHash(plain))
  })

  it('changes when the summary, a project, a location or an achievement changes', () => {
    const base = profileHash(full())
    const edit = (change: (p: Profile) => void) => {
      const p = full()
      change(p)
      return profileHash(p)
    }
    expect(edit((p) => (p.summary = 'Lain'))).not.toBe(base)
    expect(edit((p) => (p.projects![0]!.name = 'Lain'))).not.toBe(base)
    expect(edit((p) => (p.experience[0]!.location = 'Lain'))).not.toBe(base)
    expect(edit((p) => (p.education[0]!.achievements = 'Lain'))).not.toBe(base)
  })
})

describe('export and import keep the optional fields', () => {
  const file = (profile: Profile) => JSON.stringify({ app: 'job-kit', version: 3, profile, applications: [], cvs: [], letters: [] })

  it('reads them back from an export file', () => {
    const parsed = parseImport(file(full()))
    if (!parsed.ok) throw new Error('not ok')
    expect(parsed.profile.summary).toBe(full().summary)
    expect(parsed.profile.projects).toEqual(full().projects)
    expect(parsed.profile.education[0]).toMatchObject({ location: 'Bandung', publication: full().education[0]!.publication })
    expect(parsed.profile.experience[0]!.location).toBe('Denpasar')
  })

  it('leaves them out of a profile that never had them', () => {
    const parsed = parseImport(file(structuredClone(SAMPLE_WEB_DEV)))
    if (!parsed.ok) throw new Error('not ok')
    expect('summary' in parsed.profile).toBe(false)
    expect('projects' in parsed.profile).toBe(false)
    expect('location' in parsed.profile.education[0]!).toBe(false)
  })

  it('merge keeps the summary already here and adds only new projects', () => {
    const current = full()
    const incoming = full()
    incoming.summary = 'Ringkasan lain'
    incoming.projects = [...incoming.projects!, { id: 'p2', name: 'Proyek Baru', role: '', date: '', description: '' }]
    const merged = mergeProfile(current, incoming)
    expect(merged.summary).toBe(current.summary)
    expect(merged.projects!.map((p) => p.name)).toEqual(['BukuContoh', 'Proyek Baru'])
  })
})
