import type { ContactKey, PersonalKey } from '../profile/types'

export type MatchKey = 'fullName' | 'educationLevel' | PersonalKey | ContactKey | `custom:${string}`

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
  { key: 'fullName', phrases: ['nama lengkap', 'full name', 'legal name', 'full legal name', 'nama sesuai ktp'], exact: ['nama', 'name'] },
  {
    key: 'educationLevel',
    phrases: ['jenjang pendidikan', 'tingkat pendidikan', 'pendidikan terakhir', 'education level', 'level of education', 'highest education', 'degree'],
    exact: ['education', 'pendidikan'],
  },
  { key: 'birthDate', phrases: ['tanggal lahir', 'tgl lahir', 'date of birth', 'birth date', 'birthday', 'dob'] },
  { key: 'gender', phrases: ['jenis kelamin', 'gender'] },
  { key: 'nationality', phrases: ['kewarganegaraan', 'nationality', 'citizenship'] },
  { key: 'postalCode', phrases: ['kode pos', 'postal code', 'zip code', 'postcode'], exact: ['zip'] },
  { key: 'province', phrases: ['provinsi', 'province'], exact: ['state'] },
  { key: 'city', phrases: ['kota', 'city', 'kabupaten', 'current location', 'lokasi saat ini', 'domisili', 'domicile', 'place of residence', 'city of residence'], exact: ['location', 'lokasi'] },
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

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Questions ("Are you authorised to work in this country?") often contain a known word without asking for it,
// and a label can carry widget text after the real name ("Current location No location found...").
// A short label may mention the phrase anywhere; a long one only counts when it starts with it.
const MAX_LABEL_WORDS = 6
const LEAD_IN = /^(please|kindly|enter|provide|type|input|your|the|what is|what s)\s+/
const QUESTION_START = /^(do|does|did|are|is|will|have|has|can|could|would|should|why|how|when|which|who|what)\s/
const MACHINE_ID = /^(?=.*\d)[0-9a-f]{4,}$/

function withoutLeadIn(text: string): string {
  let rest = text
  for (let next = rest.replace(LEAD_IN, ''); next !== rest; next = rest.replace(LEAD_IN, '')) rest = next
  return rest
}

function readable(label: string): string {
  const words = normalize(label)
    .split(' ')
    .filter((word) => !MACHINE_ID.test(word))
  return withoutLeadIn(words.join(' '))
}

function matchByLabel(label: string): MatchKey | null {
  const text = readable(label)
  if (QUESTION_START.test(`${text} `)) return null
  const long = text.split(' ').length > MAX_LABEL_WORDS
  const padded = ` ${text} `
  const hasPhrase = (phrase: string) => (long ? padded.startsWith(` ${phrase} `) : padded.includes(` ${phrase} `))
  for (const rule of RULES) {
    if (rule.exact?.includes(text)) return rule.key
    if (rule.phrases.some(hasPhrase)) return rule.key
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
