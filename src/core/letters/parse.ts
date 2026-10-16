import { readJson } from '../tailor/parse'

export type ParsedLetter = { ok: true; body: string } | { ok: false; reason: string }

export const MIN_WORDS = 30
export const MAX_WORDS = 450

const words = (text: string) => text.trim().split(/\s+/).filter((w) => w !== '').length

// Shape and size only, like the CV (T48); whether the facts are true is validateLetter's job. Keys the model adds are ignored.
export function parseLetter(text: string): ParsedLetter {
  const data = readJson(text)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'Jawaban penyedia bukan JSON.' }
  const letter = (data as Record<string, unknown>).letter
  if (typeof letter !== 'string') return { ok: false, reason: 'Jawaban penyedia tidak berbentuk surat: letter.' }
  const body = letter.trim()
  if (body === '') return { ok: false, reason: 'Surat dari penyedia kosong.' }
  const count = words(body)
  if (count < MIN_WORDS) return { ok: false, reason: `Surat dari penyedia terlalu pendek (${count} kata).` }
  if (count > MAX_WORDS) return { ok: false, reason: `Surat dari penyedia terlalu panjang (${count} kata).` }
  return { ok: true, body }
}
