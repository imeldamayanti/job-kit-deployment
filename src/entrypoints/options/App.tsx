import { Check } from 'lucide-react'
import { PERSONAL_FIELDS } from '../../core/profile/fields'
import { setPersonalField } from '../../core/profile/profile'
import { TextField } from '../../ui/primitives/TextField'
import { useProfile } from '../../ui/hooks/useProfile'

export function App() {
  const { profile, update, saveState } = useProfile()

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-[28px] font-bold text-text-primary">Edit Profile</h1>
      {profile && (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold text-text-primary">Personal Info</h2>
            <p
              aria-live="polite"
              className="inline-flex h-6 min-w-24 items-center justify-end gap-1 text-[12px] font-semibold text-green-700"
            >
              {saveState === 'saved' && (
                <>
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                  Tersimpan
                </>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {PERSONAL_FIELDS.map(({ key, label, placeholder }) => (
              <TextField
                key={key}
                label={label}
                placeholder={placeholder}
                value={profile.personal[key]}
                onChange={(event) => update(setPersonalField(profile, key, event.target.value))}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
