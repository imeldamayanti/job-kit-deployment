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
  // Optional, left out of a stored profile while empty. `achievements` is one per line.
  location?: string
  publication?: string
  achievements?: string
}

export type Experience = {
  id: string
  company: string
  title: string
  start: string
  end: string
  current: boolean
  description: string
  location?: string
}

// A project for the CV. `description` is one bullet per line.
export type Project = {
  id: string
  name: string
  role: string
  date: string
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
  // A short profile paragraph under the name on the CV, and the projects section. Both optional.
  summary?: string
  projects?: Project[]
}
