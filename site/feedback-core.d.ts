export type FeedbackRow = { kind: string; message: string; email: string | null }
export type SupabaseConfig = { url: string; key: string }
export const KINDS: string[]
export const MAX_MESSAGE: number
export function isPublicKey(key: unknown): boolean
export function buildRow(data: FormData): FeedbackRow | null
export function sendFeedback(row: FeedbackRow, config: SupabaseConfig, fetchFn?: typeof fetch): Promise<'inactive' | 'sent' | 'failed'>
