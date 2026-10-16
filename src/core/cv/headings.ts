export type HeadingKind = 'education' | 'experience' | 'skills' | 'contact' | 'other'

// Section headings seen on Indonesian and English CVs, lower-case.
const HEADINGS: Record<HeadingKind, string[]> = {
  education: ['pendidikan', 'riwayat pendidikan', 'pendidikan formal', 'education', 'educations', 'educational background', 'academic background'],
  experience: [
    'pengalaman',
    'pengalaman kerja',
    'riwayat pekerjaan',
    'pengalaman profesional',
    'pengalaman organisasi',
    'work experience',
    'work experiences',
    'experiences',
    'professional experiences',
    'internship',
    'internships',
    'professional experience',
    'experience',
    'employment',
    'employment history',
    'work history',
  ],
  skills: ['keahlian', 'keterampilan', 'kemampuan', 'kompetensi', 'skills', 'technical skills', 'core skills'],
  contact: ['kontak', 'informasi kontak', 'data diri', 'contact', 'contact info', 'contact information', 'personal details'],
  other: [
    'ringkasan',
    'profil',
    'tentang saya',
    'summary',
    'profile',
    'about me',
    'bahasa',
    'languages',
    'proyek',
    'projects',
    'sertifikasi',
    'certifications',
    'penghargaan',
    'awards',
    'referensi',
    'references',
    'minat',
    'interests',
  ],
}

const LOOKUP = new Map<string, HeadingKind>(
  (Object.entries(HEADINGS) as [HeadingKind, string[]][]).flatMap(([kind, names]) => names.map((name) => [name, kind] as const)),
)

function normalize(line: string): string {
  return line
    .toLowerCase()
    .replace(/[:•·|-]+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// The kind of section a line opens, or undefined when the line is not a heading.
export function headingKind(line: string): HeadingKind | undefined {
  return LOOKUP.get(normalize(line))
}
