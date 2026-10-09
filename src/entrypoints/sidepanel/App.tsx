import { useEffect, useMemo, useState } from 'react'
import { formatFillSummary } from '../../core/fill/summary'
import { buildPlan } from '../../core/matching/plan'
import { selectItems } from '../../core/matching/selection'
import { openEditProfile } from '../../platform/navigation'
import { requestSiteAccess } from '../../platform/permissions'
import { useStoredProfile } from '../../ui/hooks/useStoredProfile'
import { Button } from '../../ui/primitives/Button'
import { PlanRow } from './PlanRow'
import { useFill } from './useFill'
import { useScan } from './useScan'

function toggled(set: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

export function App() {
  const { state, rescan } = useScan()
  const profile = useStoredProfile()
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(new Set())
  const [overwrite, setOverwrite] = useState<ReadonlySet<string>>(new Set())

  const scan = state.status === 'ready' ? state.scan : undefined
  const plan = useMemo(
    () => (scan?.ok && profile ? buildPlan(scan.fields, profile) : null),
    [scan, profile],
  )

  useEffect(() => {
    setDisabled(new Set())
    setOverwrite(new Set())
  }, [scan])

  const selected = useMemo(() => (plan ? selectItems(plan.items, { disabled, overwrite }) : []), [plan, disabled, overwrite])
  const { phase, summary, undoLost, fill, undo } = useFill({
    tab: state.status === 'ready' ? state.tab : undefined,
    canUndo: scan?.ok === true && scan.canUndo,
    items: selected,
    total: plan?.total ?? 0,
    rescan,
  })

  return (
    <main className="flex min-h-full flex-col gap-3 p-4 pb-20">
      <h1 className="text-[17px] font-bold text-text-primary">job-kit</h1>

      {state.status === 'ready' && state.domain && (
        <p className="text-[12px] font-semibold text-text-secondary">{state.domain}</p>
      )}

      {plan && (
        <>
          <p className="rounded-lg bg-accent-wash px-3 py-2 text-[13px] font-semibold text-text-primary">
            {plan.matched} dari {plan.total} field cocok
          </p>

          {phase === 'filled' && summary && (
            <section className="rounded-xl border border-border bg-green-50 p-3">
              <p className="text-[13px] font-bold text-green-700">{formatFillSummary(summary.filled, summary.skipped)}</p>
              <p className="mt-1 text-text-secondary">Cek sekali lagi sebelum submit, ya.</p>
            </section>
          )}

          {undoLost && (
            <section className="rounded-xl border border-border bg-amber-50 p-3">
              <p className="text-[13px] font-semibold text-amber-700">
                Nilai awal sudah tidak tersimpan, jadi Undo tidak tersedia.
              </p>
            </section>
          )}

          {plan.items.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
              <div>
                <h2 className="text-[12px] font-bold text-text-secondary">Akan diisi</h2>
                {phase === 'preview' && <p className="text-[12px] text-text-secondary">Matikan yang tidak perlu</p>}
              </div>
              <ul className="flex flex-col gap-3">
                {plan.items.map((item) => (
                  <li key={item.fieldId}>
                    {phase === 'preview' ? (
                      <PlanRow
                        item={item}
                        enabled={!disabled.has(item.fieldId)}
                        overwrite={overwrite.has(item.fieldId)}
                        onToggle={() => setDisabled((current) => toggled(current, item.fieldId, !current.has(item.fieldId)))}
                        onOverwrite={(on) => setOverwrite((current) => toggled(current, item.fieldId, on))}
                      />
                    ) : (
                      <span className="flex flex-col">
                        <span className="text-[12px] text-text-secondary">{item.label}</span>
                        <span className="break-words text-[13px] text-text-primary">{item.value}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.skipped.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <h2 className="text-[12px] font-bold text-text-secondary">Dilewati</h2>
              <ul className="flex flex-col gap-1">
                {plan.skipped.map((field) => (
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
          <p className="mt-1 text-text-secondary">job-kit perlu izin untuk membaca field di {state.domain}.</p>
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

      {plan && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-surface p-3">
          {phase === 'preview' ? (
            <Button className="w-full" disabled={selected.length === 0} onClick={() => void fill()}>
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
