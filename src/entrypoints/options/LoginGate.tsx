import { Coins, Lock, LogIn, Mail, Timer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { ApiFailure } from '../../core/sync/api'
import { failureText } from '../../core/sync/messages'
import { finishLogin, startLogin } from '../../platform/sync'
import { Button } from '../../ui/primitives/Button'
import { Logo } from '../../ui/primitives/Logo'
import { TextField } from '../../ui/primitives/TextField'
import { AI_GATE_TEXT, type AiAvailability } from './useAccess'

// The sign-in gate (spec §5.5, mockup §10 "Masuk dengan email" and "Sesi habis"): an email, then the code sent to it. No password.
// Everything it does goes through `api`, so tests can stand in for the server.
export type LoginApi = {
  startLogin: (email: string) => Promise<{ ok: true } | { ok: false; reason: ApiFailure }>
  finishLogin: (email: string, code: string) => Promise<{ ok: true } | { ok: false; reason: ApiFailure }>
}
export const loginApi: LoginApi = { startLogin, finishLogin }

// `new`: first time here. `expired`: the session could not be refreshed any more; the data on this device is untouched.
export type LoginVariant = 'new' | 'expired'

const RESEND_SECONDS = 60
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const COPY = {
  new: { title: 'Masuk ke job-kit', lead: 'Masukkan emailmu. Kami kirim kode masuk, tanpa kata sandi.' },
  expired: { title: 'Masuk lagi ke job-kit', lead: 'Kami kirim kode masuk ke emailmu, tanpa kata sandi.' },
} as const

function Notice({ tone, icon, children }: { tone: 'info' | 'warn'; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={'flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px] ' + (tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-accent-wash text-text-primary')}>
      <span aria-hidden="true" className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

export function LoginGate({
  variant,
  onSignedIn,
  api = loginApi,
  layout = 'page',
}: {
  variant: LoginVariant
  // Called once the code is accepted. The page then reads the session and the balance (that is what makes the account).
  onSignedIn: () => void | Promise<void>
  api?: LoginApi
  layout?: 'page' | 'panel'
}) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [wrongCode, setWrongCode] = useState(false)
  const [wait, setWait] = useState(0)

  const counting = wait > 0
  useEffect(() => {
    if (!counting) return
    const tick = setInterval(() => setWait((left) => Math.max(0, left - 1)), 1000)
    return () => clearInterval(tick)
  }, [counting])

  const send = async () => {
    setBusy(true)
    setMessage(null)
    setWrongCode(false)
    try {
      const result = await api.startLogin(email.trim())
      if (!result.ok) return setMessage(failureText(result.reason))
      setStep('code')
      setWait(RESEND_SECONDS)
    } finally {
      setBusy(false)
    }
  }

  const enter = async () => {
    setBusy(true)
    setMessage(null)
    setWrongCode(false)
    try {
      const result = await api.finishLogin(email.trim(), code.trim())
      if (!result.ok) {
        if (result.reason === 'rejected') setWrongCode(true)
        else setMessage(failureText(result.reason))
        return
      }
      await onSignedIn()
    } finally {
      setBusy(false)
    }
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())
  const shell =
    layout === 'panel'
      ? 'flex min-h-full flex-1 flex-col gap-3 bg-surface p-4 pt-5'
      : 'mx-auto flex w-full max-w-[420px] flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-md'
  const copy = COPY[variant]

  return (
    <section aria-label={step === 'email' ? copy.title : 'Cek emailmu'} className={shell}>
      <div className="flex items-center gap-2">
        <Logo size={24} />
        <span className="text-[14px] font-bold text-text-primary">job-kit</span>
      </div>

      {step === 'email' ? (
        <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); if (validEmail && !busy) void send() }}>
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.01em] text-text-primary">{copy.title}</h2>
            <p className="mt-1 text-[13px] text-text-secondary">{copy.lead}</p>
          </div>
          {variant === 'expired' && (
            <Notice tone="warn" icon={<Timer size={16} strokeWidth={2} />}>
              <b>Sesi masukmu sudah habis.</b> Masuk lagi untuk memakai AI. Data dan profilmu tetap ada di browser ini.
            </Notice>
          )}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          {variant === 'new' && (
            <Notice tone="info" icon={<Coins size={16} strokeWidth={2} />}>
              Akun baru dapat <b>3 kredit gratis saat daftar</b> untuk mencoba CV, surat, dan skor AI.
            </Notice>
          )}
          {message && <p role="status" className="text-[13px] text-amber-700">{message}</p>}
          <Button className="w-full" disabled={busy || !validEmail} onClick={() => void send()}>
            <Mail size={16} strokeWidth={2} aria-hidden="true" />
            Kirim kode
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); if (code.trim() !== '' && !busy) void enter() }}>
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.01em] text-text-primary">Cek emailmu</h2>
            <p className="mt-1 text-[13px] text-text-secondary">Kode dikirim ke <b className="text-text-primary">{email.trim()}</b>.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <TextField
              label="Kode"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Masukkan kode"
              value={code}
              aria-invalid={wrongCode || undefined}
              aria-describedby={wrongCode ? 'login-code-error' : undefined}
              className={wrongCode ? 'border-rose-700' : ''}
              onChange={(event) => { setCode(event.target.value); setWrongCode(false) }}
            />
            {wrongCode && <p id="login-code-error" className="text-[12px] text-rose-700">Kodenya salah. Periksa lagi, atau minta kode baru.</p>}
          </div>
          {message && <p role="status" className="text-[13px] text-amber-700">{message}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button variant="secondary" className="h-8 px-3" disabled={busy || wait > 0} onClick={() => void send()}>
              {wait > 0 ? `Kirim ulang kode · ${clock(wait)}` : 'Kirim ulang kode'}
            </Button>
            <Button variant="secondary" className="h-8 px-3" onClick={() => { setStep('email'); setCode(''); setMessage(null); setWrongCode(false); setWait(0) }}>
              Ganti email
            </Button>
          </div>
          <Button className="w-full" disabled={busy || code.trim() === ''} onClick={() => void enter()}>Masuk</Button>
        </form>
      )}
    </section>
  )
}

// The banner above Lowongan and Lamaran (mockup §10): the preview says why nothing works, and when the balance is 0 only AI stops.
// Nothing for a balance still being read: that is not "locked" and not "Beli kredit".
export function AccessAlert({
  ai,
  trialEnded,
  onSignIn,
  onBuy,
}: {
  ai: AiAvailability
  // The free trial credits are used up and nothing was ever bought.
  trialEnded: boolean
  onSignIn: () => void
  onBuy: () => void
}) {
  if (ai === 'signed-out') {
    return (
      <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-wash px-4 py-3 text-[13px] text-text-primary">
        <p className="min-w-[15rem] flex-1">
          <b>Ini preview dengan data contoh.</b> Lowongan, Lamaran, CV, dan Surat baru bisa dipakai setelah kamu masuk.
        </p>
        <Button onClick={onSignIn}>
          <LogIn size={16} strokeWidth={2} aria-hidden="true" />
          Masuk untuk memakai
        </Button>
      </div>
    )
  }
  if (ai === 'no-credits') {
    return (
      <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent-wash px-4 py-3 text-[13px] text-text-primary">
        <p className="min-w-[15rem] flex-1">
          <b>{trialEnded ? 'Percobaan gratismu sudah habis.' : 'Kreditmu habis.'}</b> Lowongan dan Lamaran tetap terbuka dan bisa kamu edit; hanya Buat CV, Buat surat, dan Nilai dengan AI yang berhenti sampai kamu membeli kredit.
        </p>
        <Button onClick={onBuy}>Beli kredit</Button>
      </div>
    )
  }
  return null
}

// The reason right above an AI button that is off; the button points at it with aria-describedby.
export function GateNote({ id, ai }: { id: string; ai: AiAvailability }) {
  if (ai === 'ready') return null
  return (
    <p id={id} className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary">
      {ai === 'signed-out' ? <Lock size={13} strokeWidth={2} aria-hidden="true" /> : <Coins size={13} strokeWidth={2} aria-hidden="true" />}
      {AI_GATE_TEXT[ai]}
    </p>
  )
}
