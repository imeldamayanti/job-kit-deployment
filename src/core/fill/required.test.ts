import { describe, expect, it } from 'vitest'
import { isRequiredLabel } from './required'

describe('isRequiredLabel', () => {
  it.each(['First Name *', 'Email ✱', 'Nama lengkap*', 'Phone (Required)', 'Alamat - wajib diisi', 'REQUIRED: Kota'])(
    'treats "%s" as required',
    (label) => expect(isRequiredLabel(label)).toBe(true),
  )

  it.each(['First Name', 'Email', 'Alamat', 'Prerequisites', 'Phone (optional)', 'Website (opsional)', 'LinkedIn (not required)', 'Catatan, tidak wajib'])(
    'treats "%s" as not required',
    (label) => expect(isRequiredLabel(label)).toBe(false),
  )

  it('lets an asterisk win over a nearby "optional" word', () => {
    expect(isRequiredLabel('Email * (optional fallback)')).toBe(true)
  })
})
