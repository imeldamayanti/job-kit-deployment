import { formatFillSummary } from '../../core/fill/summary'
import { openEditProfile } from '../../platform/navigation'
import { requestSiteAccess } from '../../platform/permissions'
import { Button } from '../../ui/primitives/Button'
import { useFill } from './useFill'
import { useScan } from './useScan'

export function App() {
  const { state, rescan } = useScan()
  const { state: fillState, fill, undo } = useFill(
    state.status === 'ready' ? state.tab : undefined,
    state.status === 'ready' ? state.plan : null,
  )

  return (
    <main className="flex min-h-full flex-col gap-3 p-4 pb-20">
      <h1 className="text-[17px] font-bold text-text-primary">job-kit</h1>

      {state.status === 'ready' && state.domain && (
        <p className="text-[12px] font-semibold text-text-secondary">{state.domain}</p>
      )}

      {state.status === 'ready' && state.plan && (
        <>
          <p className="rounded-lg bg-accent-wash px-3 py-2 text-[13px] font-semibold text-text-primary">
            {state.plan.matched} dari {state.plan.total} field cocok
          </p>

          {fillState.phase === 'filled' && (
            <section className="rounded-xl border border-border bg-green-50 p-3">
              <p className="text-[13px] font-bold text-green-700">
                {formatFillSummary(fillState.filled, fillState.skipped)}
              </p>
              <p className="mt-1 text-text-secondary">Cek sekali lagi sebelum submit, ya.</p>
            </section>
          )}

          {state.plan.items.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <h2 className="text-[12px] font-bold text-text-secondary">Akan diisi</h2>
              <ul className="flex flex-col gap-2">
                {state.plan.items.map((item) => (
                  <li key={item.fieldId} className="flex flex-col">
                    <span className="text-[12px] text-text-secondary">{item.label}</span>
                    <span className="text-[13px] text-text-primary">{item.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.plan.skipped.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <h2 className="text-[12px] font-bold text-text-secondary">Dilewati</h2>
              <ul className="flex flex-col gap-1">
                {state.plan.skipped.map((field) => (
                  <li key={field.fieldId} className="text-[13px] text-text-secondary">
                    {field.label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {state.status === 'ready' && !state.scan.ok && state.scan.reason === 'no-form' && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[13px] font-bold text-text-primary">Tidak ada form di halaman ini</h2>
          <p className="mt-1 text-text-secondary">
            Buka halaman lamaran kerja, lalu panel ini akan mendeteksi field-nya sendiri.
          </p>
        </section>
      )}

      {state.status === 'ready' && !state.scan.ok && state.scan.reason === 'no-permission' && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[13px] font-bold text-text-primary">Butuh izin untuk situs ini</h2>
          <p className="mt-1 text-text-secondary">
            job-kit perlu izin untuk membaca field di {state.domain}.
          </p>
          <Button
            className="mt-3"
            onClick={() => {
              void requestSiteAccess(state.tab?.url).then((granted) => granted && rescan())
            }}
          >
            Beri izin untuk situs ini
          </Button>
        </section>
      )}

      {state.status === 'ready' && !state.scan.ok && state.scan.reason === 'unreachable-page' && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[13px] font-bold text-text-primary">Tidak bisa dibaca</h2>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-3">
        <Button onClick={() => void openEditProfile()}>Edit Profile</Button>
      </section>

      {state.status === 'ready' && state.plan && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-surface p-3">
          {fillState.phase === 'preview' ? (
            <Button className="w-full" disabled={state.plan.items.length === 0} onClick={() => void fill()}>
              Fill
            </Button>
          ) : (
            <Button className="w-full" onClick={() => void undo()}>
              Undo
            </Button>
          )}
        </footer>
      )}
    </main>
  )
}
