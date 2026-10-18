import { describe, expect, it } from 'vitest'
import { CV_LABELS, detectLanguage } from './language'

describe('detectLanguage', () => {
  it('reads Indonesian', () => {
    expect(detectLanguage('Membangun fitur dashboard pelanggan dengan React dan TypeScript untuk tim operasional.')).toBe('id')
    expect(detectLanguage('Kami mencari engineer yang bisa bekerja sama dalam tim dan memiliki pengalaman minimal dua tahun.')).toBe('id')
  })

  it('reads English', () => {
    expect(detectLanguage('Built weekly sales dashboards in Tableau for the regional team.')).toBe('en')
    expect(detectLanguage('We are looking for an engineer with experience in building and testing software.')).toBe('en')
  })

  it('is not thrown by technical terms, which are the same in both', () => {
    expect(detectLanguage('React TypeScript Node.js PostgreSQL REST API dengan tim')).toBe('id')
    expect(detectLanguage('React TypeScript Node.js PostgreSQL REST API for the team')).toBe('en')
  })

  it('goes by the larger share when a text mixes the two', () => {
    expect(detectLanguage('Membangun dashboard dengan React dan membuat code review for the team untuk tim operasional dan layanan')).toBe('id')
  })

  it('falls back to Indonesian when there is nothing to go by', () => {
    expect(detectLanguage('')).toBe('id')
    expect(detectLanguage('React TypeScript 2023')).toBe('id')
  })

  it('ignores case and punctuation', () => {
    expect(detectLanguage('THE TEAM, AND THE PRODUCT!')).toBe('en')
  })
})

describe('CV_LABELS', () => {
  it('has the section names in both languages', () => {
    expect(CV_LABELS.id).toMatchObject({ skills: 'Skill', experience: 'Pengalaman', education: 'Pendidikan', projects: 'Proyek', now: 'sekarang' })
    expect(CV_LABELS.en).toMatchObject({ skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects', now: 'present' })
  })
})
