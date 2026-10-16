import { SOURCE_NAMES } from '../feed/view'
import type { AppStatus, Application, PostingSource } from './types'

export const STATUS_LABEL: Record<AppStatus, string> = {
  draft: 'Draft',
  applied: 'Dilamar',
  'in-review': 'Direview',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Ditolak',
  withdrawn: 'Dibatalkan',
}

// Badge tone per status (T40 mockup, design-system §4.4). Dilamar and Offer are both green; the word tells them apart.
export type StatusTone = 'dim' | 'ok' | 'prog' | 'warn' | 'bad'
export const STATUS_TONE: Record<AppStatus, StatusTone> = {
  draft: 'dim',
  applied: 'ok',
  'in-review': 'prog',
  interview: 'warn',
  offer: 'ok',
  rejected: 'bad',
  withdrawn: 'dim',
}

// Ditolak and Dibatalkan are folded under the board so five columns fit (PRD §6.8).
export const BOARD_STATUSES = ['draft', 'applied', 'in-review', 'interview', 'offer'] as const satisfies readonly AppStatus[]
export type BoardStatus = (typeof BOARD_STATUSES)[number]

export function searchApplications(apps: readonly Application[], query: string): Application[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...apps]
  return apps.filter((app) => [app.job.title, app.job.company].some((text) => text.toLowerCase().includes(needle)))
}

export type BoardColumn = { status: BoardStatus; label: string; apps: Application[] }
export type Board = { columns: BoardColumn[]; rejected: Application[]; withdrawn: Application[] }

const newestFirst = (a: Application, b: Application) => b.updatedAt.localeCompare(a.updatedAt)

export function groupBoard(apps: readonly Application[]): Board {
  const sorted = [...apps].sort(newestFirst)
  return {
    columns: BOARD_STATUSES.map((status) => ({ status, label: STATUS_LABEL[status], apps: sorted.filter((app) => app.status === status) })),
    rejected: sorted.filter((app) => app.status === 'rejected'),
    withdrawn: sorted.filter((app) => app.status === 'withdrawn'),
  }
}

// "Ditutup: Ditolak 3 · Dibatalkan 1", or '' when nothing is folded away.
export function closedSummary(board: Board): string {
  if (board.rejected.length + board.withdrawn.length === 0) return ''
  return `Ditutup: Ditolak ${board.rejected.length} · Dibatalkan ${board.withdrawn.length}`
}

export type ApplicationsView = 'empty' | 'no-match' | 'list'

export function describeApplications(total: number, shown: number): ApplicationsView {
  if (total === 0) return 'empty'
  return shown === 0 ? 'no-match' : 'list'
}

export const documentMarks = (app: Application): { cv: boolean; letter: boolean } => ({
  cv: app.cvId !== null,
  letter: app.letterId !== null,
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// The day as the person sees it on their own clock, e.g. "9 Okt".
export function formatShortDate(iso: string): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  const date = new Date(time)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

const SENT: readonly AppStatus[] = ['applied', 'in-review', 'interview', 'offer', 'rejected']

// "Dilamar 9 Okt": when the application first left Draft. A draft or a withdrawn one has not been sent.
export function appliedLabel(app: Application): string {
  if (!SENT.includes(app.status)) return ''
  const sent = app.events.find((event) => event.type === 'status' && event.to !== undefined && SENT.includes(event.to))
  const date = formatShortDate(sent?.at ?? app.createdAt)
  return date === '' ? '' : `Dilamar ${date}`
}

export type DetailTab = 'summary' | 'cv' | 'letter' | 'notes'

// The tabs of Detail Lamaran (S8).
export const DETAIL_TABS: readonly { id: DetailTab; title: string }[] = [
  { id: 'summary', title: 'Ringkasan' },
  { id: 'cv', title: 'CV' },
  { id: 'letter', title: 'Surat' },
  { id: 'notes', title: 'Catatan & riwayat' },
]

export const sourceLabel = (source: PostingSource): string => (source === 'manual' ? 'Manual' : SOURCE_NAMES[source])
