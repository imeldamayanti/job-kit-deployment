import { truncateText } from '../feed/text'
import type { CvPayload } from '../tailor/privacy'
import type { Lang, Tone } from './language'

const LANGUAGE: Record<Lang, string> = { id: 'bahasa Indonesia', en: 'English' }
const TONE: Record<Tone, string> = {
  formal: 'formal: sopan, lugas, tanpa singkatan gaul',
  casual: 'santai: hangat dan natural, tetap sopan, tanpa bahasa gaul',
}

// The model writes the body only. The closing and the name are added on this computer (closing.ts).
export function letterSystem(lang: Lang, tone: Tone): string {
  return `Kamu menulis surat lamaran kerja dalam ${LANGUAGE[lang]}, nada ${TONE[tone]}. Dasarnya hanya profil dan lowongan di bawah.
Aturan keras:
- Hanya gunakan fakta yang ada di profil. Jangan menambah skill, alat, angka, persen, tahun, atau pencapaian yang tidak tertulis di deskripsi pengalaman.
- Jangan menyebut alat atau teknologi dari lowongan yang tidak ada di profil, bahkan untuk mengaku belum memakainya. Bicarakan yang memang dimiliki.
- Panjang 120 sampai 250 kata, tiga sampai empat paragraf: pembuka dan posisi yang dilamar, dua pengalaman yang paling relevan dengan lowongan, lalu ajakan berdiskusi.
- Jangan menulis nama pelamar, kontak, tanggal, atau alamat. Mulai dengan salam kepada tim rekrutmen perusahaan. Kode seperti {C1} atau {S1} boleh muncul apa adanya.
- Jangan menulis penutup atau tanda tangan (misalnya "Hormat saya" atau nama): itu ditambahkan terpisah.
- Balas hanya JSON, tanpa teks lain, tanpa code fence.
Bentuk JSON:
{ "letter": "isi surat, paragraf dipisah baris kosong" }`
}

const MAX_POSTING_CHARS = 4000

export function letterUserPrompt(job: { title: string; company: string; description: string }, payload: CvPayload): string {
  return `LOWONGAN\nJudul: ${job.title}\nPerusahaan: ${job.company}\n${truncateText(job.description, MAX_POSTING_CHARS)}\n\nPROFIL\n${JSON.stringify(payload, null, 1)}`
}
