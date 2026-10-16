import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Mascot } from '../../ui/mascot/Mascot'

// An empty or no-result card (design-system "Empty state"): a mascot for states that need a face,
// or a round icon (the search icon by default) for a quiet "nothing here".
export function Empty({
  mascot,
  icon,
  title,
  body,
  children,
}: {
  mascot?: 'neutral' | 'error'
  icon?: boolean | ReactNode
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      {mascot && <Mascot state={mascot} size={88} />}
      {icon && (
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-text-secondary">
          {icon === true ? <SearchX size={18} strokeWidth={2} /> : icon}
        </span>
      )}
      <h2 className="mt-1 text-[16px] font-bold text-text-primary">{title}</h2>
      <p className="max-w-[46ch] text-[14px] text-text-secondary">{body}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  )
}
