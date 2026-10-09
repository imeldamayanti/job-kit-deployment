export type SectionId = 'personal' | 'contact' | 'education' | 'experience' | 'custom'

export const SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'personal', title: 'Personal Info' },
  { id: 'contact', title: 'Contact & Address' },
  { id: 'education', title: 'Education' },
  { id: 'experience', title: 'Work Experience' },
  { id: 'custom', title: 'Custom Field' },
]
