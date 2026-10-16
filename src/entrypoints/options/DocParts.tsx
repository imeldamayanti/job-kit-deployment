import { Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

// The two boxes that the CV and letter tabs share: a notice with an icon, and a titled card.
type Tone = 'warn' | 'info' | 'bad'
const TONES: Record<Tone, string> = { warn: 'bg-amber-50 text-text-primary', info: 'bg-accent-wash text-text-primary', bad: 'bg-rose-50 text-text-primary' }
const ICON_TONES: Record<Tone, string> = { warn: 'text-amber-700', info: 'text-accent', bad: 'text-rose-700' }

export function Alert({ tone, role, children }: { tone: Tone; role?: 'alert' | 'status' | 'note'; children: ReactNode }) {
  const Icon = tone === 'info' ? Info : TriangleAlert
  return (
    <div role={role} className={`flex flex-wrap items-start gap-x-2 gap-y-2 rounded-lg px-3 py-2.5 text-[13px] ${TONES[tone]}`}>
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" className={`mt-0.5 shrink-0 ${ICON_TONES[tone]}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-md">
      {title && <h2 className="text-[14px] font-bold text-text-primary">{title}</h2>}
      {children}
    </section>
  )
}
