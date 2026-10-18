import { PROFILE_SECTIONS, type SectionId } from './sections'
import type { Profile } from './types'

const filled = (value: string) => value.trim() !== ''
const countFilled = (record: Record<string, string>) => Object.values(record).filter(filled).length

// Sections Fill can use. Preferensi kerja is left out: the panel and the empty check are about autofill.
type FillSectionId = Exclude<SectionId, 'preferences'>

function counts(profile: Profile): Record<FillSectionId, number> {
  return {
    personal: countFilled(profile.personal),
    contact: countFilled(profile.contact),
    education: profile.education.filter((e) => [e.institution, e.level, e.major, e.gpa, e.year].some(filled)).length,
    experience: profile.experience.filter((x) => [x.company, x.title, x.start, x.end, x.description].some(filled)).length,
    projects: (profile.projects ?? []).filter((p) => [p.name, p.role, p.date, p.description].some(filled)).length,
    custom: profile.custom.filter((pair) => filled(pair.key) || filled(pair.value)).length,
  }
}

export function isProfileEmpty(profile: Profile): boolean {
  return Object.values(counts(profile)).every((count) => count === 0)
}

export function summarizeProfile(profile: Profile) {
  const total = counts(profile)
  const { firstName, middleName, lastName } = profile.personal
  return {
    name: [firstName, middleName, lastName].filter(filled).join(' '),
    email: profile.contact.email,
    sections: PROFILE_SECTIONS.filter((section): section is typeof section & { id: FillSectionId } => section.id !== 'preferences').map(({ id, title }) => ({
      id,
      text: `${title} · ${total[id] === 0 ? 'belum diisi' : total[id]}`,
    })),
  }
}
