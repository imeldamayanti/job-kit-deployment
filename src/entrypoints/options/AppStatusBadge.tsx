import type { AppStatus } from '../../core/applications/types'
import { STATUS_LABEL, STATUS_TONE, type StatusTone } from '../../core/applications/view'

// Tones from the T40 mockup: green is "sent", violet "in review", amber "needs attention", rose "closed against you".
const TONES: Record<StatusTone, string> = {
  dim: 'bg-neutral-100 text-text-secondary',
  ok: 'bg-green-50 text-green-700',
  prog: 'bg-violet-50 text-violet-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-rose-50 text-rose-700',
}

export function AppStatusBadge({ status }: { status: AppStatus }) {
  return (
    <span className={'inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[12px] font-semibold ' + TONES[STATUS_TONE[status]]}>
      {STATUS_LABEL[status]}
    </span>
  )
}
