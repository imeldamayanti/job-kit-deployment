import type { ContactKey, Education, Experience, PersonalKey, Profile } from '../profile/types'
import { buildCvPreview } from './preview'
import type { CvDraft, EducationEntry, ExperienceEntry } from './types'

export type CvApplyResult = { profile: Profile; filled: number; skipped: number }

const text = (value: { value: string } | undefined) => value?.value ?? ''

function educationFrom(entry: EducationEntry, id: string): Education {
  return {
    id,
    institution: text(entry.institution),
    level: text(entry.level),
    major: text(entry.major),
    gpa: text(entry.gpa),
    year: text(entry.year),
  }
}

function experienceFrom(entry: ExperienceEntry, id: string): Experience {
  return {
    id,
    company: text(entry.company),
    title: text(entry.title),
    start: text(entry.start),
    end: text(entry.end),
    current: entry.current,
    description: text(entry.description),
  }
}

// Writes the selected rows of the preview into the profile; everything else stays as it was.
// A filled field changes only when its row is selected, and entries are always added, never replaced.
export function applyCvSelection(
  profile: Profile,
  draft: CvDraft,
  selected: string[],
  makeId: () => string,
): CvApplyResult {
  const { rows } = buildCvPreview(draft, profile)
  const chosen = rows.filter((row) => selected.includes(row.id))
  const next: Profile = {
    ...profile,
    personal: { ...profile.personal },
    contact: { ...profile.contact },
    education: [...profile.education],
    experience: [...profile.experience],
  }

  for (const row of chosen) {
    const key = row.id.slice(row.id.indexOf('.') + 1)
    if (row.group === 'personal') next.personal[key as PersonalKey] = row.newValue
    else if (row.group === 'contact') next.contact[key as ContactKey] = row.newValue
    else if (row.group === 'education') next.education.push(educationFrom(draft.education[Number(key)] as EducationEntry, makeId()))
    else next.experience.push(experienceFrom(draft.experience[Number(key)] as ExperienceEntry, makeId()))
  }
  return { profile: next, filled: chosen.length, skipped: rows.length - chosen.length }
}

export function summarizeCvImport({ filled, skipped }: { filled: number; skipped: number }): { title: string; detail: string } {
  return {
    title: `${filled} field diisi, ${skipped} dilewati`,
    detail: 'Yang tidak dicentang tidak diubah. Periksa hasilnya di halaman profil.',
  }
}
