export function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={
        'h-10 shrink-0 rounded-lg border px-3 text-[13px] font-semibold transition-colors duration-150 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
        (selected
          ? 'border-accent bg-accent-wash text-accent'
          : 'border-border-strong bg-surface text-text-primary hover:bg-neutral-100')
      }
    >
      {children}
    </button>
  )
}
