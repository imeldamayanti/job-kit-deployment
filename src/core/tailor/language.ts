export type Lang = 'id' | 'en'

// Common function words of each language. Technical terms and names are the same in both, so they say nothing.
const ID = new Set(
  ('yang dan dengan untuk di ke dari pada adalah ini itu dalam akan atau kami kamu saya tidak juga sebagai oleh serta agar bisa dapat lebih ' +
    'membangun menulis membantu memiliki mencari bekerja tim pengalaman tahun sama bagi para sebuah setiap telah sudah masih sedang').split(/\s+/),
)
const EN = new Set(
  ('the and with for of to in is are we you our will be as on at by or an that this from have has was were their your it its into per ' +
    'built wrote helped looking experience team years work working using').split(/\s+/),
)

// Indonesian or English by the larger share of function words. Anything undecided is Indonesian: the product's own language.
export function detectLanguage(text: string): Lang {
  let id = 0
  let en = 0
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (ID.has(word)) id += 1
    if (EN.has(word)) en += 1
  }
  return en > id ? 'en' : 'id'
}

// The section names of a CV in the language of its text.
export const CV_LABELS: Record<Lang, { skills: string; experience: string; education: string; projects: string; gpa: string; publication: string; achievements: string; now: string }> = {
  id: { skills: 'Skill', experience: 'Pengalaman', education: 'Pendidikan', projects: 'Proyek', gpa: 'IPK', publication: 'Publikasi', achievements: 'Prestasi', now: 'sekarang' },
  en: { skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects', gpa: 'GPA', publication: 'Publication', achievements: 'Achievements', now: 'present' },
}
