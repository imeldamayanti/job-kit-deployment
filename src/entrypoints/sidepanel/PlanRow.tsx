import type { PlanItem } from '../../core/matching/plan'
import { Checkbox } from '../../ui/primitives/Checkbox'

type PlanRowProps = {
  item: PlanItem
  enabled: boolean
  overwrite: boolean
  onToggle: () => void
  onOverwrite: (overwrite: boolean) => void
}

// Next to a field the form insists on and job-kit left for the user; the same field is outlined on the page (FR-20).
export function RequiredBadge() {
  return <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Wajib</span>
}

function Pair({ item }: { item: PlanItem }) {
  return (
    <span className="flex flex-col">
      <span className="text-[12px] text-text-secondary">{item.label}</span>
      <span className="line-clamp-3 break-words text-[13px] font-semibold text-text-primary">{item.value}</span>
      {item.key === 'coverLetter' && (
        <span className="mt-1 self-start rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-text-secondary">Dari Lamaran</span>
      )}
    </span>
  )
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'h-7 px-3 text-[12px] font-semibold transition-colors duration-150 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
        (selected ? 'bg-accent text-text-on-accent' : 'bg-neutral-100 text-text-secondary hover:bg-neutral-200')
      }
    >
      {children}
    </button>
  )
}

export function PlanRow({ item, enabled, overwrite, onToggle, onOverwrite }: PlanRowProps) {
  if (!item.hasExistingText) {
    return (
      <Checkbox checked={enabled} onChange={onToggle}>
        <Pair item={item} />
      </Checkbox>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Pair item={item} />
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-700">Sudah berisi</span>
        <div role="group" aria-label={`Field ${item.label} sudah berisi`} className="inline-flex overflow-hidden rounded-md">
          <Choice selected={overwrite} onClick={() => onOverwrite(true)}>
            Timpa
          </Choice>
          <Choice selected={!overwrite} onClick={() => onOverwrite(false)}>
            Lewati
          </Choice>
        </div>
      </div>
    </div>
  )
}
