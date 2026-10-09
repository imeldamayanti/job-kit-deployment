export type TabId = 'autofill' | 'profile'

const TABS: { id: TabId; title: string }[] = [
  { id: 'autofill', title: 'Autofill' },
  { id: 'profile', title: 'Profile' },
]

export function Tabs({ current, onSelect }: { current: TabId; onSelect: (id: TabId) => void }) {
  return (
    <div role="tablist" aria-label="job-kit" className="flex gap-1 bg-neutral-100 px-2 pt-2">
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
            'h-9 flex-1 rounded-t-lg text-[13px] transition-colors duration-150 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
            (id === current
              ? 'bg-surface font-bold text-text-primary shadow-[inset_0_-2px_0_var(--color-accent)]'
              : 'font-semibold text-text-secondary hover:bg-neutral-200')
          }
        >
          {title}
        </button>
      ))}
    </div>
  )
}
