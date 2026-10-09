export type SectionId = 'personal' | 'contact' | 'custom'

export const SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'personal', title: 'Personal Info' },
  { id: 'contact', title: 'Contact & Address' },
  { id: 'custom', title: 'Custom Field' },
]
