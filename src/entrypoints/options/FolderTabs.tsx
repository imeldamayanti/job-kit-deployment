// Folder tabs (T28): the active tab is marked by a 3px accent line under its label.
export function FolderTabs<T extends string>({
  label,
  tabs,
  current,
  onSelect,
}: {
  label: string
  tabs: readonly { id: T; title: string; count?: number }[]
  current: T
  onSelect: (id: T) => void
}) {
  return (
    <div role="tablist" aria-label={label} className="flex overflow-x-auto rounded-xl border border-border bg-neutral-100 [scrollbar-width:none]">
      {tabs.map(({ id, title, count }) => {
        const active = id === current
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={
              'shrink-0 whitespace-nowrap px-5 pt-3 text-[14px] transition-colors duration-200 ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-focus-ring ' +
              (active ? 'rounded-t-lg bg-surface font-semibold text-text-primary' : 'font-medium text-text-secondary hover:text-text-primary')
            }
          >
            <span className="block">
              {title}
              {count !== undefined && <span className="ml-1.5 text-[12px] font-semibold tabular-nums text-text-secondary">{count}</span>}
            </span>
            <span aria-hidden="true" className={'mt-2.5 block h-[3px] rounded-sm ' + (active ? 'bg-accent' : 'bg-transparent')} />
          </button>
        )
      })}
    </div>
  )
}
