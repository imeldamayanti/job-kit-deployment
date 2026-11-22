import { Globe, Info, LogIn } from 'lucide-react'
import { Button } from '../../ui/primitives/Button'
import { Logo } from '../../ui/primitives/Logo'
import { LoginGate, type LoginApi, type LoginVariant } from '../options/LoginGate'

// The sign-in gate in the side panel (mockup §10: the same card, in the panel's own width and chrome).
export function PanelLoginGate({ variant, onSignedIn, api }: { variant: LoginVariant; onSignedIn: () => void | Promise<void>; api?: LoginApi }) {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <LoginGate variant={variant} onSignedIn={onSignedIn} api={api} layout="panel" />
    </div>
  )
}

// Sample fields of the preview (mockup §10 "Preview sebelum masuk · Panel"). All example values.
const SAMPLE_FIELDS = [
  { label: 'Full name', value: 'Nama Contoh' },
  { label: 'Email address', value: 'nama@example.test' },
  { label: 'Phone', value: '+62 813-0000-0000' },
] as const

// What the panel shows before sign-in: a form with sample data, and the one way forward in the footer instead of Fill.
export function PanelPreview({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="flex items-center gap-2 px-4 py-3">
        <Logo size={24} />
        <h1 className="text-[17px] font-bold text-text-primary">job-kit</h1>
      </header>
      <main className="flex flex-col gap-5 p-4 pb-24">
        <div role="note" className="flex items-start gap-2.5 rounded-lg bg-accent-wash px-3 py-2.5 text-[13px] text-text-primary">
          <Info size={16} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            <b>Ini preview dengan data contoh.</b> Isi form otomatis baru jalan setelah kamu masuk.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-text-secondary">
            <Globe size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] text-text-secondary">contoh-karir.example</p>
            <p className="truncate text-[13px] font-bold text-text-primary">Application — iOS Developer, PT Contoh Karya</p>
          </div>
        </div>
        <ul className="flex flex-col gap-4">
          {SAMPLE_FIELDS.map(({ label, value }) => (
            <li key={label} className="flex items-center gap-3 opacity-70">
              <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded border border-border-strong bg-neutral-100" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[12px] text-text-secondary">{label}</span>
                <span className="truncate text-[13px] text-text-primary">{value}</span>
              </span>
              <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-text-secondary">Contoh</span>
            </li>
          ))}
        </ul>
      </main>
      <footer className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-border bg-surface p-3">
        <Button className="w-full" onClick={onSignIn}>
          <LogIn size={16} strokeWidth={2} aria-hidden="true" />
          Masuk untuk memakai
        </Button>
      </footer>
    </div>
  )
}
