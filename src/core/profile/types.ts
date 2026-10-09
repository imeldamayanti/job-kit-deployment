import type { JobPreferences } from './job-preferences'

export const PERSONAL_KEYS = [
  'firstName',
  'middleName',
  'lastName',
  'birthDate',
  'gender',
  'nationality',
] as const
export type PersonalKey = (typeof PERSONAL_KEYS)[number]

export const CONTACT_KEYS = [
  'email',
  'phone',
  'linkedin',
  'website',
  'street',
  'city',
  'province',
  'postalCode',
  'country',
] as const
export type ContactKey = (typeof CONTACT_KEYS)[number]

export type Education = {
  id: string
  institution: string
  level: string
  major: string
  gpa: string
  year: string
}

export type Experience = {
  id: string
  company: string
  title: string
  start: string
  end: string
  current: boolean
  description: string
}

export type Profile = {
  version: 2
  personal: Record<PersonalKey, string>
  contact: Record<ContactKey, string>
  education: Education[]
  experience: Experience[]
  skills: { group: 'teknis' | 'bahasa' | 'lainnya'; name: string }[]
  custom: { id: string; key: string; value: string }[]
  jobPrefs: JobPreferences
}
