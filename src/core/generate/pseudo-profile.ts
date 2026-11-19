import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import type { CvPayload } from '../tailor/privacy'

// A Profile built only from what the server receives (skills, bullets, titles, level, major, company and school codes), so the
// server can run the same fact checker as the extension without ever holding the real names (spec §5.4, Review Focus 4).
// The fields that cannot be in the payload stay empty: dates, GPA and years. `{C1}` and `{S1}` stand in for the employers and
// schools, and the checker already skips a name that the Profile owns, so a code is not counted as a technical term.
// A code keeps its letter and loses its number: the checker reads the numbers of a description as numbers the experience may
// claim, and the "2" of "{C2}" is not one of them.
const withoutCodeNumbers = (text: string) => text.replace(/\{([CS])\d+\}/g, '{$1}')

export function profileFromPayload(payload: CvPayload): Profile {
  const profile = createEmptyProfile()
  profile.skills = payload.skills.map((name) => ({ group: 'teknis', name }))
  profile.experience = payload.experience.map((e) => ({
    id: e.id, title: e.title, company: e.company, description: withoutCodeNumbers(e.description), start: '', end: '', current: false,
  }))
  profile.education = payload.education.map((e) => ({ id: e.id, institution: e.institution, level: e.level, major: e.major, gpa: '', year: '' }))
  return profile
}
