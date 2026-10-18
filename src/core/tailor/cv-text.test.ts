import { describe, expect, it } from 'vitest'
import { cvToText } from './cv-text'
import { assemble } from './grounded'
import { SAMPLE_DATA_ANALYST, SAMPLE_WEB_DEV } from './sample-profiles'

const empty = { skills: [], experience: [], education: [] }

describe('cvToText (the CV as plain text, for Salin when the PDF fails, PRD §8)', () => {
  it('writes the name, contacts, sections, jobs and bullets in order', () => {
    const text = cvToText(assemble(SAMPLE_WEB_DEV, empty), 'id')
    expect(text.split('\n')).toEqual([
      'Sari Contohwati',
      '081200000000 · sari@example.test · Denpasar',
      '',
      'SKILL',
      'TypeScript, React, Node.js, PostgreSQL, Git, REST API, Jest',
      '',
      'PENGALAMAN',
      'Software Engineer',
      'PT Contoh Teknologi · Agu 2023 – sekarang',
      '- Membangun fitur dashboard pelanggan dengan React dan TypeScript.',
      '- Menulis REST API dengan Node.js dan PostgreSQL.',
      '- Menulis tes unit dengan Jest sehingga cakupan tes naik dari 40% ke 70%.',
      '- Ikut code review dua kali seminggu.',
      '',
      'Staf Magang Pengembangan Web',
      'CV Contoh Digital · Jan 2022 – Jun 2022',
      '- Memperbaiki bug tampilan di situs perusahaan.',
      '- Membantu memindahkan halaman statis ke React.',
      '',
      'PENDIDIKAN',
      'S1 Teknik Informatika',
      'Universitas Contoh Nusantara · 2022',
      'IPK: 3.5',
    ])
  })

  it('uses English section names and "present" for an English CV', () => {
    const text = cvToText(assemble(SAMPLE_DATA_ANALYST, empty), 'en')
    expect(text).toContain('EXPERIENCE')
    expect(text).toContain('EDUCATION')
    expect(text).toContain('Sample Analytics Ltd · Mar 2021 – present')
  })

  it('leaves out a section the CV does not have', () => {
    const doc = assemble(SAMPLE_WEB_DEV, empty)
    doc.education = []
    expect(cvToText(doc, 'id')).not.toContain('PENDIDIKAN')
  })

  it('keeps every character as written: no WinAnsi cleaning, since text is not drawn with the PDF fonts', () => {
    const doc = assemble(SAMPLE_WEB_DEV, empty)
    doc.header.name = 'Nguyễn 李'
    expect(cvToText(doc, 'id').split('\n')[0]).toBe('Nguyễn 李')
  })
})
