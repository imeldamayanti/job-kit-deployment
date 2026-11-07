// What the AI may return for a CV (RFC D12). There is no slot for a job title, company, school or date,
// so those cannot be invented: job-kit takes them from the Profile (assemble).
export type TailorExperience = { sourceId: string; bullets: string[] }
export type TailorOutput = { skills: string[]; experience: TailorExperience[]; education: string[] }

export type ViolationType = 'skill' | 'source' | 'number' | 'term'
// `where` says which part broke the rule: "skills", "experience", "education", "<sourceId>#<bullet number>" or a document name.
export type Violation = { type: ViolationType; value: string; where: string }
export type Grounding = { ok: boolean; violations: Violation[] }

// Which of Education and Work Experience comes first. The person picks it per CV: someone with a lot of work
// experience leads with it, a new graduate with the degree. The rest keeps its place.
export const CV_ORDERS = ['education-first', 'experience-first'] as const
export type CvOrder = (typeof CV_ORDERS)[number]
export const DEFAULT_CV_ORDER: CvOrder = 'education-first'

export type CvSection = 'education' | 'experience' | 'projects' | 'skills' | 'certifications'

// The sections of a CV from top to bottom, for every output (PDF, Word, text) so they never disagree.
export const cvSections = (order: CvOrder): CvSection[] =>
  order === 'experience-first'
    ? ['experience', 'education', 'projects', 'skills', 'certifications']
    : ['education', 'experience', 'projects', 'skills', 'certifications']

// A CV ready to show or print: facts from the Profile, wording from the AI.
export type CvDocument = {
  order: CvOrder
  // One line each, from the Profile's own fields named "Certification" or "Sertifikasi"; empty when there are none.
  certifications: string[]
  header: { name: string; contacts: string[] }
  skills: string[]
  // A short paragraph under the contacts, written by the person in the Profile; empty when there is none.
  summary: string
  experience: { sourceId: string; title: string; company: string; location: string; start: string; end: string; current: boolean; bullets: string[] }[]
  education: { id: string; institution: string; location: string; level: string; major: string; gpa: string; year: string; publication: string; achievements: string[] }[]
  // Taken from the Profile as written: the AI neither sees nor rewrites projects.
  projects: { id: string; name: string; role: string; date: string; bullets: string[] }[]
}
