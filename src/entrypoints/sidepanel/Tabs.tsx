export type TabId = 'autofill' | 'profile'

const TABS: { id: TabId; title: string }[] = [
  { id: 'autofill', title: 'Autofill' },
  { id: 'profile', title: 'Profile' },
]

export function Tabs({ current, onSelect }: { current: TabId; onSelect: (id: TabId) => void }) {
  return (
    <div role="tablist" aria-label="job-kit" className="flex gap-1 border-b border-border px-4">
      {TABS.map(({ id, title }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={id === current}
          aria-controls={`panel-${id}`}
          onClick={() => onSelect(id)}
          className={
            '-mb-px h-9 rounded-t-lg border border-b-0 px-4 text-[13px] font-semibold transition-colors duration-150 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
            (id === current
              ? 'border-border bg-surface-sunken text-text-primary'
              : 'border-transparent text-text-secondary hover:bg-neutral-100')
          }
        >
          {title}
        </button>
      ))}
    </div>
  )
}
