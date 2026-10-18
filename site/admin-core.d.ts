export type Stats = {
  accountsTotal: number
  accountsWriting7d: number
  newByDay: { day: string; count: number }[]
  events7d: { name: string; version: string; count: number }[]
  byVersion30d: { version: string; count: number }[]
}
export function parseStats(raw: unknown): Stats
export function sections(stats: Stats): { headline: { label: string; value: string }[]; tables: { title: string; head: string[]; rows: string[][] }[] }
export function adminRequest(config: { url: string; key: string }, token: string): { url: string; init: { method: string; headers: Record<string, string>; body: string } }
