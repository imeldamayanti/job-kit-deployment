import type { PersonalKey } from './types'

export const PERSONAL_FIELDS: readonly { key: PersonalKey; label: string; placeholder: string }[] = [
  { key: 'firstName', label: 'Nama depan', placeholder: 'Imelda' },
  { key: 'middleName', label: 'Nama tengah', placeholder: 'Sari' },
  { key: 'lastName', label: 'Nama belakang', placeholder: 'Wijaya' },
  { key: 'birthDate', label: 'Tanggal lahir', placeholder: '17 Agustus 1998' },
  { key: 'gender', label: 'Jenis kelamin', placeholder: 'Perempuan' },
  { key: 'nationality', label: 'Kewarganegaraan', placeholder: 'Indonesia' },
]
