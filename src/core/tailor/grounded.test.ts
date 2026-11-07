import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Profile } from '../profile/types'
import { assemble, bulletsFromDescription, checkText, validateGrounded, violationMessage } from './grounded'
import { SAMPLE_DATA_ANALYST, SAMPLE_IT_SUPPORT, SAMPLE_PROFILES, SAMPLE_WEB_DEV } from './sample-profiles'
import type { TailorOutput } from './types'

const A = SAMPLE_WEB_DEV

const good = (): TailorOutput => ({
  skills: ['react', 'TypeScript', 'Node.js'],
  experience: [
    {
      sourceId: 'exp-a1',
      bullets: ['Membangun dashboard pelanggan dengan React dan TypeScript.', 'Menaikkan cakupan tes dari 40% ke 70% dengan Jest.'],
    },
  ],
  education: ['edu-a1'],
})

const kinds = (output: TailorOutput, profile: Profile = A) =>
  validateGrounded(output, profile).violations.map((v) => `${v.type}:${v.value}`).sort()

describe('validateGrounded', () => {
  it('passes skills that are only rearranged and bullets that are only reworded', () => {
    const result = validateGrounded(good(), A)
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('rejects an invented Kubernetes and 50% with exactly two violations (T45 spike case)', () => {
    const output = good()
    output.experience[0]!.bullets.push('Mengelola cluster Kubernetes dan memangkas waktu deploy 50%.')
    const result = validateGrounded(output, A)
    expect(result.ok).toBe(false)
    expect(kinds(output)).toEqual(['number:50', 'term:kubernetes'])
  })

  it('rejects a skill outside the Profile and ignores case and spacing for skills inside', () => {
    const output = good()
    output.skills.push('Kotlin', 'jest', '  node.JS ')
    expect(kinds(output)).toEqual(['skill:Kotlin'])
  })

  it('rejects an unknown sourceId and a repeated one', () => {
    const output = good()
    output.experience.push({ sourceId: 'exp-zzz', bullets: ['x'] }, { sourceId: 'exp-a1', bullets: ['y'] })
    expect(kinds(output)).toEqual(['source:exp-a1', 'source:exp-zzz'])
  })

  it('rejects an unknown education id', () => {
    const output = good()
    output.education = ['edu-nope']
    expect(kinds(output)).toEqual(['source:edu-nope'])
  })

  it('checks numbers against the experience the bullet came from, not another one', () => {
    const output: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-a2', bullets: ['Memperbaiki bug dan menaikkan cakupan tes ke 70%.'] }], education: [] }
    expect(kinds(output)).toEqual(['number:70'])
  })

  it('reads Indonesian formatted numbers: decimal comma, thousand dots', () => {
    const p: Profile = {
      ...A,
      experience: [{ ...(A.experience[0] as Profile['experience'][number]), description: 'Menghemat biaya Rp 1,5 juta per bulan dan Rp 1.500.000 per tahun dengan React.' }],
    }
    const same = (bullet: string): TailorOutput => ({ skills: [], experience: [{ sourceId: 'exp-a1', bullets: [bullet] }], education: [] })
    expect(kinds(same('Menghemat Rp 1,5 juta per bulan.'), p)).toEqual([])
    expect(kinds(same('Menghemat Rp 1.5 juta per bulan.'), p)).toEqual([])
    expect(kinds(same('Menghemat Rp 1.500.000 per tahun.'), p)).toEqual([])
    expect(kinds(same('Menghemat Rp 2,5 juta per bulan.'), p)).toEqual(['number:2.5'])
    expect(kinds(same('Menghemat Rp 1.600.000 per tahun.'), p)).toEqual(['number:1600000'])
  })

  it('compares terms by whole word and ignores case, dots and dashes (Node.js = nodejs = NODE.JS)', () => {
    const output = good()
    output.experience[0]!.bullets = ['Menulis REST API dengan NODEJS dan postgresql.', 'Memakai GraphQL untuk pelanggan.']
    expect(kinds(output)).toEqual(['term:graphql'])
  })

  it('does not flag a company or school name the Profile owns, restored into a bullet', () => {
    const output = good()
    output.experience[0]!.bullets = ['Membangun dashboard di PT Contoh Teknologi dengan React.']
    expect(kinds(output)).toEqual([])
  })

  it('does not flag the digits inside a Profile skill name (Microsoft 365)', () => {
    const output: TailorOutput = {
      skills: ['Microsoft 365'],
      experience: [{ sourceId: 'exp-c1', bullets: ['Mengatur akun Microsoft 365 untuk karyawan baru.', 'Menangani 15 tiket per hari.'] }],
      education: [],
    }
    expect(kinds(output, SAMPLE_IT_SUPPORT)).toEqual([])
  })

  it('allows a term that is a Profile skill anywhere, and flags one that is neither skill nor in the source', () => {
    const skill: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-a2', bullets: ['Memperbaiki bug dengan PostgreSQL.'] }], education: [] }
    expect(kinds(skill)).toEqual([])
    const other: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-a2', bullets: ['Memperbaiki bug dengan Docker.'] }], education: [] }
    expect(kinds(other)).toEqual(['term:docker'])
  })

  it('has nothing to reject in an empty output', () => {
    expect(validateGrounded({ skills: [], experience: [], education: [] }, A).ok).toBe(true)
  })

  it('reports each violation once per bullet and says where', () => {
    const output = good()
    output.experience[0]!.bullets = ['Memakai Docker dan Docker lagi.']
    expect(validateGrounded(output, A).violations).toEqual([{ type: 'term', value: 'docker', where: 'exp-a1#1' }])
  })

  it('describes each violation in Indonesian for the screen', () => {
    expect(violationMessage({ type: 'number', value: '50', where: 'exp-a1#3' })).toBe('Angka "50" tidak ada di pengalaman asalnya.')
    expect(violationMessage({ type: 'term', value: 'kubernetes', where: 'exp-a1#3' })).toBe('Istilah "kubernetes" tidak ada di pengalaman asalnya maupun daftar skill.')
    expect(violationMessage({ type: 'skill', value: 'Kotlin', where: 'skills' })).toBe('Skill "Kotlin" tidak ada di Profile.')
    expect(violationMessage({ type: 'source', value: 'exp-zzz', where: 'experience' })).toBe('Pengalaman atau pendidikan "exp-zzz" tidak ada di Profile atau ganda.')
  })
})

describe('checkText (shared with the cover letter)', () => {
  it('checks free text against the given source text and the Profile skills', () => {
    const source = SAMPLE_PROFILES.map((p) => p.experience.map((e) => e.description).join(' ')).join(' ')
    expect(checkText('Saya memakai React dan Jest.', source, A, 'letter')).toEqual([])
    const found = checkText('Saya memimpin 12 orang memakai Kubernetes.', source, A, 'letter')
    expect(found.map((v) => `${v.type}:${v.value}`).sort()).toEqual(['number:12', 'term:kubernetes'])
    expect(found.every((v) => v.where === 'letter')).toBe(true)
  })
})

const empty0 = (): TailorOutput => ({ skills: [], experience: [], education: [] })

describe('assemble', () => {
  it('takes title, company, dates and school from the Profile, never from the AI answer', () => {
    const cv = assemble(A, good())
    expect(cv.experience[0]).toMatchObject({ sourceId: 'exp-a1', title: 'Software Engineer', company: 'PT Contoh Teknologi', start: '2023-08', end: '', current: true })
    expect(cv.education[0]).toMatchObject({ id: 'edu-a1', institution: 'Universitas Contoh Nusantara', level: 'S1', major: 'Teknik Informatika', year: '2022' })
    expect(cv.skills).toEqual(['React', 'TypeScript', 'Node.js'])
  })

  it('writes the header from the Profile on this computer', () => {
    expect(assemble(A, good()).header).toEqual({ name: 'Sari Contohwati', contacts: ['081200000000', 'sari@example.test', 'Denpasar'] })
  })

  // The order of experience is the person's to keep: newest first by date, never the order the AI happened to give.
  const job = (id: string, start: string, end: string, current = false): Profile['experience'][number] => ({
    id, company: `PT ${id}`, title: `Peran ${id}`, start, end, current, description: `Butir ${id}.`,
  })
  const answer = (...ids: string[]): TailorOutput => ({ skills: [], experience: ids.map((sourceId) => ({ sourceId, bullets: [`Butir AI ${sourceId}.`] })), education: [] })

  it('lists experience newest first by date, whatever order the AI gave', () => {
    const profile: Profile = { ...A, experience: [job('lama', '2021-09', '2022-01'), job('baru', '2025-04', '2025-08'), job('tengah', '2024-05', '2025-06')] }
    expect(assemble(profile, answer('lama', 'tengah', 'baru')).experience.map((e) => e.sourceId)).toEqual(['baru', 'tengah', 'lama'])
  })

  it('orders by when each job started, as the person\'s own CV does, not by when it ended', () => {
    // The lab started a month before the telecom internship but ended a year after it: the start decides.
    const profile: Profile = {
      ...A,
      experience: [job('lab', '2024-05', '2025-06'), job('telecom', '2024-06', '2024-09'), job('now', '2025-10', '', true), job('web', '2021-09', '2022-01')],
    }
    expect(assemble(profile, answer('web', 'lab', 'telecom', 'now')).experience.map((e) => e.sourceId)).toEqual(['now', 'telecom', 'lab', 'web'])
  })

  it('puts a job still marked as held above one that has an end date, even one that started later', () => {
    // The remote job is still going; the academy started later but has an end date (December), so it comes second.
    const profile: Profile = {
      ...A,
      experience: [job('akademi', '2026-03', '2026-12'), job('remote', '2025-10', '', true), job('magang', '2025-04', '2025-08')],
    }
    expect(assemble(profile, answer('akademi', 'magang', 'remote')).experience.map((e) => e.sourceId)).toEqual(['remote', 'akademi', 'magang'])
  })

  describe('three bullets for every job', () => {
    const facts = 'Membangun aplikasi kasir dengan Laravel.\nMenulis laporan penjualan mingguan untuk manajer.\nMengelola basis data pelanggan di MySQL.\nMengikuti rapat mingguan dengan klien.'
    const one = (description: string): Profile => ({ ...A, experience: [{ ...job('x', '2024-01', '2024-06'), description }] })

    it('tops up to three from the Profile when the AI wrote fewer, with facts its bullets do not already carry', () => {
      const cv = assemble(one(facts), { skills: [], experience: [{ sourceId: 'x', bullets: ['Membangun aplikasi kasir berbasis Laravel untuk toko.'] }], education: [] })
      const bullets = cv.experience[0]!.bullets
      expect(bullets).toHaveLength(3)
      expect(bullets[0]).toBe('Membangun aplikasi kasir berbasis Laravel untuk toko.')
      expect(bullets).not.toContain('Membangun aplikasi kasir dengan Laravel.')
      expect(bullets.slice(1)).toEqual(['Menulis laporan penjualan mingguan untuk manajer.', 'Mengelola basis data pelanggan di MySQL.'])
    })

    it('leaves the AI\'s three bullets as they are', () => {
      const three = ['Satu.', 'Dua.', 'Tiga.']
      expect(assemble(one(facts), { skills: [], experience: [{ sourceId: 'x', bullets: three }], education: [] }).experience[0]!.bullets).toEqual(three)
    })

    it('never makes up bullets: it does not go past the number of facts the Profile has for that job', () => {
      const answer1 = { skills: [], experience: [{ sourceId: 'x', bullets: ['Satu.'] }], education: [] }
      expect(assemble(one('Membangun aplikasi kasir.\nMenulis laporan penjualan.'), answer1).experience[0]!.bullets).toEqual(['Satu.', 'Membangun aplikasi kasir.'])
      expect(assemble(one('Membangun aplikasi kasir.'), answer1).experience[0]!.bullets).toEqual(['Satu.'])
    })
  })

  it('keeps the wording the AI wrote for each job while the order stays by date', () => {
    const profile: Profile = { ...A, experience: [job('lama', '2021-09', '2022-01'), job('baru', '2025-04', '2025-08')] }
    const cv = assemble(profile, answer('lama', 'baru'))
    expect(cv.experience.map((e) => [e.sourceId, e.bullets])).toEqual([['baru', ['Butir AI baru.']], ['lama', ['Butir AI lama.']]])
  })

  it('keeps the Profile order when a date cannot be read, rather than guess', () => {
    const profile: Profile = { ...A, experience: [job('a', 'Agustus 2023', ''), job('b', '2025-04', '2025-08'), job('c', '2021-09', '2022-01')] }
    expect(assemble(profile, answer('c', 'b', 'a')).experience.map((e) => e.sourceId)).toEqual(['a', 'b', 'c'])
  })

  it('puts a current job the AI left out in its place by date too', () => {
    const output: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-a2', bullets: ['Membantu.'] }], education: [] }
    expect(assemble(A, output).experience.map((e) => e.sourceId)).toEqual(['exp-a1', 'exp-a2'])
  })

  it('never drops an experience: one the AI left out stays in its place by date, with its Profile bullets', () => {
    const ended: Profile = { ...A, experience: A.experience.map((e) => ({ ...e, current: false })) }
    const output: TailorOutput = { skills: ['React'], experience: [{ sourceId: 'exp-a2', bullets: ['Membantu memindahkan halaman statis ke React.'] }], education: [] }
    const cv = assemble(ended, output)
    expect(cv.experience.map((e) => e.sourceId)).toEqual(['exp-a1', 'exp-a2'])
    // The AI's bullet covers the second fact, so the first fact joins it to make the two bullets the Profile has.
    expect(cv.experience[1]?.bullets).toEqual(['Membantu memindahkan halaman statis ke React.', 'Memperbaiki bug tampilan di situs perusahaan.'])
    expect(cv.experience[0]?.bullets).toEqual([
      'Membangun fitur dashboard pelanggan dengan React dan TypeScript.',
      'Menulis REST API dengan Node.js dan PostgreSQL.',
      'Menulis tes unit dengan Jest sehingga cakupan tes naik dari 40% ke 70%.',
    ])
  })

  it('falls back to the Profile as written when the AI returns nothing (T45: small models often return no bullets)', () => {
    const empty = assemble(A, { skills: [], experience: [], education: [] })
    expect(empty.skills).toEqual(A.skills.map((s) => s.name))
    expect(empty.experience.map((e) => e.sourceId)).toEqual(['exp-a1', 'exp-a2'])
    expect(empty.experience[0]?.bullets).toEqual([
      'Membangun fitur dashboard pelanggan dengan React dan TypeScript.',
      'Menulis REST API dengan Node.js dan PostgreSQL.',
      'Menulis tes unit dengan Jest sehingga cakupan tes naik dari 40% ke 70%.',
      'Ikut code review dua kali seminggu.',
    ])
    expect(empty.education.map((e) => e.id)).toEqual(['edu-a1'])
  })

  it('falls back only for an experience whose bullets came back empty', () => {
    const output: TailorOutput = { skills: ['React'], experience: [{ sourceId: 'exp-a2', bullets: [] }], education: ['edu-a1'] }
    expect(assemble(A, output).experience.find((e) => e.sourceId === 'exp-a2')?.bullets).toEqual(['Memperbaiki bug tampilan di situs perusahaan.', 'Membantu memindahkan halaman statis ke React.'])
  })

  it('lists the Profile fields named Certification or Sertifikasi as certifications, and nothing else from custom', () => {
    const profile: Profile = {
      ...A,
      custom: [
        { id: 'c1', key: 'Certification', value: 'Dicoding, Belajar Dasar AI' },
        { id: 'c2', key: ' sertifikasi ', value: 'Google Cloud, Prompt Design' },
        { id: 'c3', key: 'Portfolio', value: 'https://contoh.test' },
        { id: 'c4', key: 'Certification', value: '   ' },
      ],
    }
    expect(assemble(profile, empty0()).certifications).toEqual(['Dicoding, Belajar Dasar AI', 'Google Cloud, Prompt Design'])
    expect(assemble({ ...A, custom: [] }, empty0()).certifications).toEqual([])
  })

  it('leads with education by default and with experience when asked', () => {
    expect(assemble(A, empty0()).order).toBe('education-first')
    expect(assemble(A, empty0(), 'experience-first').order).toBe('experience-first')
  })

  it('returns an empty experience list for a Profile without experience', () => {
    const none: Profile = { ...A, experience: [] }
    expect(assemble(none, { skills: [], experience: [], education: [] }).experience).toEqual([])
  })
})

describe('bulletsFromDescription', () => {
  it('splits sentences, bullets and lines and drops empties', () => {
    expect(bulletsFromDescription('Satu hal. Dua hal!\n- Tiga hal\n• Empat hal  \n\n')).toEqual(['Satu hal.', 'Dua hal!', 'Tiga hal', 'Empat hal'])
  })

  it('does not split a decimal or a dotted name', () => {
    expect(bulletsFromDescription('Memakai Node.js versi 1.5 untuk API.')).toEqual(['Memakai Node.js versi 1.5 untuk API.'])
  })
})

// The real answers from the T45 spike. The spike's rough checker found nothing invented in any of them;
// the production checker must agree, so a change to it cannot start rejecting answers the spike accepted.
const RESULTS = resolve(process.cwd(), 'spikes/t45/results/combined.json')
const BY_PROFILE: Record<string, Profile> = { A: SAMPLE_WEB_DEV, B: SAMPLE_DATA_ANALYST, C: SAMPLE_IT_SUPPORT }
const profileOf = (id: string): Profile => BY_PROFILE[id] ?? SAMPLE_WEB_DEV

describe.skipIf(!existsSync(RESULTS))('T45 spike answers', () => {
  const data = JSON.parse(existsSync(RESULTS) ? readFileSync(RESULTS, 'utf8') : '{"results":[]}') as {
    results: { model: string; mode: string; profile: string; job: string; output: TailorOutput | null }[]
  }
  const answers = data.results.filter((r) => r.output)

  it('has the answers the spike recorded', () => {
    expect(answers.length).toBeGreaterThanOrEqual(31)
  })

  it('accepts every real answer', () => {
    const rejected = answers
      .map((r) => ({ id: `${r.model}/${r.mode}/${r.profile}/${r.job}`, violations: validateGrounded(r.output as TailorOutput, profileOf(r.profile)).violations }))
      .filter((r) => r.violations.length > 0)
    expect(rejected).toEqual([])
  })

  it('rejects every real answer once the two fakes from the FR-40 example are added', () => {
    for (const r of answers) {
      const fake = structuredClone(r.output as TailorOutput)
      const profile = profileOf(r.profile)
      fake.experience = [{ sourceId: profile.experience[0]?.id ?? '', bullets: ['Mengelola cluster Kubernetes dan memangkas waktu deploy 50%.'] }]
      const found = validateGrounded(fake, profile).violations
      expect(found.some((v) => v.value === 'kubernetes')).toBe(true)
      expect(found.some((v) => v.value === '50')).toBe(true)
    }
  })
})
