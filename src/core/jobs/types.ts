export const JOB_STATUSES = ['Applied', 'In Review', 'Rejected', 'Offer'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
export type JobFilter = JobStatus | 'Semua'

export type CapturedJob = {
  id: string
  title: string
  company: string
  origin: string
  appliedAt: string
  status: JobStatus
  snapshot: { label: string; value: string }[]
}
