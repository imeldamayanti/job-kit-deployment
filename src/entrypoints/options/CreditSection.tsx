import { Coins } from 'lucide-react'
import { useEffect, useState } from 'react'
import { expiryWarning, formatRupiah, PACKAGE, type AccountStatus } from '../../core/account/access'
import { describeEntry } from '../../core/account/ledger'
import type { LedgerEntry } from '../../platform/account'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { formatExpiry } from './Sidebar'

export type CreditsProps = {
  status: AccountStatus | null
  now: Date
  onBuy: () => void
  loadLedger: (limit: number) => Promise<LedgerEntry[]>
}

const LEDGER_LIMIT = 20
const DAY_MS = 86_400_000
const card = 'flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-md'

// The balance, when it lapses, and the history of the last 20 changes (mockup §10 S13). Nothing here changes the balance.
export function CreditSection({ status, now, onBuy, loadLedger }: CreditsProps) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null)
  const credits = status?.credits ?? null

  // The history is read again whenever the balance moves (a purchase, a generate), so the new line shows without a reload.
  useEffect(() => {
    let current = true
    void loadLedger(LEDGER_LIMIT).then((rows) => current && setEntries(rows))
    return () => {
      current = false
    }
  }, [loadLedger, credits])

  const warn = expiryWarning(status, now)
  const expires = status?.expiresAt ? formatExpiry(status.expiresAt) : ''
  const daysLeft = status?.expiresAt ? Math.ceil((Date.parse(status.expiresAt) - now.getTime()) / DAY_MS) : 0

  return (
    <>
      <section className={card}>
        <h2 className="text-[15px] font-bold text-text-primary">Saldo kredit</h2>
        {status === null ? (
          <p role="status" className="text-[13px] text-text-secondary">Memeriksa saldo…</p>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken px-5 py-4 text-[12px] text-text-secondary">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
              <Coins size={13} strokeWidth={2} aria-hidden="true" />
              Kredit AI
            </span>
            <span className="flex items-baseline gap-1.5 text-text-primary">
              <span className="text-[32px] font-bold leading-tight">{status.credits}</span>
              <small className="text-[12px] font-medium text-text-secondary">kredit</small>
            </span>
            {expires !== '' && (
              <span className="flex flex-wrap items-center gap-2">
                {`Hangus pada ${expires}, 1 tahun sejak pembelian terakhir`}
                {warn && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold leading-none text-amber-700">
                    {daysLeft > 0 ? `${daysLeft} hari lagi` : 'Sudah lewat'}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        <div>
          <Button variant={status !== null && status.credits > 0 && !warn ? 'secondary' : 'primary'} onClick={onBuy}>
            <Coins size={16} strokeWidth={2} aria-hidden="true" />
            Beli kredit
          </Button>
        </div>
        <p className="text-[12px] text-text-secondary">
          {`Paket ${PACKAGE.credits} kredit, ${formatRupiah(PACKAGE.priceIdr)}, sudah termasuk semua biaya. 1 CV = 1 kredit, 1 surat = 1 kredit, nilai 10 lowongan = 1 kredit. Kredit tidak bisa diuangkan.`}
        </p>
      </section>

      <section className={card}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold text-text-primary">Riwayat kredit</h2>
          <span className="text-[12px] text-text-secondary">{`${LEDGER_LIMIT} catatan terakhir`}</span>
        </div>
        {entries !== null && entries.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-3 pt-5 pb-3 text-center">
            <Mascot state="neutral" size={72} />
            <h3 className="mt-1 text-[14px] font-bold text-text-primary">Belum ada pemakaian kredit</h3>
            <p className="text-[13px] text-text-secondary">Pembelian dan pemakaian kredit muncul di sini.</p>
          </div>
        )}
        {entries !== null && entries.length > 0 && (
          <ul aria-label="Riwayat kredit" className="flex flex-col">
            {entries.map((entry, index) => {
              const line = describeEntry(entry)
              return (
                <li key={`${entry.at}-${index}`} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-border py-2.5 text-[13px] first:pt-0 last:border-b-0 last:pb-0">
                  <span className="text-[12px] whitespace-nowrap tabular-nums text-text-secondary">{formatExpiry(entry.at)}</span>
                  <span className="flex min-w-0 flex-col">
                    <b className="truncate font-semibold text-text-primary">{line.title}</b>
                    {line.detail !== '' && <em className="truncate text-[12px] not-italic text-text-secondary">{line.detail}</em>}
                  </span>
                  <span className={'font-bold whitespace-nowrap tabular-nums ' + (line.gain ? 'text-green-700' : 'text-text-primary')}>{line.amount}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
