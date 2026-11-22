import { describe, expect, it } from 'vitest'
import { validateLetter } from '../letters/grounded'
import { SAMPLE_PROFILES } from '../tailor/sample-profiles'
import { validateGrounded } from '../tailor/grounded'
import { pseudonymize } from '../tailor/privacy'
import type { Profile } from '../profile/types'
import type { TailorOutput } from '../tailor/types'
import { profileFromPayload } from './pseudo-profile'

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((s) => s !== '')

// Outputs a model might return for this profile: faithful, and wrong in each way the fact checker looks for.
function outputsFor(profile: Profile, codeOf: (companyIndex: number) => string): TailorOutput[] {
  const [first] = profile.experience
  const skill = profile.skills[0]?.name ?? 'Excel'
  const own = (first ? sentences(first.description) : []).slice(0, 2)
  const sourceId = first?.id ?? 'exp-x'
  const code = codeOf(0)
  const output = (skills: string[], bullets: string[], id = sourceId): TailorOutput => ({ skills, experience: [{ sourceId: id, bullets }], education: profile.education.map((e) => e.id) })
  return [
    output([skill], own),
    output(profile.skills.map((s) => s.name), [`${own[0] ?? 'Bekerja'} untuk ${code}.`]),
    output([skill], [`Bekerja untuk ${code} selama beberapa waktu.`]),
    output([skill, 'Kubernetes'], own),
    output([skill], [...own, 'Menurunkan biaya server sebesar 50% dengan Docker.']),
    output([skill], [`Memakai Kubernetes untuk ${code}.`]),
    output([skill], ['Bekerja untuk {C9} dan {S7}.']),
    output([skill], own, 'exp-tidak-ada'),
    // The digit of a code must not make a number in a bullet look like it came from the experience.
    ...profile.experience.map((e) => output([skill], [...sentences(e.description).slice(0, 1), 'Menangani 2 toko dan 1 gudang.'], e.id)),
    { ...output([skill], own), education: ['edu-tidak-ada'] },
    { skills: [], experience: [], education: [] },
  ]
}

describe('profileFromPayload', () => {
  const profile = SAMPLE_PROFILES[0] as Profile
  const hidden = pseudonymize(profile)
  const pseudo = profileFromPayload(hidden.payload)

  it('holds only what the payload holds', () => {
    expect(pseudo.skills.map((s) => s.name)).toEqual(profile.skills.map((s) => s.name))
    expect(pseudo.experience).toEqual(hidden.payload.experience.map((e) => expect.objectContaining({ id: e.id, title: e.title, company: e.company })))
    expect(pseudo.education).toEqual(hidden.payload.education.map((e) => expect.objectContaining({ id: e.id, institution: e.institution, level: e.level, major: e.major })))
    expect(pseudo.personal.firstName).toBe('')
    expect(pseudo.contact.email).toBe('')
    expect(JSON.stringify(pseudo)).not.toMatch(/Sari|Contohwati|example\.test|0812/)
  })

  it('keeps the wording of each description, and the number inside a code is not part of it', () => {
    const withCodes = profileFromPayload({ skills: [], experience: [{ id: 'x', title: 'Analyst', company: '{C2}', description: 'Melapor ke {C2} dan {S1}.' }], education: [] })
    expect(withCodes.experience[0]?.description).toBe('Melapor ke {C} dan {S}.')
    expect(pseudo.experience[0]?.description).toBe(hidden.payload.experience[0]?.description)
  })

  it('accepts output that uses only the skills and bullets of the payload', () => {
    const output: TailorOutput = {
      skills: ['React', 'TypeScript'],
      experience: [{ sourceId: 'exp-a1', bullets: ['Membangun fitur dashboard pelanggan dengan React dan TypeScript untuk {C1}.'] }],
      education: ['edu-a1'],
    }
    expect(validateGrounded(output, pseudo).ok).toBe(true)
  })

  it('rejects a skill that is not in the payload', () => {
    const output: TailorOutput = { skills: ['React', 'Kubernetes'], experience: [], education: [] }
    const result = validateGrounded(output, pseudo)
    expect(result.ok).toBe(false)
    expect(result.violations).toEqual([{ type: 'skill', value: 'Kubernetes', where: 'skills' }])
  })

  it('does not count a company code in a bullet as a term, and rejects a code it never issued', () => {
    const known: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-a1', bullets: ['Bekerja untuk {C1} dan belajar di {S1}.'] }], education: [] }
    const unknown: TailorOutput = { skills: [], experience: [{ sourceId: 'exp-a1', bullets: ['Bekerja untuk {C9}.'] }], education: [] }
    expect(validateGrounded(known, pseudo).ok).toBe(true)
    expect(validateGrounded(unknown, pseudo).ok).toBe(false)
  })
})

// Review Focus 4: the server checks the hidden payload, the extension checks the real Profile. They must agree.
describe.each(SAMPLE_PROFILES.map((profile) => [profile.personal.firstName, profile] as const))('server and extension agree for %s', (_name, profile) => {
  const hidden = pseudonymize(profile)
  const pseudo = profileFromPayload(hidden.payload)
  const codeOf = (index: number) => hidden.payload.experience[index]?.company || '{C1}'

  it('gives the same verdict on a CV output, before and after restore', () => {
    const outputs = outputsFor(profile, codeOf)
    let passed = 0
    for (const output of outputs) {
      const remote = validateGrounded(output, pseudo)
      const local = validateGrounded(hidden.restoreOutput(output), profile)
      expect(remote.ok, JSON.stringify(output)).toBe(local.ok)
      expect(remote.violations.map((v) => v.type)).toEqual(local.violations.map((v) => v.type))
      if (remote.ok) passed += 1
    }
    expect(passed).toBeGreaterThan(0)
    expect(passed).toBeLessThan(outputs.length)
  })

  it('gives the same verdict on a letter body, before and after restore', () => {
    const [experience] = profile.experience
    const own = experience ? sentences(experience.description)[0] : ''
    const code = codeOf(0)
    const job = { title: 'Frontend Engineer', company: 'Acme' }
    const bodies = [
      `Dear Hiring Team at Acme,\n\nAt ${code} I work as follows. ${own}\n\nThank you.`,
      `I am applying for the Frontend Engineer role at Acme. ${own}`,
      `I worked at ${code}. I know Kubernetes well.`,
      `I worked at ${code} and cut costs by 87%.`,
      'I worked at {C9} and know Docker.',
      'Plain letter with no facts at all.',
    ]
    let passed = 0
    for (const body of bodies) {
      const remote = validateLetter(body, pseudo, job)
      const local = validateLetter(hidden.restore(body), profile, job)
      expect(remote.ok, body).toBe(local.ok)
      if (remote.ok) passed += 1
    }
    expect(passed).toBeGreaterThan(0)
    expect(passed).toBeLessThan(bodies.length)
  })
})
