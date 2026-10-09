import { describe, expect, it } from 'vitest'
import { matchField } from './match'

describe('matchField by label', () => {
  it.each([
    ['Nama Lengkap', 'fullName'],
    ['Full Name', 'fullName'],
    ['Your full name *', 'fullName'],
    ['Nama Depan', 'firstName'],
    ['First Name', 'firstName'],
    ['Given name', 'firstName'],
    ['Nama Belakang', 'lastName'],
    ['Last Name', 'lastName'],
    ['Surname', 'lastName'],
    ['Email', 'email'],
    ['Alamat Email', 'email'],
    ['Email address', 'email'],
    ['Telepon', 'phone'],
    ['No. HP', 'phone'],
    ['Phone number', 'phone'],
    ['LinkedIn URL', 'linkedin'],
    ['Website / Portfolio', 'website'],
    ['Alamat', 'street'],
    ['Street address', 'street'],
    ['Kota', 'city'],
    ['City', 'city'],
    ['Provinsi', 'province'],
    ['Kode Pos', 'postalCode'],
    ['Postal code', 'postalCode'],
    ['Negara', 'country'],
    ['Country', 'country'],
    ['Tanggal Lahir', 'birthDate'],
    ['Date of birth', 'birthDate'],
    ['Jenis Kelamin', 'gender'],
    ['Gender', 'gender'],
    ['Kewarganegaraan', 'nationality'],
    ['Nationality', 'nationality'],
    ['Jenjang Pendidikan', 'educationLevel'],
    ['Pendidikan terakhir', 'educationLevel'],
    ['Highest level of education', 'educationLevel'],
    ['Education level', 'educationLevel'],
    ['Degree', 'educationLevel'],
  ])('%s -> %s', (label, expected) => {
    expect(matchField({ label })).toBe(expected)
  })

  it('returns null for a label it does not know', () => {
    expect(matchField({ label: 'Mengapa Anda melamar?' })).toBeNull()
    expect(matchField({ label: 'Cover note' })).toBeNull()
  })

  it('does not match a word that only contains a known word', () => {
    expect(matchField({ label: 'Kewarganegaraan' })).toBe('nationality')
    expect(matchField({ label: 'Tempat lahir' })).toBeNull()
  })
})

describe('matchField by autocomplete', () => {
  it('uses the autocomplete token when present', () => {
    expect(matchField({ label: 'Field 7', autocomplete: 'given-name' })).toBe('firstName')
    expect(matchField({ label: 'x', autocomplete: 'email' })).toBe('email')
    expect(matchField({ label: 'x', autocomplete: 'postal-code' })).toBe('postalCode')
  })

  it('lets autocomplete win over a conflicting label', () => {
    expect(matchField({ label: 'Kota', autocomplete: 'email' })).toBe('email')
  })

  it('ignores autocomplete values it does not know and uses the label', () => {
    expect(matchField({ label: 'Email', autocomplete: 'off' })).toBe('email')
  })
})
