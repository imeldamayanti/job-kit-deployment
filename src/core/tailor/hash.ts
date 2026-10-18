import type { Profile } from '../profile/types'

// A fingerprint of what a CV or letter reads from the Profile: name, contact, skills, experience, education.
// A document made from another fingerprint is stale (FR-45). Job preferences, custom fields and birth date are not
// shown in a CV, so changing them does not make it stale.
// Fields added later count only when filled, so a CV made before them is not made stale by their absence.
const extra = (...values: (string | undefined)[]) => (values.every((v) => (v ?? '').trim() === '') ? [] : values.map((v) => v ?? ''))

export function profileHash(profile: Profile): string {
  const { firstName, middleName, lastName } = profile.personal
  const { email, phone, city, linkedin, website } = profile.contact
  const seen = JSON.stringify({
    name: [firstName, middleName, lastName],
    contact: [email, phone, city, linkedin, website],
    skills: profile.skills.map((s) => s.name),
    experience: profile.experience.map((e) => [e.id, e.company, e.title, e.start, e.end, e.current, e.description, ...extra(e.location)]),
    education: profile.education.map((e) => [e.id, e.institution, e.level, e.major, e.gpa, e.year, ...extra(e.location, e.publication, e.achievements)]),
    ...(profile.summary?.trim() ? { summary: profile.summary.trim() } : {}),
    ...(profile.projects && profile.projects.length > 0 ? { projects: profile.projects.map((p) => [p.id, p.name, p.role, p.date, p.description]) } : {}),
  })
  let hash = 0x811c9dc5
  for (const char of seen) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export const isStale = (documentHash: string, profile: Profile): boolean => documentHash !== profileHash(profile)
