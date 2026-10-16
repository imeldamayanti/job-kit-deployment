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

describe('assemble', () => {
  it('takes title, company, dates and school from the Profile, never from the AI answer', () => {
    const cv = assemble(A, good())
    expect(cv.experience[0]).toMatchObject({ sourceId: 'exp-a1', title: 'Software Engineer', company: 'PT Contoh Teknologi', start: '2023-08', end: '', current: true })
    expect(cv.education[0]).toMatchObject({ id: 'edu-a1', institution: 'Universitas Contoh Nusantara', level: 'S1', major: 'Teknik Informatika', year: '2022' })
    expect(cv.skills).toEqual(['React', 'TypeScript', 'Node.js'])
  })

  it('writes the header from the Profile on this computer', () => {
    expect(assemble(A, good()).header).toEqual({ name: 'Sari Contohwati', contacts: ['sari@example.test', '081200000000', 'Denpasar'] })
  })

  it('keeps the AI order of experience and drops entries the AI left out', () => {
    const output: TailorOutput = {
      skills: ['React'],
      experience: [
        { sourceId: 'exp-a2', bullets: ['Membantu memindahkan halaman statis ke React.'] },
        { sourceId: 'exp-a1', bullets: ['Menulis REST API dengan Node.js.'] },
      ],
      education: [],
    }
    expect(assemble(A, output).experience.map((e) => e.sourceId)).toEqual(['exp-a2', 'exp-a1'])
    expect(assemble(A, { ...output, experience: output.experience.slice(1) }).experience.map((e) => e.sourceId)).toEqual(['exp-a1'])
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
    expect(assemble(A, output).experience[0]?.bullets).toEqual(['Memperbaiki bug tampilan di situs perusahaan.', 'Membantu memindahkan halaman statis ke React.'])
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
