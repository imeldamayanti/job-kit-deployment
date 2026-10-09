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
      { fieldId: 'f0', label: 'Full Name', key: 'fullName', value: 'Imelda Wijaya' },
      { fieldId: 'f1', label: 'Email', key: 'email', value: 'nama@example.test' },
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
})
