import { CONTACT_FIELDS, PERSONAL_FIELDS } from '../profile/fields'
import type { Education, Experience, Profile } from '../profile/types'
import type { Confidence, CvDraft, Detected, EducationEntry, ExperienceEntry, UnparsedBlock } from './types'

export type CvRowGroup = 'personal' | 'contact' | 'education' | 'experience'

// One line of the preview: a detected field, or a whole education/experience entry.
export type CvRow = {
  id: string
  group: CvRowGroup
  label: string
  oldValue: string
  newValue: string
  confidence: Confidence
  // The profile already holds something here (a filled field, or entries in that section).
  occupied: boolean
  // The profile already has this same entry.
  duplicate: boolean
}

export type CvPreview = { rows: CvRow[]; unparsed: UnparsedBlock[] }

const norm = (value: string | undefined) => (value ?? '').trim().toLowerCase()
const parts = (items: (string | false | undefined)[]) => items.filter(Boolean).join(' · ')

function worstConfidence(entry: Record<string, unknown>): Confidence {
  const detected = Object.values(entry).filter((v): v is Detected => typeof v === 'object' && v !== null)
  return detected.some((d) => d.confidence === 'low') ? 'low' : 'high'
}

function scalarRows(
  group: 'personal' | 'contact',
  fields: readonly { key: string; label: string }[],
  detected: Partial<Record<string, Detected>>,
  current: Record<string, string>,
): CvRow[] {
  return fields.flatMap((field) => {
    const found = detected[field.key]
    if (!found) return []
    const oldValue = current[field.key] ?? ''
    return [
      {
        id: `${group}.${field.key}`,
        group,
        label: field.label,
        oldValue,
        newValue: found.value,
        confidence: found.confidence,
        occupied: oldValue.trim() !== '',
        duplicate: false,
      },
    ]
  })
}

function sameEducation(entry: EducationEntry, existing: Education): boolean {
  const year = entry.year?.value
  return (
    norm(entry.institution?.value) === norm(existing.institution) &&
    (!year || !existing.year || norm(year) === norm(existing.year))
  )
}

function sameExperience(entry: ExperienceEntry, existing: Experience): boolean {
  return norm(entry.company?.value) === norm(existing.company) && norm(entry.title?.value) === norm(existing.title)
}

function educationRows(entries: EducationEntry[], profile: Profile): CvRow[] {
  return entries.map((entry, index) => ({
    id: `education.${index}`,
    group: 'education',
    label: entry.institution?.value ?? 'Pendidikan',
    oldValue: '',
    newValue: parts([
      `${entry.level?.value ?? ''} ${entry.major?.value ?? ''}`.trim(),
      entry.gpa && `IPK ${entry.gpa.value}`,
      entry.year?.value,
    ]),
    confidence: worstConfidence(entry),
    occupied: profile.education.length > 0,
    duplicate: profile.education.some((existing) => sameEducation(entry, existing)),
  }))
}

function experienceRows(entries: ExperienceEntry[], profile: Profile): CvRow[] {
  return entries.map((entry, index) => {
    const period = [entry.start?.value, entry.current ? 'sekarang' : entry.end?.value].filter(Boolean).join(' - ')
    return {
      id: `experience.${index}`,
      group: 'experience',
      label: entry.title?.value ?? entry.company?.value ?? 'Pengalaman',
      oldValue: '',
      newValue: parts([entry.title && entry.company?.value, period]),
      confidence: worstConfidence(entry),
      occupied: profile.experience.length > 0,
      duplicate: profile.experience.some((existing) => sameExperience(entry, existing)),
    }
  })
}

// Everything the CV yielded, set against what the profile holds now.
export function buildCvPreview(draft: CvDraft, profile: Profile): CvPreview {
  return {
    rows: [
      ...scalarRows('personal', PERSONAL_FIELDS, draft.personal, profile.personal),
      ...scalarRows('contact', CONTACT_FIELDS, draft.contact, profile.contact),
      ...educationRows(draft.education, profile),
      ...experienceRows(draft.experience, profile),
    ],
    unparsed: draft.unparsed,
  }
}

// By default only what the profile does not hold yet is filled in.
export function defaultSelection(rows: CvRow[]): string[] {
  return rows.filter((row) => !row.occupied).map((row) => row.id)
}

export function toggleSelection(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
}
