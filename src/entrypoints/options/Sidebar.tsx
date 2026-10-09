import { SECTIONS, type SectionId } from './sections'

export function Sidebar({ current, onSelect }: { current: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <nav aria-label="Profile" className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-[12px] font-bold uppercase tracking-wide text-text-secondary">Profile</p>
      {SECTIONS.map(({ id, title }) => (
        <button
          key={id}
          type="button"
          aria-current={id === current ? 'page' : undefined}
          onClick={() => onSelect(id)}
          className={
            'h-9 rounded-md px-3 text-left text-[13px] font-semibold transition-colors duration-150 ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
            (id === current ? 'bg-accent-wash text-accent' : 'text-text-secondary hover:bg-neutral-100')
          }
        >
          {title}
        </button>
      ))}
    </nav>
  )
}
