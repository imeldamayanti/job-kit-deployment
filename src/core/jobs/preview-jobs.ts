import type { CapturedJob, JobFilter } from './types'

const SNAPSHOT = [
  { label: 'Nama lengkap', value: 'Imelda Damayanti' },
  { label: 'Email', value: 'imelda@example.test' },
  { label: 'No. telepon', value: '+62 812 3456 7890' },
  { label: 'LinkedIn', value: 'linkedin.com/in/imelda' },
  { label: 'Kota', value: 'Bandung' },
  { label: 'Institusi', value: 'Universitas Contoh' },
  { label: 'Jurusan', value: 'Teknik Informatika' },
  { label: 'IPK', value: '3.62' },
]

// Sample rows for looking at the Captured Jobs page in a dev build. Never reachable from a production build.
export const PREVIEW_JOBS: CapturedJob[] = [
  { id: 'p1', title: 'Frontend Engineer', company: 'Contoh Karya', origin: 'boards.example.test', appliedAt: '2026-09-02T10:14:00Z', status: 'Applied', snapshot: SNAPSHOT },
  { id: 'p2', title: 'Software Engineer, Web Platform (Fresh Graduate Program 2026)', company: 'Nusa Teknologi', origin: 'careers.nusa.test', appliedAt: '2026-08-29T09:00:00Z', status: 'In Review', snapshot: SNAPSHOT },
  { id: 'p3', title: 'React Developer', company: 'Bumi Mandiri', origin: 'jobs.bumi.test', appliedAt: '2026-08-24T09:00:00Z', status: 'Offer', snapshot: SNAPSHOT },
  { id: 'p4', title: 'Frontend Engineer (Intern)', company: 'Aksara Pagi', origin: 'aksara.test', appliedAt: '2026-08-18T09:00:00Z', status: 'Rejected', snapshot: SNAPSHOT },
  { id: 'p5', title: 'Fullstack Engineer', company: 'Sinar Data', origin: 'boards.example.test', appliedAt: '2026-08-11T09:00:00Z', status: 'Applied', snapshot: SNAPSHOT },
]

export type JobsViewState = { jobs: CapturedJob[]; openId: string | null; status: JobFilter; query: string }

const PREVIEW_STATES: Record<string, JobsViewState> = {
  list: { jobs: PREVIEW_JOBS, openId: null, status: 'Semua', query: '' },
  empty: { jobs: [], openId: null, status: 'Semua', query: '' },
  'filtered-empty': { jobs: PREVIEW_JOBS, openId: null, status: 'Offer', query: 'zzz' },
  detail: { jobs: PREVIEW_JOBS, openId: 'p1', status: 'Semua', query: '' },
}

// "#jobs?state=detail" -> the sample state of that name, or undefined.
export function previewJobsStateFromHash(hash: string): JobsViewState | undefined {
  const name = new URLSearchParams(hash.split('?')[1] ?? '').get('state')
  return name ? PREVIEW_STATES[name] : undefined
}
