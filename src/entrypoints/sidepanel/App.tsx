import { openEditProfile } from '../../platform/navigation'
import { Button } from '../../ui/primitives/Button'
import { useScan } from './useScan'

export function App() {
  const state = useScan()

  return (
    <main className="flex min-h-full flex-col gap-3 p-4">
      <h1 className="text-[17px] font-bold text-text-primary">job-kit</h1>

      {state.status === 'ready' && state.domain && (
        <p className="text-[12px] font-semibold text-text-secondary">{state.domain}</p>
      )}

      {state.status === 'ready' && state.scan.ok && (
        <ul className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          {state.scan.fields.map((field) => (
            <li key={field.id} className="text-[13px] text-text-primary">
              {field.label}
            </li>
          ))}
        </ul>
      )}

      {state.status === 'ready' && !state.scan.ok && state.scan.reason === 'no-form' && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[13px] font-bold text-text-primary">Tidak ada form di halaman ini</h2>
          <p className="mt-1 text-text-secondary">
            Buka halaman lamaran kerja, lalu panel ini akan mendeteksi field-nya sendiri.
          </p>
        </section>
      )}

      {state.status === 'ready' && !state.scan.ok && state.scan.reason !== 'no-form' && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[13px] font-bold text-text-primary">Tidak bisa dibaca</h2>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-3">
        <Button onClick={() => void openEditProfile()}>Edit Profile</Button>
      </section>
    </main>
  )
}
