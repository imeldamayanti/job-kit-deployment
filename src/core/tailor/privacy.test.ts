import { describe, expect, it } from 'vitest'
import type { Application } from '../applications/types'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import { acknowledgeNotice, needsNotice, pseudonymize, trainingNotice } from './privacy'
import { SAMPLE_WEB_DEV } from './sample-profiles'
import type { TailorOutput } from './types'

type Exp = Profile['experience'][number]
const exp = (change: Partial<Exp>): Exp => ({ id: 'a', company: 'X', title: 'x', start: '', end: '', current: false, description: '', ...change })

// Values that must never reach the provider (PRD §4.2, FR-46). Each is distinctive so a leak is easy to find.
function identified(): Profile {
  const p = createEmptyProfile()
  p.personal = { firstName: 'Sarirahasia', middleName: 'Ayu', lastName: 'Contohwati', birthDate: '12 Mei 2003', gender: 'Perempuan', nationality: 'Indonesia' }
  p.contact = {
    email: 'sari.rahasia@example.test', phone: '081299990000', linkedin: 'https://linkedin.com/in/sari-rahasia', website: 'https://sari-rahasia.example.test',
    street: 'Jl. Rahasia No. 7', city: 'Denpasar', province: 'Bali', postalCode: '80361', country: 'Indonesia',
  }
  p.education = [{ id: 'edu-1', institution: 'Universitas Rahasia Nusantara', level: 'S1', major: 'Informatika', gpa: '3.91', year: '2024' }]
  p.experience = [
    exp({
      id: 'exp-1', company: 'PT Rahasia Karya', title: 'Frontend Developer', start: '2023-01', current: true,
      description: 'Membangun dashboard untuk klien PT Rahasia Karya dengan React. Kuliah di Universitas Rahasia Nusantara membantu. Hubungi sari.rahasia@example.test atau 081299990000.',
    }),
    exp({ id: 'exp-2', company: 'Rahasia Digital Ltd', title: 'Magang', start: '2022-01', end: '2022-06', description: 'Rahasia Digital menyewa tim kecil. Memakai Git.' }),
  ]
  p.skills = [{ group: 'teknis', name: 'React' }, { group: 'teknis', name: 'Git' }]
  p.custom = [{ id: 'c', key: 'Gaji', value: '99 juta' }]
  return p
}

const LEAKS = [
  'Sarirahasia', 'Contohwati', 'Ayu', '12 Mei 2003', 'sari.rahasia@example.test', '081299990000', 'linkedin.com/in/sari-rahasia', 'sari-rahasia.example.test',
  'Jl. Rahasia', 'Denpasar', 'Bali', '80361', '3.91', '99 juta', 'Gaji',
]

describe('pseudonymize', () => {
  it('leaves no identity value in the payload', () => {
    const { payload } = pseudonymize(identified())
    const sent = JSON.stringify(payload)
    for (const value of LEAKS) expect(sent, value).not.toContain(value)
  })

  it('leaves no employer or school name in the payload, not even inside a bullet', () => {
    const { payload } = pseudonymize(identified())
    const sent = JSON.stringify(payload)
    for (const name of ['PT Rahasia Karya', 'Rahasia Karya', 'Rahasia Digital', 'Universitas Rahasia Nusantara']) expect(sent, name).not.toContain(name)
  })

  it('sends only what FR-46 allows: skills, bullets, titles, level, major', () => {
    const { payload } = pseudonymize(identified())
    expect(payload.skills).toEqual(['React', 'Git'])
    expect(payload.experience.map((e) => e.title)).toEqual(['Frontend Developer', 'Magang'])
    expect(payload.education).toEqual([{ id: 'edu-1', institution: '{S1}', level: 'S1', major: 'Informatika' }])
    expect(Object.keys(payload).sort()).toEqual(['education', 'experience', 'skills'])
    expect(Object.keys(payload.experience[0] ?? {}).sort()).toEqual(['company', 'description', 'id', 'title'])
  })

  it('gives each employer and school its own code, in order', () => {
    const { payload } = pseudonymize(identified())
    expect(payload.experience.map((e) => e.company)).toEqual(['{C1}', '{C2}'])
    expect(payload.education.map((e) => e.institution)).toEqual(['{S1}'])
  })

  it('gives one code to the same employer listed twice', () => {
    const p = identified()
    p.experience = [...p.experience, { ...(p.experience[0] as Exp), id: 'exp-3' }]
    expect(pseudonymize(p).payload.experience.map((e) => e.company)).toEqual(['{C1}', '{C2}', '{C1}'])
  })

  it('swaps a name inside a bullet whatever its case and without a legal prefix (PT, CV, Ltd)', () => {
    const p = identified()
    p.experience = [exp({ company: 'PT Rahasia Karya', description: 'Membangun dashboard untuk PT RAHASIA KARYA. Tim rahasia karya senang. Kerja di Rahasia Karya.' })]
    expect(pseudonymize(p).payload.experience[0]?.description).toBe('Membangun dashboard untuk {C1}. Tim {C1} senang. Kerja di {C1}.')
  })

  it('takes the longer name first when two employers share a word', () => {
    const p = identified()
    p.experience = [
      exp({ id: 'a', company: 'Contoh', description: 'Kerja di Contoh.' }),
      exp({ id: 'b', company: 'Contoh Teknologi', description: 'Kerja di Contoh Teknologi.' }),
    ]
    expect(pseudonymize(p).payload.experience.map((e) => e.description)).toEqual(['Kerja di {C1}.', 'Kerja di {C2}.'])
  })

  it('swaps a name with regex characters safely', () => {
    const p = identified()
    p.experience = [exp({ company: 'Toko A+B (Persero) [Bali]', description: 'Kerja di Toko A+B (Persero) [Bali] lama.' })]
    expect(pseudonymize(p).payload.experience[0]?.description).toBe('Kerja di {C1} lama.')
  })

  it('does not swap part of a longer word', () => {
    const p = identified()
    p.experience = [exp({ company: 'Aksa', description: 'Memakai Aksara dan Aksa.' })]
    expect(pseudonymize(p).payload.experience[0]?.description).toBe('Memakai Aksara dan {C1}.')
  })

  it('removes the full name and long name parts from a bullet, but keeps a short first name that is also a word', () => {
    const p = identified()
    p.personal.firstName = 'Made'
    p.personal.middleName = ''
    p.personal.lastName = 'Sampleton'
    p.experience = [exp({ description: 'Made dashboards in Tableau. Made Sampleton wrote this.' })]
    const description = pseudonymize(p).payload.experience[0]?.description ?? ''
    expect(description).not.toContain('Sampleton')
    expect(description).toContain('Made dashboards in Tableau.')
  })

  it('writes an empty string for a missing employer instead of a code', () => {
    const p = identified()
    p.experience = [exp({ company: '', title: 'Freelance', description: 'Bantu teman.' })]
    expect(pseudonymize(p).payload.experience[0]?.company).toBe('')
  })

  it('leaves a Profile without experience or education with empty lists', () => {
    expect(pseudonymize(createEmptyProfile()).payload).toEqual({ skills: [], experience: [], education: [] })
  })
})

describe('restore', () => {
  it('puts the real names back, even where they sat inside a bullet', () => {
    const { payload, restore } = pseudonymize(identified())
    expect(restore(payload.experience[0]?.description ?? '')).toContain('Membangun dashboard untuk klien PT Rahasia Karya dengan React.')
    expect(restore('Bekerja di {C1} dan {C2}, lulus dari {S1}.')).toBe('Bekerja di PT Rahasia Karya dan Rahasia Digital Ltd, lulus dari Universitas Rahasia Nusantara.')
  })

  it('reads a code the model wrote with other case or spaces', () => {
    const { restore } = pseudonymize(identified())
    expect(restore('di {c1} dan { C2 } dan {s1}')).toBe('di PT Rahasia Karya dan Rahasia Digital Ltd dan Universitas Rahasia Nusantara')
  })

  it('leaves a code it never issued, so the fact checker rejects it', () => {
    expect(pseudonymize(identified()).restore('di {C9}')).toBe('di {C9}')
  })

  it('restores every bullet of an answer and nothing else', () => {
    const { restoreOutput } = pseudonymize(identified())
    const answer: TailorOutput = { skills: ['React'], experience: [{ sourceId: 'exp-1', bullets: ['Membangun dashboard klien {C1} dengan React.'] }], education: ['edu-1'] }
    expect(restoreOutput(answer)).toEqual({
      skills: ['React'],
      experience: [{ sourceId: 'exp-1', bullets: ['Membangun dashboard klien PT Rahasia Karya dengan React.'] }],
      education: ['edu-1'],
    })
  })

  it('does not change the answer it was given', () => {
    const { restoreOutput } = pseudonymize(identified())
    const answer: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-1', bullets: ['{C1}'] }], education: [] }
    restoreOutput(answer)
    expect(answer.experience[0]?.bullets).toEqual(['{C1}'])
  })

  it('works on the synthetic spike profile', () => {
    const { payload, restore } = pseudonymize(SAMPLE_WEB_DEV)
    expect(JSON.stringify(payload)).not.toContain('Contoh Teknologi')
    expect(restore('{C1} dan {C2} dan {S1}')).toBe('PT Contoh Teknologi dan CV Contoh Digital dan Universitas Contoh Nusantara')
  })
})

describe('trainingNotice (FR-46)', () => {
  it('has no notice for a provider that does not train on API data', () => {
    expect(trainingNotice({ provider: 'anthropic', model: 'claude-haiku-5-5' })).toBeNull()
  })

  it('marks a Zen model that may be trained on, and not the three promised private', () => {
    expect(trainingNotice({ provider: 'opencode-zen', model: 'exo-free' })?.kind).toBe('zen')
    expect(trainingNotice({ provider: 'opencode-zen', model: 'space-bunny-free' })).toBeNull()
  })

  it('marks Gemini, whose free tier is used to improve Google products (T45)', () => {
    const notice = trainingNotice({ provider: 'gemini', model: 'gemini-3.6-flash' })
    expect(notice?.kind).toBe('gemini')
    expect(notice?.message).toContain('tier gratis')
  })

  it('says in Indonesian that the data may train the model and offers to change the model', () => {
    const notice = trainingNotice({ provider: 'opencode-zen', model: 'exo-free' })
    expect(notice?.message).toMatch(/melatih/)
    expect(notice?.message).toMatch(/ganti model/i)
  })
})

describe('once per application', () => {
  const app = (): Application => ({
    id: 'app-1', jobId: 'j', job: { title: 'Dev', company: 'Acme', url: 'https://x.test/1', source: 'ashby', description: 'x', capturedAt: '2026-10-15T08:00:00Z' },
    status: 'draft', cvId: null, letterId: null, followUpAt: null, notes: '', events: [], createdAt: '2026-10-15T08:00:00Z', updatedAt: '2026-10-15T08:00:00Z',
  })
  const zen = { provider: 'opencode-zen', model: 'exo-free' } as const

  it('asks before the first document and not again after the person goes on', () => {
    const a = app()
    expect(needsNotice(a, zen)).toBe(true)
    expect(needsNotice(acknowledgeNotice(a, zen), zen)).toBe(false)
  })

  it('asks again when the model changes to another one that may be trained on', () => {
    const acknowledged = acknowledgeNotice(app(), zen)
    expect(needsNotice(acknowledged, { provider: 'gemini', model: 'gemini-3.6-flash' })).toBe(true)
  })

  it('never asks when there is nothing to warn about, and changes nothing', () => {
    const safe = { provider: 'anthropic', model: 'claude-haiku-5-5' } as const
    expect(needsNotice(app(), safe)).toBe(false)
    expect(acknowledgeNotice(app(), safe)).toEqual(app())
  })
})
