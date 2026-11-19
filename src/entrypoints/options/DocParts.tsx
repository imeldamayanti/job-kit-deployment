import { Check, Coins, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

// The two boxes that the CV and letter tabs share: a notice with an icon, and a titled card.
type Tone = 'warn' | 'info' | 'bad' | 'ok'
const TONES: Record<Tone, string> = { warn: 'bg-amber-50 text-text-primary', info: 'bg-accent-wash text-text-primary', bad: 'bg-rose-50 text-text-primary', ok: 'bg-green-50 text-text-primary' }
const ICON_TONES: Record<Tone, string> = { warn: 'text-amber-700', info: 'text-accent', bad: 'text-rose-700', ok: 'text-green-700' }
const ICONS = { info: Info, ok: Check, warn: TriangleAlert, bad: TriangleAlert } as const

// `coins` swaps the icon for the credit one, as the mockup does for "Kredit tidak cukup".
export function Alert({ tone, role, coins = false, children }: { tone: Tone; role?: 'alert' | 'status' | 'note'; coins?: boolean; children: ReactNode }) {
  const Icon = coins ? Coins : ICONS[tone]
  return (
    <div role={role} className={`flex flex-wrap items-start gap-x-2 gap-y-2 rounded-lg px-3 py-2.5 text-[13px] ${TONES[tone]}`}>
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" className={`mt-0.5 shrink-0 ${ICON_TONES[tone]}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// The server build charges credits (spec §5.1): the buttons name their cost before they are pressed, and the balance is
// shown where it is spent (mockup §10, S8). Absent in the other builds, where nothing is charged and nothing is shown.
export type CreditCost = { balance: number | null; onBuy: () => void }

export const withCost = (label: string, credit?: CreditCost): string => (credit ? `${label} · 1 kredit` : label)

export function Balance({ credit }: { credit?: CreditCost }) {
  if (!credit || credit.balance === null) return null
  return <span className="text-[13px] text-text-secondary">Saldo {credit.balance} kredit</span>
}

// "Kredit tidak cukup" with what it means for this button (mockup S8, "Saldo kurang"). `what` is "Buat CV" or "Buat surat".
export function NoCreditsAlert({ message, what }: { message: string; what: string }) {
  return (
    <Alert tone="warn" role="status" coins>
      <p>
        <b>{message}</b>
      </p>
      <p>{what} butuh 1 kredit; saldomu 0.</p>
    </Alert>
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
