export type AiFailure = 'invalid-key' | 'quota' | 'network' | 'server' | 'bad-request' | 'no-permission' | 'invalid-output'

export class AiError extends Error {
  constructor(public reason: AiFailure) {
    super(reason)
  }
}

// Reads the provider's HTTP answer into one of the reasons the screen can explain.
export function mapAiFailure(status: number, body: string): AiFailure {
  if (status === 401 || status === 403) return 'invalid-key'
  if (status === 429) return 'quota'
  if (status >= 500) return 'server'
  if (/credit|billing|quota|balance/i.test(body)) return 'quota'
  return 'bad-request'
}

const MESSAGES: Record<AiFailure, string> = {
  'invalid-key': 'Kunci ditolak penyedia.',
  quota: 'Kuota atau saldo di penyedia habis.',
  network: 'Tidak bisa menghubungi penyedia. Periksa koneksi internet.',
  server: 'Penyedia sedang bermasalah. Coba lagi nanti.',
  'bad-request': 'Penyedia menolak permintaan. Periksa nama model.',
  'no-permission': 'Izin untuk api.anthropic.com belum diberikan.',
  'invalid-output': 'Jawaban penyedia tidak bisa dibaca.',
}

export const aiErrorMessage = (reason: AiFailure) => MESSAGES[reason]
