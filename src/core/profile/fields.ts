import type { ContactKey, PersonalKey } from './types'

export const PERSONAL_FIELDS: readonly { key: PersonalKey; label: string; placeholder: string }[] = [
  { key: 'firstName', label: 'Nama depan', placeholder: 'Imelda' },
  { key: 'middleName', label: 'Nama tengah', placeholder: 'Sari' },
  { key: 'lastName', label: 'Nama belakang', placeholder: 'Wijaya' },
  { key: 'birthDate', label: 'Tanggal lahir', placeholder: '17 Agustus 1998' },
  { key: 'gender', label: 'Jenis kelamin', placeholder: 'Perempuan' },
  { key: 'nationality', label: 'Kewarganegaraan', placeholder: 'Indonesia' },
]

export const CONTACT_FIELDS: readonly { key: ContactKey; label: string; placeholder: string; wide?: boolean }[] = [
  { key: 'email', label: 'Email', placeholder: 'nama@example.test' },
  { key: 'phone', label: 'Telepon', placeholder: '0812 3456 7890' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/imelda' },
  { key: 'website', label: 'Website', placeholder: 'imelda.example.test' },
  { key: 'street', label: 'Alamat', placeholder: 'Jl. Melati No. 12', wide: true },
  { key: 'city', label: 'Kota', placeholder: 'Bandung' },
  { key: 'province', label: 'Provinsi', placeholder: 'Jawa Barat' },
  { key: 'postalCode', label: 'Kode pos', placeholder: '40115' },
  { key: 'country', label: 'Negara', placeholder: 'Indonesia' },
]
