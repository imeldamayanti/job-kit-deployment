import { describe, expect, it } from 'vitest'
import { compareCv, diffWords, matchBullets, type Seg } from './diff'
import { SAMPLE_WEB_DEV } from './sample-profiles'

const text = (segs: Seg[]) => segs.map((s) => s.text).join('')
const of = (segs: Seg[], kind: Seg['kind']) => segs.filter((s) => s.kind === kind).map((s) => s.text.trim())

describe('diffWords', () => {
  it('marks what was cut on the left and what was added on the right, and keeps the rest', () => {
    const { before, after } = diffWords('Membuat halaman dashboard internal pakai React dan TypeScript.', 'Membangun dashboard internal dengan React dan TypeScript.')
    expect(of(before, 'rm')).toEqual(['Membuat halaman', 'pakai'])
    expect(of(after, 'add')).toEqual(['Membangun', 'dengan'])
    expect(of(before, 'same').join(' ')).toBe('dashboard internal React dan TypeScript.')
    expect(of(after, 'same').join(' ')).toBe('dashboard internal React dan TypeScript.')
  })

  it('gives back each side whole: the left reads as the original and the right as the new sentence', () => {
    const a = 'Mengurangi waktu muat halaman 40%.'
    const b = 'Mengurangi waktu muat 40% lewat perapian komponen.'
    const { before, after } = diffWords(a, b)
    expect(text(before).trim()).toBe(a)
    expect(text(after).trim()).toBe(b)
  })

  it('does not count a trailing comma or full stop, or letter case, as a change', () => {
    const { before, after } = diffWords('Membangun UI dengan React.', 'membangun UI dengan react')
    expect(before.every((s) => s.kind === 'same')).toBe(true)
    expect(after.every((s) => s.kind === 'same')).toBe(true)
  })

  it('joins neighbouring words of the same kind into one piece', () => {
    const { after } = diffWords('Satu dua', 'Satu tiga empat lima dua')
    expect(after.filter((s) => s.kind === 'add')).toHaveLength(1)
    expect(of(after, 'add')).toEqual(['tiga empat lima'])
  })

  it('treats an empty side as all added or all cut', () => {
    expect(diffWords('', 'Baru sama sekali').after).toEqual([{ text: 'Baru sama sekali', kind: 'add' }])
    expect(diffWords('Dibuang semua', '').before).toEqual([{ text: 'Dibuang semua', kind: 'rm' }])
    expect(diffWords('', '')).toEqual({ before: [], after: [] })
  })

  it('shows identical sentences as unchanged', () => {
    const { before, after } = diffWords('Ikut code review dua kali seminggu.', 'Ikut code review dua kali seminggu.')
    expect(before).toEqual([{ text: 'Ikut code review dua kali seminggu.', kind: 'same' }])
    expect(after).toEqual(before)
  })
})

describe('matchBullets', () => {
  const original = ['Membangun fitur dashboard pelanggan dengan React dan TypeScript.', 'Menulis REST API dengan Node.js dan PostgreSQL.', 'Ikut code review dua kali seminggu.']

  it('pairs each new bullet with the original sentence it came from, and reports the unused ones', () => {
    const { pairs, unused } = matchBullets(original, ['Membangun dashboard pelanggan dengan React dan TypeScript.', 'Menulis REST API memakai Node.js.'])
    expect(pairs.map((p) => p.before)).toEqual([original[0], original[1]])
    expect(unused).toEqual([original[2]])
  })

  it('uses each original sentence once', () => {
    const { pairs } = matchBullets(original, ['Membangun dashboard dengan React.', 'Membangun dashboard dengan TypeScript.'])
    expect(pairs.filter((p) => p.before === original[0])).toHaveLength(1)
    expect(pairs.filter((p) => p.before === null)).toHaveLength(1)
  })

  it('leaves a bullet with no resemblance to any original unpaired', () => {
    const { pairs, unused } = matchBullets(original, ['Sesuatu yang sama sekali lain.'])
    expect(pairs).toEqual([{ after: 'Sesuatu yang sama sekali lain.', before: null }])
    expect(unused).toEqual(original)
  })

  it('keeps the order of the new bullets', () => {
    const { pairs } = matchBullets(original, ['Ikut code review dua kali seminggu.', 'Menulis REST API dengan Node.js.'])
    expect(pairs.map((p) => p.after)).toEqual(['Ikut code review dua kali seminggu.', 'Menulis REST API dengan Node.js.'])
  })

  it('handles no bullets on either side', () => {
    expect(matchBullets([], [])).toEqual({ pairs: [], unused: [] })
    expect(matchBullets(original, []).unused).toEqual(original)
  })
})

describe('compareCv', () => {
  const parts = {
    skills: ['React', 'TypeScript', 'Node.js'],
    experience: [
      { sourceId: 'exp-a1', bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript.', 'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.'] },
    ],
    education: ['edu-a1'],
  }

  it('takes the facts of each experience from the Profile', () => {
    const result = compareCv(SAMPLE_WEB_DEV, parts)
    expect(result.experience).toHaveLength(1)
    expect(result.experience[0]).toMatchObject({ sourceId: 'exp-a1', title: 'Software Engineer', company: 'PT Contoh Teknologi', start: '2023-08', current: true })
  })

  it('lines up each new bullet with its original and lists the originals left out', () => {
    const exp = compareCv(SAMPLE_WEB_DEV, parts).experience[0]!
    expect(exp.rows[0]!.before).not.toBeNull()
    expect(exp.rows[0]!.after).not.toBeNull()
    expect(text(exp.rows[0]!.after!)).toBe('Membangun dashboard pelanggan dengan React dan TypeScript.')
    expect(exp.hidden).toBe(2)
    expect(exp.rows.filter((r) => r.after === null).every((r) => r.before!.every((s) => s.kind === 'rm'))).toBe(true)
  })

  it('shows a bullet that came from no original as wholly added', () => {
    const odd = compareCv(SAMPLE_WEB_DEV, { ...parts, experience: [{ sourceId: 'exp-a1', bullets: ['Hal yang lain sama sekali.'] }] }).experience[0]!
    expect(odd.rows[0]).toEqual({ before: null, after: [{ text: 'Hal yang lain sama sekali.', kind: 'add' }] })
  })

  it('says how the skills changed: order, and any left out', () => {
    const skills = compareCv(SAMPLE_WEB_DEV, parts).skills
    expect(skills.original).toEqual(SAMPLE_WEB_DEV.skills.map((s) => s.name))
    expect(skills.tailored).toEqual(['React', 'TypeScript', 'Node.js'])
    expect(skills.reordered).toBe(true)
    expect(skills.dropped).toEqual(['PostgreSQL', 'Git', 'REST API', 'Jest'])
    const same = compareCv(SAMPLE_WEB_DEV, { ...parts, skills: SAMPLE_WEB_DEV.skills.map((s) => s.name) }).skills
    expect(same.reordered).toBe(false)
    expect(same.dropped).toEqual([])
  })

  it('counts experiences of the Profile that the CV leaves out', () => {
    expect(compareCv(SAMPLE_WEB_DEV, parts).omittedExperience).toBe(1)
    expect(compareCv(SAMPLE_WEB_DEV, { ...parts, experience: [] }).omittedExperience).toBe(2)
  })

  it('carries the education the CV keeps, from the Profile', () => {
    expect(compareCv(SAMPLE_WEB_DEV, parts).education).toEqual([
      { id: 'edu-a1', institution: 'Universitas Contoh Nusantara', level: 'S1', major: 'Teknik Informatika', gpa: '3.5', year: '2022' },
    ])
  })

  it('ignores a sourceId the Profile does not have', () => {
    const result = compareCv(SAMPLE_WEB_DEV, { ...parts, experience: [{ sourceId: 'exp-zzz', bullets: ['x'] }], education: ['edu-zzz'] })
    expect(result.experience).toEqual([])
    expect(result.education).toEqual([])
  })
})
