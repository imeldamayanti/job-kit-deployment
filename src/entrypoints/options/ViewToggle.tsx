import { ChartColumn, Columns3 } from 'lucide-react'

export type ApplicationsViewId = 'board' | 'viz'

const OPTIONS: { id: ApplicationsViewId; title: string; icon: typeof Columns3 }[] = [
  { id: 'board', title: 'Papan', icon: Columns3 },
  { id: 'viz', title: 'Visualisasi', icon: ChartColumn },
]

// Two ways to look at the same applications, not two pages (design-system §4.4). Blue is allowed
// here because the buttons can be pressed.
export function ViewToggle({ view, onChange }: { view: ApplicationsViewId; onChange: (view: ApplicationsViewId) => void }) {
  return (
    <div role="group" aria-label="Tampilan" className="inline-flex rounded-full border border-border bg-neutral-100 p-0.5">
      {OPTIONS.map(({ id, title, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => onChange(id)}
          className={
            'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
            (view === id ? 'bg-accent-wash text-accent' : 'text-text-secondary hover:text-text-primary')
          }
        >
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {title}
        </button>
      ))}
    </div>
  )
}
