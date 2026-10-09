import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../../ui/primitives/IconButton'

type EntryCardProps = {
  title: string
  subtitle: string
  period: string
  expanded: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  children: ReactNode
}

function initialOf(text: string): string {
  return text.trim().charAt(0).toUpperCase() || '?'
}

export function EntryCard({
  title,
  subtitle,
  period,
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
    <article className="rounded-xl border border-border bg-surface shadow-md">
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={
            'flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-neutral-100 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring'
          }
        >
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className={'shrink-0 text-text-secondary transition-transform duration-200 ' + (expanded ? '' : '-rotate-90')}
          />
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-wash text-[12px] font-bold text-accent"
          >
            {initialOf(title)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-semibold text-text-primary">{title}</span>
            {subtitle && <span className="truncate text-[12px] text-text-secondary">{subtitle}</span>}
          </span>
          {period && <span className="hidden shrink-0 text-[12px] text-text-secondary sm:inline">{period}</span>}
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
      {expanded && <div className="border-t border-border p-5">{children}</div>}
    </article>
  )
}
