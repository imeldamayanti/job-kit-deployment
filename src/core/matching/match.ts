import type { ContactKey, PersonalKey } from '../profile/types'

export type MatchKey = 'fullName' | PersonalKey | ContactKey

type Rule = { key: MatchKey; phrases: string[]; exact?: string[] }

// Order matters: the first rule that matches wins, so specific keys come before generic ones
// ("alamat email" must reach email before street).
const RULES: Rule[] = [
  { key: 'email', phrases: ['email', 'e mail', 'surel'] },
  { key: 'linkedin', phrases: ['linkedin'] },
  { key: 'website', phrases: ['website', 'portfolio', 'situs web'] },
  { key: 'phone', phrases: ['telepon', 'telephone', 'phone', 'no hp', 'nomor hp', 'hp', 'mobile', 'handphone', 'whatsapp', 'no telp'] },
  { key: 'firstName', phrases: ['nama depan', 'first name', 'given name', 'forename'] },
  { key: 'middleName', phrases: ['nama tengah', 'middle name'] },
  { key: 'lastName', phrases: ['nama belakang', 'last name', 'surname', 'family name'] },
  { key: 'fullName', phrases: ['nama lengkap', 'full name', 'your name'], exact: ['nama', 'name'] },
  { key: 'birthDate', phrases: ['tanggal lahir', 'tgl lahir', 'date of birth', 'birth date', 'birthday', 'dob'] },
  { key: 'gender', phrases: ['jenis kelamin', 'gender'] },
  { key: 'nationality', phrases: ['kewarganegaraan', 'nationality', 'citizenship'] },
  { key: 'postalCode', phrases: ['kode pos', 'postal code', 'zip code', 'postcode'], exact: ['zip'] },
  { key: 'province', phrases: ['provinsi', 'province'], exact: ['state'] },
  { key: 'city', phrases: ['kota', 'city', 'kabupaten'] },
  { key: 'country', phrases: ['negara', 'country'] },
  { key: 'street', phrases: ['alamat', 'street address', 'address', 'street'] },
]

const AUTOCOMPLETE: Record<string, MatchKey> = {
  'given-name': 'firstName',
  'additional-name': 'middleName',
  'family-name': 'lastName',
  name: 'fullName',
  email: 'email',
  tel: 'phone',
  'street-address': 'street',
  'address-line1': 'street',
  'address-level2': 'city',
  'address-level1': 'province',
  'postal-code': 'postalCode',
  'country-name': 'country',
  country: 'country',
  bday: 'birthDate',
  sex: 'gender',
  url: 'website',
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function matchByLabel(label: string): MatchKey | null {
  const text = normalize(label)
  const padded = ` ${text} `
  for (const rule of RULES) {
    if (rule.exact?.includes(text)) return rule.key
    if (rule.phrases.some((phrase) => padded.includes(` ${phrase} `))) return rule.key
  }
  return null
}

function matchByAutocomplete(autocomplete: string | undefined): MatchKey | null {
  const token = autocomplete?.trim().toLowerCase().split(/\s+/).pop()
  return (token && AUTOCOMPLETE[token]) || null
}

export function matchField(field: { label: string; autocomplete?: string }): MatchKey | null {
  return matchByAutocomplete(field.autocomplete) ?? matchByLabel(field.label)
}
