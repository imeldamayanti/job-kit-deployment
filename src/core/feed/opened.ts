import type { Application } from '../applications/types'
import type { Job } from './types'

// A tab opened from the feed. The side panel uses it to say where the tab came from and to mark
// the job as applied once Fill worked (FR-31).
// `applicationId` is set when the tab was opened from an application (Detail Lamaran), which may be one with no feed job.
export type OpenedJob = { jobId: string; applicationId?: string; title: string; score: number | null; rough: boolean }

export const openedFrom = (job: Job): OpenedJob => ({
  jobId: job.id,
  title: job.title,
  score: job.score?.value ?? null,
  rough: job.score?.rough ?? false,
})

// Opening from an application (Detail Lamaran): the title is the application's own copy, and the score
// comes from the job only if the feed still has it.
export const openedFromApplication = (app: Application, job: Job | undefined): OpenedJob => ({
  jobId: app.jobId ?? '',
  applicationId: app.id,
  title: app.job.title,
  score: job?.score?.value ?? null,
  rough: job?.score?.rough ?? false,
})

export function bannerText(opened: OpenedJob): string {
  if (opened.score === null) return 'Dari Lowongan'
  return opened.rough ? `Dari Lowongan · skor kasar ${opened.score}` : `Dari Lowongan · skor ${opened.score}`
}

export const shouldMarkApplied = (opened: OpenedJob | undefined, filled: number): boolean => opened !== undefined && filled > 0
