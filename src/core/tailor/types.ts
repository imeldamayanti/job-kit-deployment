// What the AI may return for a CV (RFC D12). There is no slot for a job title, company, school or date,
// so those cannot be invented: job-kit takes them from the Profile (assemble).
export type TailorExperience = { sourceId: string; bullets: string[] }
export type TailorOutput = { skills: string[]; experience: TailorExperience[]; education: string[] }

export type ViolationType = 'skill' | 'source' | 'number' | 'term'
// `where` says which part broke the rule: "skills", "experience", "education", "<sourceId>#<bullet number>" or a document name.
export type Violation = { type: ViolationType; value: string; where: string }
export type Grounding = { ok: boolean; violations: Violation[] }

// A CV ready to show or print: facts from the Profile, wording from the AI.
export type CvDocument = {
  header: { name: string; contacts: string[] }
  skills: string[]
  experience: { sourceId: string; title: string; company: string; start: string; end: string; current: boolean; bullets: string[] }[]
  education: { id: string; institution: string; level: string; major: string; gpa: string; year: string }[]
}
