import { initialFeedState, type FeedState } from './schedule'
import type { FeedFilter } from './view'
import type { Job, SourceRun } from './types'

// Sample feeds to look at every state of the Lowongan page in a dev build (T28 mockup).
// Never reachable from a production build.
export type FeedPreview = {
  feed: Job[]
  runs: SourceRun[]
  state: FeedState
  hasRoles: boolean
  anySourceOn: boolean
  filter?: Partial<FeedFilter>
}

const AT = '2026-10-10T08:00:00.000Z'
const base: Job = {
  id: '', status: 'new', score: null, aiFilled: [], firstSeenAt: AT, lastSeenAt: AT, source: 'greenhouse', title: '', company: '',
  location: '', workplace: 'unknown', contract: '', level: '', salary: '', experience: '', postedAt: '', deadline: '', url: 'https://example.test/job', description: '', logoUrl: '',
}

const SAMPLE: Job[] = [
  {
    ...base, id: 'p1', title: 'Frontend Engineer (React)', company: 'PT Contoh Karya', location: 'Jakarta', workplace: 'remote', contract: 'Full-time',
    level: 'Mid Level', aiFilled: ['level'], salary: 'Rp 20–30 jt', experience: '3+ tahun', deadline: '2026-11-12', postedAt: '2026-10-08',
    score: { value: 86, rough: false, inputHash: 'p', matches: ['React dan TypeScript ada di skill kamu', 'Remote sesuai tipe kerja yang kamu pilih', 'Level Mid sama dengan targetmu'], gaps: ['Meminta GraphQL, belum ada di skill', 'Meminta 3+ tahun, pengalamanmu sekitar 2 tahun'], summary: 'Cocok di stack dan cara kerja; kurang di GraphQL dan lama pengalaman.' },
  },
  {
    ...base, id: 'p2', source: 'lever', title: 'Web Developer — Platform Pembayaran dan Integrasi Mitra Bisnis (Kontrak 12 Bulan, Penempatan Sementara)', company: 'Studio Contoh',
    location: 'Bandung', workplace: 'hybrid', contract: 'Kontrak', postedAt: '2026-10-08',
    score: { value: 64, rough: false, inputHash: 'p', matches: ['Web dan JavaScript cocok'], gaps: ['Domain pembayaran belum ada di pengalamanmu'], summary: 'Cocok sebagian.' },
  },
  {
    ...base, id: 'p3', source: 'remotive', title: 'Senior Frontend Developer', company: 'Contoh Remote Co', location: 'Worldwide', workplace: 'remote', contract: 'Full-time',
    level: 'Senior Level', salary: 'USD 3–4 rb / bulan', postedAt: '2026-10-05',
    score: { value: 58, rough: true, inputHash: '', matches: ['Role cocok: Senior Frontend Developer'], gaps: ['Level Senior, targetmu Mid'], summary: 'Dinilai dari aturan. Cocok: 1 hal. Kurang: 1 hal.' },
  },
]

const SAVED: Job[] = [
  { ...SAMPLE[0]!, id: 's1', status: 'applied' },
  { ...base, id: 's2', source: 'ashby', title: 'UI Engineer', company: 'Contoh Digital Nusantara', status: 'saved', postedAt: '2026-10-07' },
  { ...SAMPLE[2]!, id: 's3', status: 'saved' },
  { ...base, id: 's4', title: 'Magang UI', company: 'PT Lain', status: 'hidden' },
]

const ok = (source: SourceRun['source'], count: number): SourceRun => ({ source, at: AT, ok: true, count })
const failed = (source: SourceRun['source'], reason: SourceRun['reason']): SourceRun => ({ source, at: AT, ok: false, count: 0, reason })
const state = (change: Partial<FeedState> = {}): FeedState => ({ ...initialFeedState(), lastRunAt: AT, newJobs: 24, ...change })

const on = { hasRoles: true, anySourceOn: true }
const SCENARIOS: Record<string, FeedPreview> = {
  list: { ...on, feed: SAMPLE, runs: [ok('greenhouse', 12), ok('lever', 8), ok('remotive', 4)], state: state() },
  saved: { ...on, feed: [...SAMPLE, ...SAVED], runs: [ok('greenhouse', 12)], state: state(), filter: { tab: 'saved' } },
  off: { feed: [], runs: [], state: initialFeedState(), hasRoles: true, anySourceOn: false },
  noprefs: { feed: [], runs: [], state: initialFeedState(), hasRoles: false, anySourceOn: false },
  fetching: { ...on, feed: [], runs: [], state: state({ running: true, startedAt: AT, stage: 'fetch', lastRunAt: '' }) },
  empty: { ...on, feed: [], runs: [ok('greenhouse', 0), ok('remotive', 0)], state: state({ newJobs: 0 }) },
  nomatch: { ...on, feed: SAMPLE, runs: [ok('greenhouse', 12)], state: state(), filter: { workplace: 'onsite', query: 'android' } },
  onefail: { ...on, feed: SAMPLE, runs: [ok('greenhouse', 12), failed('linkedin', 'blocked')], state: state() },
  paused: { ...on, feed: SAMPLE, runs: [ok('greenhouse', 12), failed('linkedin', 'blocked')], state: state({ paused: ['linkedin'] }) },
  rough: { ...on, feed: SAMPLE, runs: [ok('greenhouse', 12)], state: state({ aiProblem: 'invalid-key' }) },
  allfail: { ...on, feed: [], runs: [failed('greenhouse', 'timeout'), failed('linkedin', 'blocked')], state: state({ newJobs: 0 }) },
}

export function previewFeedFromHash(hash: string): FeedPreview | undefined {
  const match = /^#jobs\?(?:.*&)?state=([a-z]+)/.exec(hash)
  return match ? SCENARIOS[match[1] as string] : undefined
}
