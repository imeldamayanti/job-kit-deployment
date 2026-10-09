import { Logo } from '../../ui/primitives/Logo'
import { NAV_ITEMS, type PageId } from './pages'

export function Sidebar({
  current,
  onSelect,
  badges = {},
}: {
  current: PageId
  onSelect: (id: PageId) => void
  badges?: Partial<Record<PageId, number>>
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-surface px-3 py-5 md:w-[260px] md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-2 pb-5">
        <Logo />
        <span className="text-[14px] font-bold text-text-primary">job-kit</span>
      </div>
      <nav aria-label="Options" className="flex flex-row flex-wrap gap-1 md:flex-col">
        {NAV_ITEMS.map(({ id, title }) => (
          <button
            key={id}
            type="button"
            aria-current={id === current ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={
              'flex h-9 items-center justify-between gap-2 rounded-md px-3 text-left text-[14px] transition-colors duration-150 ' +
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring ' +
              (id === current
                ? 'bg-accent-wash font-semibold text-text-primary'
                : 'font-medium text-text-secondary hover:bg-neutral-100')
            }
          >
            {title}
            {(badges[id] ?? 0) > 0 && (
              <span
                aria-label={`${badges[id]} lowongan baru`}
                className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold leading-none text-amber-700"
              >
                {badges[id]}
              </span>
            )}
          </button>
        ))}
      </nav>
      <p className="mt-6 hidden rounded-lg bg-surface-sunken p-3 text-[12px] text-text-secondary md:mt-auto md:block">
        Data disimpan tanpa enkripsi di storage browser ini. Tidak ada server, tidak ada akun.
      </p>
    </aside>
  )
}
