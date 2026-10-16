import { checkText } from '../tailor/grounded'
import type { Profile } from '../profile/types'
import type { Grounding } from '../tailor/types'

// FR-40 for a letter: a number or technical term must come from the Profile. A letter is not tied to one experience, so
// its source is all of them, plus the dates and years the Profile holds, plus the words of the job title and company,
// which the person is naming and not claiming. The posting's own text is not a source: a tool it lists is not a skill.
export function validateLetter(body: string, profile: Profile, job: { title: string; company: string }): Grounding {
  const source = [
    ...profile.experience.flatMap((e) => [e.description, e.start, e.end]),
    ...profile.education.flatMap((e) => [e.year, e.major, e.level]),
    job.title,
    job.company,
  ].join('\n')
  const violations = checkText(body, source, profile, 'surat')
  return { ok: violations.length === 0, violations }
}
