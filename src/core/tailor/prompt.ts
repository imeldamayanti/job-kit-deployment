import { truncateText } from '../feed/text'
import type { CvPayload } from './privacy'

// One call asks for the requirements and the draft together: the spike (T45) found two calls no better and twice the
// requests, which matters at a free tier of about 20 a day. job-kit computes coverage itself and uses the model's "covered" only as a claim for requirements that name no tool (coverage.ts).
const SHAPE = `{
  "requirements": ["requirement lowongan, maksimal 8"],
  "covered": ["requirement dari daftar di atas yang didukung profil, disalin persis"],
  "skills": ["skill dari daftar skill profil, diurutkan dari yang paling relevan"],
  "experience": [{ "sourceId": "id pengalaman", "bullets": ["butir hasil penyesuaian"] }],
  "education": ["id pendidikan yang relevan"]
}`

export const CV_SYSTEM = `Kamu menyesuaikan CV dengan lowongan. Dari teks lowongan, ambil requirement-nya, lalu pilih dan rapikan isi profil agar selaras.
Aturan keras:
- Hanya gunakan fakta yang ada di profil. Jangan menambah skill, alat, angka, persen, atau pencapaian yang tidak tertulis di deskripsi pengalaman.
- "skills" hanya boleh berisi nama dari daftar skill profil.
- Tiap butir ditulis ulang dari deskripsi pengalaman asalnya, maksimal 3 butir per pengalaman, dalam bahasa yang sama dengan deskripsi asalnya. Urutkan pengalaman dan butir dari yang paling relevan dengan lowongan.
- Jangan menulis jabatan, nama perusahaan, institusi, atau tanggal. Kode seperti {C1} atau {S1} boleh muncul apa adanya.
- Requirement yang tidak didukung profil tetap ditulis di "requirements"; jangan ditambal dengan butir karangan.
- Balas hanya JSON, tanpa teks lain, tanpa code fence.
Bentuk JSON:
${SHAPE}`

const MAX_POSTING_CHARS = 4000

export function cvUserPrompt(job: { title: string; description: string }, payload: CvPayload): string {
  return `LOWONGAN\nJudul: ${job.title}\n${truncateText(job.description, MAX_POSTING_CHARS)}\n\nPROFIL\n${JSON.stringify(payload, null, 1)}`
}
