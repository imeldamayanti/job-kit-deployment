import { Check, Coins, RefreshCw, Timer, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatRupiah, PACKAGE, type AccountStatus } from '../../core/account/access'
import { formatCountdown, nextState, POLL_MS, QR_VALID_MINUTES, remainingMs, STATUS_TIMEOUT_MS, type FlowState } from '../../core/account/purchase-flow'
import type { CreatePaymentResponse } from '../../core/generate/protocol'
import { createPayment, purchaseStatus, refreshAccountStatus, type PurchaseStatus } from '../../platform/account'
import { Button } from '../../ui/primitives/Button'
import { formatExpiry } from './Sidebar'

// The one request for a code in flight, shared by every opening of the modal: closing and opening it again while the first
// request still runs must not ask the server for a second one.
let inFlight: Promise<CreatePaymentResponse> | null = null
function requestPayment(): Promise<CreatePaymentResponse> {
  if (!inFlight) {
    inFlight = createPayment().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

// One status call, given up after `ms`. A call that fails or hangs is just a round with no answer: the next round goes on.
function withTimeout(work: Promise<PurchaseStatus>, ms: number): Promise<PurchaseStatus | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    const done = (value: PurchaseStatus | null) => {
      clearTimeout(timer)
      resolve(value)
    }
    work.then(done, () => done(null))
  })
}

const NOTE = 'Catatan: kredit tidak bisa diuangkan, dan hangus 1 tahun sejak pembelian terakhir.'
const TITLE = 'Beli kredit AI'
const hint = 'text-[12px] text-text-secondary'
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function Package() {
  return (
    <div>
      <div className="text-[28px] font-bold leading-[1.1] tracking-tight tabular-nums text-text-primary">{formatRupiah(PACKAGE.priceIdr)}</div>
      <div className="mt-1 text-[13px] font-semibold text-text-primary">{`${PACKAGE.credits} kredit ≈ ${PACKAGE.credits / 2} CV + ${PACKAGE.credits / 2} surat`}</div>
      <div className="mt-0.5 text-[12px] font-semibold text-green-700">Sudah termasuk semua biaya</div>
    </div>
  )
}

// The box where the QR sits. `over` is what stands in for it while there is no code to show.
function QrBox({ children, dashed = false }: { children: React.ReactNode; dashed?: boolean }) {
  return (
    <div
      className={
        'relative grid h-[200px] w-[200px] max-w-full place-items-center self-center rounded-lg border p-3 text-text-primary ' +
        (dashed ? 'border-dashed border-border-strong bg-neutral-50 text-text-secondary' : 'border-border-strong bg-surface')
      }
    >
      {children}
    </div>
  )
}

const Over = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-[13px] font-semibold">
    <span aria-hidden="true">{icon}</span>
    {children}
  </div>
)

// Buying credits with a QRIS code (mockup §10 S12). The modal opens a code at once (the server returns the pending one when there
// is one, so opening it again shows the same QR) and checks the payment every few seconds while it is open. Closing it never cancels
// the purchase: the credits arrive whenever the payment does. `onPaid` runs once the payment is seen, after the balance was read again.
export function BuyCreditsModal({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) {
  const [flow, setFlow] = useState<FlowState>({ step: 'creating' })
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [balance, setBalance] = useState<AccountStatus | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const alive = useRef(false)
  const asking = useRef(false)
  const paidSeen = useRef(false)
  const onCloseRef = useRef(onClose)
  const onPaidRef = useRef(onPaid)
  onCloseRef.current = onClose
  onPaidRef.current = onPaid

  const makeCode = useCallback(async () => {
    if (asking.current) return
    asking.current = true
    setBusy(true)
    const res = await requestPayment()
    asking.current = false
    if (!alive.current) return
    setBusy(false)
    setNow(new Date())
    setFlow((state) => nextState(state, { type: 'created', res }))
  }, [])

  // The dialog contract: focus goes in when it opens and returns to whatever opened it when it closes.
  useEffect(() => {
    alive.current = true
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    void makeCode()
    return () => {
      alive.current = false
      asking.current = false
      if (opener?.isConnected) opener.focus()
    }
  }, [makeCode])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // A step change can remove the button that had focus (Coba lagi, Buat kode baru); focus then goes back to the dialog, never to the page behind.
  useEffect(() => {
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus()
  }, [flow.step])

  const waitingFor = flow.step === 'waiting' ? flow.purchaseId : null

  // While a code waits: the clock ticks every second (this is what ends it at expiresAt) and the status is asked every POLL_MS.
  useEffect(() => {
    if (waitingFor === null) return
    const tick = setInterval(() => {
      const current = new Date()
      setNow(current)
      setFlow((state) => nextState(state, { type: 'tick', now: current }))
    }, 1000)
    let stopped = false
    let next: ReturnType<typeof setTimeout> | undefined
    const round = async () => {
      const status = await withTimeout(purchaseStatus(waitingFor), STATUS_TIMEOUT_MS)
      if (stopped) return
      if (status !== null) setFlow((state) => nextState(state, { type: 'polled', status }))
      next = setTimeout(() => void round(), POLL_MS)
    }
    void round()
    return () => {
      stopped = true
      clearInterval(tick)
      clearTimeout(next)
    }
  }, [waitingFor])

  // Paid: read the balance again (this updates the cache the sidebar reads) and tell the page, even if the modal was closed meanwhile.
  useEffect(() => {
    if (flow.step !== 'paid' || paidSeen.current) return
    paidSeen.current = true
    void refreshAccountStatus().then((status) => {
      if (alive.current) setBalance(status)
      onPaidRef.current()
    })
  }, [flow.step])

  const trapTab = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const renewButton = (label: string) => (
    <Button disabled={busy} onClick={() => void makeCode()}>
      <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
      {label}
    </Button>
  )

  const left = flow.step === 'waiting' ? remainingMs(flow.expiresAt, now) : 0
  const minutesLeft = Math.floor(left / 60_000)
  const [failTitle, ...failRest] = (flow.step === 'error' ? flow.message : '').split('. ')

  let body: React.ReactNode
  let foot: React.ReactNode = <Button variant="secondary" onClick={onClose}>Tutup</Button>
  if (flow.step === 'paid') {
    body = (
      <>
        <div className="flex flex-col items-center gap-1.5 py-1 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-700" aria-hidden="true">
            <Check size={20} strokeWidth={2} />
          </span>
          <h4 className="mt-1 text-[15px] font-semibold text-text-primary">Pembayaran diterima</h4>
          <p className="text-text-secondary">{`${flow.credits} kredit sudah masuk. Kamu bisa memakai AI lagi.`}</p>
        </div>
        {balance && (
          <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken p-3 text-[12px] text-text-secondary">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
              <Coins size={13} strokeWidth={2} aria-hidden="true" />
              Saldo sekarang
            </span>
            <span className="flex items-baseline gap-1.5 text-[22px] font-bold leading-tight text-text-primary">
              {balance.credits}
              <small className="text-[12px] font-medium text-text-secondary">{`kredit · +${flow.credits}`}</small>
            </span>
            {balance.expiresAt && <span>{`Hangus ${formatExpiry(balance.expiresAt)}`}</span>}
          </div>
        )}
      </>
    )
    foot = <Button onClick={onClose}>Selesai</Button>
  } else {
    body = (
      <>
        <Package />
        {flow.step === 'creating' && (
          <QrBox dashed>
            <div role="status" className="contents">
              <Over icon={<RefreshCw size={24} strokeWidth={2} />}>Membuat kode QR…</Over>
            </div>
          </QrBox>
        )}
        {flow.step === 'waiting' && (
          <>
            <QrBox>
              <img src={flow.qrUrl} alt="Kode QR untuk pembayaran QRIS" referrerPolicy="no-referrer" className="block h-full w-full" />
            </QrBox>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-text-secondary">
                <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-text-primary">
                  <Timer size={14} strokeWidth={2} aria-hidden="true" />
                  {`Berlaku ${formatCountdown(left)}`}
                </span>
                <span role="status" className="inline-flex items-center gap-1.5">
                  <i aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  Menunggu pembayaran…
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Sisa waktu kode QR"
                aria-valuemin={0}
                aria-valuemax={QR_VALID_MINUTES}
                aria-valuenow={Math.min(QR_VALID_MINUTES, minutesLeft)}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"
              >
                <i className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (left / (QR_VALID_MINUTES * 60_000)) * 100)}%` }} />
              </div>
            </div>
            <p className={hint}>Buka e-wallet atau m-banking, pilih bayar dengan QR, lalu scan kode ini. Menutup jendela tidak membatalkan pembelian; kredit masuk begitu pembayaran diterima.</p>
          </>
        )}
        {flow.step === 'expired' && (
          <>
            <QrBox dashed>
              <Over icon={<Timer size={24} strokeWidth={2} />}>Kode kedaluwarsa</Over>
            </QrBox>
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-700">
              <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                <b>Kode QR sudah kedaluwarsa.</b> Kalau kamu sudah membayar, kredit tetap masuk. Kalau belum, buat kode baru.
              </span>
            </div>
          </>
        )}
        {flow.step === 'error' && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              <b>{`${failTitle}.`}</b> {failRest.join('. ')}
            </span>
          </div>
        )}
        {flow.step !== 'expired' && <p className={hint}>{NOTE}</p>}
      </>
    )
    if (flow.step === 'expired' || flow.step === 'error') {
      foot = (
        <>
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
          {renewButton(flow.step === 'expired' ? 'Buat kode baru' : 'Coba lagi')}
        </>
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--color-text-primary)_45%,transparent)] p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={TITLE}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="flex w-full max-w-[380px] min-w-0 flex-col rounded-xl border border-border bg-surface text-[13px] shadow-lg outline-none"
      >
        <div className="flex items-center justify-between gap-2 pt-3.5 pr-3 pl-4">
          <h4 className="text-[15px] font-semibold tracking-tight text-text-primary">{TITLE}</h4>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-3 px-4 pt-2.5 pb-4">{body}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{foot}</div>
      </div>
    </div>
  )
}
