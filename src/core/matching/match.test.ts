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
    ['Legal Name', 'fullName'],
    ['Full legal name', 'fullName'],
    ['Current location', 'city'],
    ['What is your location?', 'city'],
    ['Location', 'city'],
    ['Lokasi saat ini', 'city'],
    ['Domisili', 'city'],
    ['Domicile*Required', 'city'],
    ['Place of residence', 'city'],
    ['City of residence', 'city'],
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

describe('matchField for the cover letter (T52)', () => {
  it('knows the three labels of a cover letter, in English and Indonesian', () => {
    expect(matchField({ label: 'Cover letter' })).toBe('coverLetter')
    expect(matchField({ label: 'Cover Letter (optional)' })).toBe('coverLetter')
    expect(matchField({ label: 'Surat lamaran' })).toBe('coverLetter')
    expect(matchField({ label: 'Letter of motivation' })).toBe('coverLetter')
  })

  it('leaves essays and other long answers alone', () => {
    expect(matchField({ label: 'Why do you want to work here?' })).toBeNull()
    expect(matchField({ label: 'Tell us about yourself' })).toBeNull()
    expect(matchField({ label: 'Cover note' })).toBeNull()
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

  it('does not read a long question as a short label that happens to appear inside it', () => {
    const visa = "Will you now or will you in the future require employment visa sponsorship to work in the country in which the job you're applying for is located? *"

    expect(matchField({ label: visa })).toBeNull()
    expect(matchField({ label: 'Do you have a degree in computer science or a related field of study?' })).toBeNull()
  })

  it('still matches a label that is a bit longer than a single word', () => {
    expect(matchField({ label: 'Phone number (include country code)' })).toBe('phone')
    expect(matchField({ label: 'Please enter your email' })).toBe('email')
  })

  it('leaves questions alone, even short ones that mention a known word', () => {
    expect(matchField({ label: 'Are you legally authorized to work in this country?' })).toBeNull()
    expect(matchField({ label: 'Do you need a visa to work in this city?' })).toBeNull()
    expect(matchField({ label: 'Why do you want to work here?' })).toBeNull()
  })

  it('accepts the polite lead-ins labels often start with', () => {
    expect(matchField({ label: 'Please provide your phone number' })).toBe('phone')
    expect(matchField({ label: "What's your first name?" })).toBe('firstName')
  })

  it('reads a label that starts with a known phrase even when widget text trails after it', () => {
    expect(matchField({ label: 'Current location ✱No location found. Try entering a different locationLoading' })).toBe('city')
    expect(matchField({ label: 'Email ✱ We will send a confirmation to this address when you submit' })).toBe('email')
  })

  it('ignores machine ids inside a label that is really a field name', () => {
    expect(matchField({ label: 'cb3c7708-4cfa-449d-9415-5b11f57cbab6__systemfield_eeoc_gender' })).toBe('gender')
  })

  it('does not match a long label that only mentions a known phrase later on', () => {
    expect(matchField({ label: 'Describe a project where you managed the full name of the product line across regions' })).toBeNull()
  })
})
