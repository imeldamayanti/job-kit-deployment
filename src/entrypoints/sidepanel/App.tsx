import { useEffect, useMemo, useState } from 'react'
import { formIsLocked } from '../../core/fill/frames'
import { formatFillSummary } from '../../core/fill/summary'
import { buildPlan } from '../../core/matching/plan'
import { selectItems } from '../../core/matching/selection'
import { sectionForKey } from '../../core/profile/sections'
import { isProfileEmpty } from '../../core/profile/summary'
import { openEditProfile } from '../../platform/navigation'
import { requestSiteAccess } from '../../platform/permissions'
import { useStoredProfile } from '../../ui/hooks/useStoredProfile'
import { Mascot } from '../../ui/mascot/Mascot'
import { Button } from '../../ui/primitives/Button'
import { EmptyProfile } from './EmptyProfile'
import { PlanRow } from './PlanRow'
import { ProfileTab } from './ProfileTab'
import { Tabs, type TabId } from './Tabs'
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
  const [tab, setTab] = useState<TabId>('autofill')
  const profileEmpty = profile !== null && isProfileEmpty(profile)

  const scan = state.status === 'ready' ? state.scan : undefined
  const plan = useMemo(() => (scan?.ok && profile ? buildPlan(scan.fields, profile) : null), [scan, profile])
  const frameLocked = scan?.ok === true && plan !== null && formIsLocked(plan.matched, scan.lockedFrame)

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
    <div className="flex min-h-full flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-[17px] font-bold text-text-primary">job-kit</h1>
      </header>
      <Tabs current={tab} onSelect={setTab} />

      {tab === 'profile' && (
        <main id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" className="p-4">
          <ProfileTab profile={profile} />
        </main>
      )}

      {tab === 'autofill' && (
        <main id="panel-autofill" role="tabpanel" aria-labelledby="tab-autofill" className="flex flex-col gap-3 p-4 pb-24">
          {state.status === 'ready' && state.domain && (
            <p className="text-[12px] font-semibold text-text-secondary">{state.domain}</p>
          )}

          {plan && !frameLocked && profileEmpty && <EmptyProfile />}

          {plan && !frameLocked && !profileEmpty && (
            <>
              <p className="rounded-lg bg-accent-wash px-3 py-2 text-[13px] font-semibold text-text-primary">
                {plan.matched} dari {plan.total} field cocok
              </p>

              {phase === 'filled' && summary && (
                <section className="flex items-center gap-3 rounded-xl border border-border bg-green-50 p-3">
                  <Mascot state="success" size={48} />
                  <div>
                    <p className="text-[13px] font-bold text-green-700">{formatFillSummary(summary.filled, summary.skipped)}</p>
                    <p className="mt-1 text-text-secondary">Cek sekali lagi sebelum submit, ya.</p>
                  </div>
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

              {plan.missing.length > 0 && (
                <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
                  <h2 className="text-[12px] font-bold text-text-secondary">Profil belum punya</h2>
                  <ul className="flex flex-col gap-1">
                    {plan.missing.map((field) => (
                      <li key={field.fieldId} className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-text-primary">{field.label}</span>
                        <button
                          type="button"
                          onClick={() => void openEditProfile(sectionForKey(field.key))}
                          className={
                            'rounded-sm px-1 text-[13px] font-semibold text-accent hover:underline ' +
                            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring'
                          }
                        >
                          Isi →
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {state.status === 'ready' && !state.scan.ok && state.scan.reason === 'no-form' && (
            <section className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4">
              <Mascot state="neutral" />
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
            <section className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4">
              <Mascot state="error" />
              <h2 className="text-[13px] font-bold text-text-primary">Tidak bisa dibaca</h2>
              <p className="mt-1 text-text-secondary">
                {state.domain
                  ? 'Browser tidak mengizinkan ekstensi membaca halaman ini, misalnya PDF atau halaman yang dibatasi.'
                  : 'Ini halaman bawaan browser, dan browser tidak mengizinkan ekstensi membacanya.'}
              </p>
              <p className="mt-1 text-text-secondary">Buka halaman lamaran kerja di tab lain.</p>
            </section>
          )}

          {((state.status === 'ready' && !state.scan.ok && state.scan.reason === 'locked-frame') || frameLocked) && (
            <section className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4">
              <Mascot state="error" />
              <h2 className="text-[13px] font-bold text-text-primary">Tidak bisa dibaca</h2>
              <p className="mt-1 text-text-secondary">
                Form ada di dalam frame yang terkunci, jadi job-kit tidak bisa mengisinya.
              </p>
              <p className="mt-1 text-text-secondary">Kalau situs menyediakan tautan form lamaran langsung, buka tautan itu di tab baru.</p>
            </section>
          )}
        </main>
      )}

      {tab === 'autofill' && plan && !frameLocked && (
        <footer className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-border bg-surface p-3">
          {phase === 'preview' && profileEmpty && (
            <p className="text-[12px] text-text-secondary">Profil masih kosong — isi dulu</p>
          )}
          {phase === 'preview' ? (
            <Button className="w-full" disabled={profileEmpty || selected.length === 0} onClick={() => void fill()}>
              Fill
            </Button>
          ) : (
            <Button className="w-full" onClick={() => void undo()}>
              Undo
            </Button>
          )}
        </footer>
      )}
    </div>
  )
}
