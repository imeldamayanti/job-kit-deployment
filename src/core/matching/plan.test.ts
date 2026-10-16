import { describe, expect, it } from 'vitest'
import { createEmptyProfile, setPersonalField } from '../profile/profile'
import { buildPlan } from './plan'

const profile = setPersonalField(setPersonalField(createEmptyProfile(), 'firstName', 'Imelda'), 'lastName', 'Wijaya')
const withContact = { ...profile, contact: { ...profile.contact, email: 'nama@example.test' } }

describe('buildPlan', () => {
  it('pairs each matched field with its profile value', () => {
    const plan = buildPlan(
      [
        { id: 'f0', label: 'Full Name' },
        { id: 'f1', label: 'Email' },
      ],
      withContact,
    )

    expect(plan.items).toEqual([
      { fieldId: 'f0', label: 'Full Name', key: 'fullName', value: 'Imelda Wijaya', hasExistingText: false },
      { fieldId: 'f1', label: 'Email', key: 'email', value: 'nama@example.test', hasExistingText: false },
    ])
  })

  it('counts 7 of 10 when 7 of 10 fields match', () => {
    const fields = [
      'Full Name', 'Email', 'Telepon', 'Kota', 'Negara', 'Gender', 'Kode Pos',
      'Why us?', 'Cover note', 'Referral',
    ].map((label, i) => ({ id: `f${i}`, label }))

    const plan = buildPlan(fields, withContact)

    expect(plan.total).toBe(10)
    expect(plan.matched).toBe(7)
  })

  it('lists unmatched fields as skipped', () => {
    const plan = buildPlan([{ id: 'f0', label: 'Cover note' }], withContact)

    expect(plan.skipped).toEqual([{ fieldId: 'f0', label: 'Cover note' }])
    expect(plan.items).toEqual([])
  })

  it('keeps a matched field whose profile value is empty out of the fill list', () => {
    const plan = buildPlan([{ id: 'f0', label: 'Telepon' }], withContact)

    expect(plan.items).toEqual([])
    expect(plan.missing).toEqual([{ fieldId: 'f0', label: 'Telepon', key: 'phone' }])
    expect(plan.matched).toBe(1)
  })

  it('remembers that a field already holds the user\'s text', () => {
    const plan = buildPlan([{ id: 'f0', label: 'Email', hasText: true }], withContact)

    expect(plan.items[0]?.hasExistingText).toBe(true)
  })

  it('fills a field from a custom key-value pair the user added', () => {
    const custom = { ...withContact, custom: [{ id: 'c1', key: 'Ekspektasi gaji', value: '10 juta' }] }

    const plan = buildPlan([{ id: 'f0', label: 'Ekspektasi gaji (per bulan)' }], custom)

    expect(plan.items).toEqual([
      { fieldId: 'f0', label: 'Ekspektasi gaji (per bulan)', key: 'custom:c1', value: '10 juta', hasExistingText: false },
    ])
    expect(plan.matched).toBe(1)
  })

  it('lets an exact custom key win over a built-in guess', () => {
    const custom = { ...withContact, custom: [{ id: 'c1', key: 'Email kantor', value: 'kantor@example.test' }] }

    const plan = buildPlan([{ id: 'f0', label: 'Email kantor' }], custom)

    expect(plan.items[0]?.value).toBe('kantor@example.test')
  })

  it('ignores a custom pair whose key is blank', () => {
    const custom = { ...withContact, custom: [{ id: 'c1', key: '', value: 'x' }] }

    expect(buildPlan([{ id: 'f0', label: 'Cover note' }], custom).matched).toBe(0)
  })

  it('picks the option of a dropdown that fits the profile value', () => {
    const profile = setPersonalField(withContact, 'gender', 'Laki-laki')
    const options = [
      { label: 'Female', value: 'f' },
      { label: 'Male', value: 'm' },
    ]

    const plan = buildPlan([{ id: 'f0', label: 'Gender', kind: 'select', options }], profile)

    expect(plan.items).toEqual([
      { fieldId: 'f0', label: 'Gender', key: 'gender', value: 'Male', choice: 1, hasExistingText: false },
    ])
  })

  it('skips a choice field whose options do not fit the profile value', () => {
    const profile = setPersonalField(withContact, 'gender', 'Laki-laki')
    const options = [{ label: 'Yes', value: 'y' }, { label: 'No', value: 'n' }]

    const plan = buildPlan([{ id: 'f0', label: 'Gender', kind: 'radio', options }], profile)

    expect(plan.items).toEqual([])
    expect(plan.skipped).toEqual([{ fieldId: 'f0', label: 'Gender' }])
  })

  it('reads the education level from the first education entry', () => {
    const profile = { ...withContact, education: [{ id: 'e1', institution: 'ITB', level: 'S1', major: '', gpa: '', year: '' }] }
    const options = [{ label: "Bachelor's Degree", value: 'b' }]

    const plan = buildPlan([{ id: 'f0', label: 'Highest level of education', kind: 'select', options }], profile)

    expect(plan.items[0]?.value).toBe("Bachelor's Degree")
  })
})

describe('buildPlan: cover letter (T52)', () => {
  const LETTER = 'Yth. Tim Rekrutmen,\n\nSaya melamar posisi ini.\n\nHormat saya,\nImelda Wijaya'
  const area = (label: string, change = {}) => ({ id: 'f0', label, multiline: true, ...change })

  it('fills a cover letter textarea from the letter of the linked application', () => {
    const plan = buildPlan([area('Cover Letter')], withContact, { coverLetter: LETTER })
    expect(plan.items).toEqual([{ fieldId: 'f0', label: 'Cover Letter', key: 'coverLetter', value: LETTER, hasExistingText: false }])
    expect(plan.matched).toBe(1)
  })

  it('reads "Surat lamaran" and "Letter of motivation" the same way', () => {
    for (const label of ['Surat lamaran', 'Letter of motivation']) {
      expect(buildPlan([area(label)], withContact, { coverLetter: LETTER }).items.map((i) => i.key)).toEqual(['coverLetter'])
    }
  })

  it('skips the field when there is no letter: the Profile cannot answer it, so it is not "Profil belum punya"', () => {
    for (const documents of [undefined, {}, { coverLetter: '' }, { coverLetter: '  ' }]) {
      const plan = buildPlan([area('Cover Letter')], withContact, documents)
      expect(plan.items).toEqual([])
      expect(plan.missing).toEqual([])
      expect(plan.skipped).toEqual([{ fieldId: 'f0', label: 'Cover Letter' }])
      expect(plan.matched).toBe(0)
    }
  })

  it('skips a single-line input with that label: a letter does not fit there', () => {
    const plan = buildPlan([{ id: 'f0', label: 'Surat lamaran', multiline: false }, { id: 'f1', label: 'Cover letter' }], withContact, { coverLetter: LETTER })
    expect(plan.items).toEqual([])
    expect(plan.skipped.map((s) => s.fieldId)).toEqual(['f0', 'f1'])
  })

  it('leaves an essay textarea alone even when a letter exists', () => {
    const plan = buildPlan([area('Why do you want to work here?')], withContact, { coverLetter: LETTER })
    expect(plan.items).toEqual([])
    expect(plan.skipped).toHaveLength(1)
  })

  it('marks a textarea that already has text, so the panel asks before overwriting', () => {
    const plan = buildPlan([area('Cover Letter', { hasText: true })], withContact, { coverLetter: LETTER })
    expect(plan.items[0]?.hasExistingText).toBe(true)
  })

  it('does not change how other fields are filled', () => {
    const plan = buildPlan([{ id: 'f0', label: 'Email' }, area('Cover Letter')].map((f, i) => ({ ...f, id: `f${i}` })), withContact, { coverLetter: LETTER })
    expect(plan.items.map((i) => i.key)).toEqual(['email', 'coverLetter'])
  })
  it('carries "required" onto skipped and missing fields so the panel can say Wajib', () => {
    const plan = buildPlan(
      [
        { id: 'f0', label: 'Referral *', required: true },
        { id: 'f1', label: 'Catatan' },
        { id: 'f2', label: 'Kota', required: true },
        { id: 'f3', label: 'Email' },
      ],
      withContact,
    )

    expect(plan.skipped).toEqual([
      { fieldId: 'f0', label: 'Referral *', required: true },
      { fieldId: 'f1', label: 'Catatan' },
    ])
    expect(plan.missing).toEqual([{ fieldId: 'f2', label: 'Kota', key: 'city', required: true }])
  })
})
