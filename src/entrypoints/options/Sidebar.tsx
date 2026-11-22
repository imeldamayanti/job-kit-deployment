import { Coins, Lock, LogIn } from 'lucide-react'
import { expiryWarning, type AccountStatus } from '../../core/account/access'
import { Button } from '../../ui/primitives/Button'
import { Logo } from '../../ui/primitives/Logo'
import { NAV_ITEMS, type PageId } from './pages'
import type { AiAvailability } from './useAccess'

// What a badge counts, spoken for screen readers. Lamaran counts follow-ups that are due, not applications.
const BADGE_LABEL: Partial<Record<PageId, (count: number) => string>> = {
  jobs: (count) => `${count} lowongan baru`,
  applications: (count) => `${count} perlu tindak lanjut`,
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const

// "18 Des 2026": the day the balance lapses, in the person's own time zone.
export function formatExpiry(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

// The balance block under the places (mockup §10 "Sidebar Options"). Nothing here locks a place: only the AI stops when the balance is 0.
export function SidebarAccount({
  ai,
  status,
  now,
  onSignIn,
  onBuy,
}: {
  ai: AiAvailability
  status: AccountStatus | null
  now: Date
  onSignIn: () => void
  onBuy: () => void
}) {
  const box = 'mt-6 flex flex-col gap-2.5 rounded-lg bg-surface-sunken p-3 text-[12px] text-text-secondary md:mt-auto'
  const label = (icon: React.ReactNode, text: string) => (
    <span className="flex items-center gap-1.5 font-semibold">
      <span aria-hidden="true">{icon}</span>
      {text}
    </span>
  )

  if (ai === 'signed-out') {
    return (
      <div className={box}>
        <div className="flex flex-col gap-1">
          {label(<Lock size={13} strokeWidth={2} />, 'Belum masuk')}
          <span>Kamu sedang melihat preview dengan data contoh.</span>
        </div>
        <Button variant="secondary" className="h-8 w-full" onClick={onSignIn}>
          <LogIn size={14} strokeWidth={2} aria-hidden="true" />
          Masuk
        </Button>
      </div>
    )
  }

  // Signed in, balance not read yet (no cache, no answer): nothing to buy and nothing locked, just not known.
  if (ai === 'checking' || status === null) {
    return (
      <div className={box}>
        <div className="flex flex-col gap-1">
          {label(<Coins size={13} strokeWidth={2} />, 'Saldo')}
          <span role="status">Memeriksa saldo…</span>
        </div>
      </div>
    )
  }

  const out = status.credits <= 0
  const warn = expiryWarning(status, now)
  const date = status.expiresAt ? formatExpiry(status.expiresAt) : ''
  const note = out
    ? `${status.trialGranted && !status.paid ? 'Percobaanmu habis' : 'Kreditmu habis'}. Hanya AI yang berhenti; halaman dan datamu tetap terbuka.`
    : !status.paid
      ? 'Percobaan gratis. Habis, hanya AI yang berhenti.'
      : warn || date === ''
        ? ''
        : `Hangus ${date}`
  return (
    <div className={box}>
      <div className="flex flex-col gap-1">
        {label(<Coins size={13} strokeWidth={2} />, 'Saldo')}
        <span className="text-text-primary">
          <span className="text-[22px] font-bold leading-none">{status.credits}</span> <small className="text-[12px] text-text-secondary">kredit</small>
        </span>
        {note && <span>{note}</span>}
      </div>
      {warn && date !== '' && (
        <div role="note" className="rounded-md bg-amber-50 px-2.5 py-2 text-amber-700">
          <b>Kreditmu hangus pada {date}.</b> Beli paket memperpanjang 1 tahun.
        </div>
      )}
      <Button variant={out || warn ? 'primary' : 'secondary'} className="h-8 w-full" onClick={onBuy}>Beli kredit</Button>
    </div>
  )
}

export function Sidebar({
  current,
  onSelect,
  badges = {},
  account,
  hidden = [],
}: {
  current: PageId
  onSelect: (id: PageId) => void
  badges?: Partial<Record<PageId, number>>
  // The balance block (SidebarAccount); absent in builds without accounts.
  account?: React.ReactNode
  // Places not shown (Akun in the preview: nothing to sync before signing in).
  hidden?: readonly PageId[]
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-surface px-3 py-5 md:w-[260px] md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-2 pb-5">
        <Logo />
        <span className="text-[14px] font-bold text-text-primary">job-kit</span>
      </div>
      <nav aria-label="Options" className="flex flex-row flex-wrap gap-1 md:flex-col">
        {NAV_ITEMS.filter(({ id }) => !hidden.includes(id)).map(({ id, title }) => (
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
                aria-label={BADGE_LABEL[id]?.(badges[id] ?? 0)}
                className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold leading-none text-amber-700"
              >
                {badges[id]}
              </span>
            )}
          </button>
        ))}
      </nav>
      {account}
      <p className={'mt-3 hidden rounded-lg bg-surface-sunken p-3 text-[12px] text-text-secondary md:block ' + (account ? '' : 'md:mt-auto')}>
        Data disimpan tanpa enkripsi di storage browser ini. Sinkron ke server opsional dan ada di Akun.
      </p>
    </aside>
  )
}
