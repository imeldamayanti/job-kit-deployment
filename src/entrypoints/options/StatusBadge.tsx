import type { JobStatus } from '../../core/jobs/types'

const TONES: Record<JobStatus, string> = {
  Applied: 'bg-neutral-100 text-text-secondary',
  'In Review': 'bg-violet-50 text-violet-700',
  Offer: 'bg-green-50 text-green-700',
  Rejected: 'bg-rose-50 text-rose-700',
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[12px] font-semibold ' + TONES[status]}>
      {status}
    </span>
  )
}
