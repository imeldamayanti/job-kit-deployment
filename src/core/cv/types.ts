export type Confidence = 'high' | 'low'
export type Detected = { value: string; confidence: Confidence }

export type EducationEntry = Partial<Record<'institution' | 'level' | 'major' | 'gpa' | 'year', Detected>>

export type ExperienceEntry = Partial<Record<'title' | 'company' | 'start' | 'end' | 'description', Detected>> & {
  current: boolean
}

// Text the rules could not place, handed back as written so nothing a CV says is silently lost.
export type UnparsedBlock = { kind: 'education' | 'experience'; text: string }

export type CvDraft = {
  personal: Partial<Record<'firstName' | 'middleName' | 'lastName', Detected>>
  contact: Partial<Record<'email' | 'phone' | 'linkedin' | 'city', Detected>>
  education: EducationEntry[]
  experience: ExperienceEntry[]
  unparsed: UnparsedBlock[]
}
