import { describe, expect, it } from 'vitest'
import {
  CLEAN_EN,
  CLEAN_ID,
  LABELLED_ID,
  NO_IDENTITY,
  TWO_COLUMN_EN,
  TWO_COLUMN_ID,
  UNVOUCHED_NAME,
} from '../../../fixtures/cv/text-fixtures'
import { parseCv } from './parse'
import { parseSections } from './sections'

const high = (value: string) => ({ value, confidence: 'high' })
const low = (value: string) => ({ value, confidence: 'low' })

describe('parseCv education', () => {
  it('reads institution, level, major, GPA, and the year a study ended', () => {
    expect(parseCv(CLEAN_ID).education).toEqual([
      {
        institution: high('Universitas Contoh Nusantara'),
        level: high('S1'),
        major: high('Teknik Informatika'),
        gpa: high('3,62'),
        year: high('2022'),
      },
    ])
  })

  it('reads an English degree line such as "Bachelor of Statistics, GPA 3.50"', () => {
    expect(parseCv(TWO_COLUMN_EN).education).toEqual([
      {
        institution: high('Sample State University'),
        level: high('Bachelor'),
        major: high('Statistics'),
        gpa: high('3.50'),
        year: high('2020'),
      },
    ])
  })

  it('reads a degree line without a GPA', () => {
    expect(parseCv(CLEAN_EN).education).toEqual([
      {
        institution: high('Sample Institute of Design'),
        level: high('Bachelor'),
        major: high('Design'),
        year: high('2018'),
      },
    ])
  })

  it('reads the "Riwayat Pendidikan" heading and a two-column layout', () => {
    expect(parseCv(LABELLED_ID).education[0]).toMatchObject({ institution: high('Institut Contoh Surabaya'), level: high('S1'), gpa: high('3,40') })
    expect(parseCv(TWO_COLUMN_ID).education).toEqual([
      { institution: high('Universitas Contoh Depok'), level: high('S1'), major: high('Akuntansi'), year: high('2020') },
    ])
  })

  it('takes the level from a school name such as SMA', () => {
    expect(parseCv(UNVOUCHED_NAME).education).toEqual([{ institution: high('SMA Contoh 1'), level: high('SMA') }])
  })

  it('splits several entries at each institution', () => {
    const text = `Pendidikan
Universitas Contoh Satu
S2 Manajemen
2022 - 2024
Universitas Contoh Dua
S1 Akuntansi
2018 - 2022`
    const { education } = parseCv(text)
    expect(education.map((e) => e.institution?.value)).toEqual(['Universitas Contoh Satu', 'Universitas Contoh Dua'])
    expect(education.map((e) => e.year?.value)).toEqual(['2024', '2022'])
  })

  it('asks for a second look at a major that sits on its own line, without a level to anchor it', () => {
    const text = `Education
Sample University
Jurusan Teknik Sipil
2015 - 2019`
    expect(parseCv(text).education).toEqual([
      { institution: high('Sample University'), major: low('Teknik Sipil'), year: high('2019') },
    ])
  })

  it('leaves the year out of a study that is still going', () => {
    const text = `Pendidikan
Universitas Contoh Satu
S2 Manajemen
2024 - Sekarang`
    expect(parseCv(text).education[0]?.year).toBeUndefined()
  })
})

describe('parseCv experience', () => {
  it('reads title, company, period, and description, and flags a job that is still going', () => {
    expect(parseCv(CLEAN_ID).experience).toEqual([
      {
        title: high('Software Engineer'),
        company: high('PT Contoh Teknologi'),
        start: high('Agustus 2022'),
        current: true,
        description: high('Membangun fitur web dengan TypeScript dan React.'),
      },
      {
        title: high('Staf Magang'),
        company: high('CV Contoh Digital'),
        start: high('Januari 2022'),
        end: high('Juni 2022'),
        current: false,
        description: high('Membantu pengujian aplikasi internal.'),
      },
    ])
  })

  it('reads "Title - Company" and an English period', () => {
    expect(parseCv(TWO_COLUMN_EN).experience).toEqual([
      {
        title: high('Data Analyst'),
        company: high('Sample Analytics Ltd'),
        start: high('Mar 2021'),
        current: true,
        description: high('Built dashboards and reports for the sales team.'),
      },
    ])
  })

  it('reads year-only periods and an entry without a description', () => {
    expect(parseCv(LABELLED_ID).experience).toEqual([
      { title: high('Analis Sistem'), company: high('PT Contoh Mandiri'), start: high('2019'), end: high('2023'), current: false },
    ])
    expect(parseCv(TWO_COLUMN_ID).experience[0]).toMatchObject({ title: high('Akuntan Junior'), company: high('PT Contoh Sejahtera') })
  })

  it('keeps bullet points as separate lines of the description', () => {
    const text = `Work Experience
Engineer - Contoh Labs
Jan 2020 - Dec 2021
• Built the importer
• Wrote the tests`
    expect(parseCv(text).experience[0]?.description).toEqual(high('Built the importer\nWrote the tests'))
  })

  it('reads a title and company on separate lines, calling the one with a company marker the company', () => {
    const text = `Pengalaman Kerja
Analis Data
PT Contoh Abadi Tbk
2021 - 2023`
    expect(parseCv(text).experience).toEqual([
      { title: high('Analis Data'), company: high('PT Contoh Abadi Tbk'), start: high('2021'), end: high('2023'), current: false },
    ])
  })

  it('reads a period on the same line as the title and company', () => {
    const text = `Experience
Designer | Contoh Studio | Jan 2019 - Mar 2020`
    expect(parseCv(text).experience).toEqual([
      { title: high('Designer'), company: high('Contoh Studio'), start: high('Jan 2019'), end: high('Mar 2020'), current: false },
    ])
  })

  it.each([
    'Jan 2020 - Present',
    'Januari 2020 - Sekarang',
    '2020 - saat ini',
    '01/2020 - sekarang',
    'Jan 2020 to present',
  ])('treats "%s" as a job that is still going', (period) => {
    const text = `Pengalaman Kerja\nKasir, Toko Contoh\n${period}`
    const [entry] = parseCv(text).experience
    expect(entry?.current).toBe(true)
    expect(entry?.end).toBeUndefined()
    expect(entry?.start?.value).toMatch(/2020/)
  })
})

describe('parseCv headings', () => {
  it.each([
    ['Professional Experience', 'experience'],
    ['Riwayat Pekerjaan', 'experience'],
    ['Employment History', 'experience'],
    ['PENGALAMAN KERJA', 'experience'],
    ['Work Experience:', 'experience'],
    ['Pendidikan Formal', 'education'],
    ['EDUCATION', 'education'],
  ])('recognises "%s"', (heading, kind) => {
    const body = kind === 'education' ? 'Universitas Contoh\nS1 Hukum' : 'Kasir, Toko Contoh\n2020 - 2021'
    const cv = parseCv(`${heading}\n${body}`)
    expect(kind === 'education' ? cv.education : cv.experience).toHaveLength(1)
  })

  it('ignores sections it does not map, such as skills and summary', () => {
    const cv = parseCv(CLEAN_EN)
    expect(cv.experience).toEqual([])
    expect(cv.unparsed).toEqual([])
  })
})

describe('parseCv unparsed', () => {
  it('returns the raw text of an entry whose structure is unclear, instead of guessing', () => {
    const text = `Pengalaman
Kasir
2020 - 2021`
    expect(parseCv(text).experience).toEqual([])
    expect(parseCv(text).unparsed).toEqual([{ kind: 'experience', text: 'Kasir\n2020 - 2021' }])
  })

  it('returns a section that has no recognisable entries as raw text', () => {
    const text = `Pengalaman Kerja
Pernah bekerja sebagai kasir di beberapa toko selama dua tahun.`
    expect(parseCv(text).unparsed).toEqual([
      { kind: 'experience', text: 'Pernah bekerja sebagai kasir di beberapa toko selama dua tahun.' },
    ])
  })

  it('returns an education block without a recognisable institution as raw text', () => {
    const text = `Pendidikan
ITB Teknik Sipil 2015 - 2019`
    const cv = parseCv(text)
    expect(cv.education).toEqual([])
    expect(cv.unparsed).toEqual([{ kind: 'education', text: 'ITB Teknik Sipil 2015 - 2019' }])
  })

  it('keeps recognised entries and returns only the stray lines as raw text', () => {
    const text = `Pendidikan
Catatan: lulus dengan pujian
Universitas Contoh Satu
S1 Hukum
2015 - 2019`
    const cv = parseCv(text)
    expect(cv.education).toHaveLength(1)
    expect(cv.unparsed).toEqual([{ kind: 'education', text: 'Catatan: lulus dengan pujian' }])
  })

  it('returns nothing for text without these sections', () => {
    const cv = parseCv(NO_IDENTITY)
    expect(cv.education).toEqual([])
    expect(cv.experience).toEqual([])
    expect(cv.unparsed).toEqual([])
  })
})

describe('CV without institution line or dates', () => {
  const lines = [
    'Education',
    'Bachelor of Informatics',
    '• GPA: 3.87/4.00',
    'Work Experiences',
    'iOS Developer Learner',
    '• Led end-to-end development of KIDA, a kids’ animation app',
    '• Designed and built 4+ iOS applications in Swift',
    'WordPress Developer',
    '• Plan, create, and design internet sites',
  ]

  it('reads the degree, GPA and undated entries', () => {
    const result = parseSections(lines)
    expect(result.education).toEqual([{ level: { value: 'Bachelor', confidence: 'high' }, major: { value: 'Informatics', confidence: 'high' }, gpa: { value: '3.87', confidence: 'high' } }])
    expect(result.experience.map((entry) => entry.title?.value)).toEqual(['iOS Developer Learner', 'WordPress Developer'])
    expect(result.experience[0]?.description?.value).toContain('Designed and built')
  })
})
