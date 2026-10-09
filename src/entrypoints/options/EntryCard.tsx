import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../../ui/primitives/IconButton'

type EntryCardProps = {
  summary: string
  expanded: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  children: ReactNode
}

export function EntryCard({
  summary,
  expanded,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
  children,
}: EntryCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface-input">
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-neutral-100 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring'
          }
        >
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className={'shrink-0 text-text-secondary transition-transform duration-200 ' + (expanded ? '' : '-rotate-90')}
          />
          <span className="truncate text-[13px] font-semibold text-text-primary">{summary}</span>
        </button>
        <IconButton label="Naikkan" disabled={!canMoveUp} onClick={onMoveUp}>
          <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
        </IconButton>
        <IconButton label="Turunkan" disabled={!canMoveDown} onClick={onMoveDown}>
          <ArrowDown size={16} strokeWidth={2} aria-hidden="true" />
        </IconButton>
        <IconButton label="Hapus" onClick={onDelete}>
          <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
        </IconButton>
      </div>
      {expanded && <div className="border-t border-border p-4">{children}</div>}
    </article>
  )
}
