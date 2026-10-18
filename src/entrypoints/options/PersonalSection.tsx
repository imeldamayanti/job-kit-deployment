import { PERSONAL_FIELDS } from '../../core/profile/fields'
import { setPersonalField } from '../../core/profile/profile'
import type { Profile } from '../../core/profile/types'
import { TextArea } from '../../ui/primitives/TextArea'
import { TextField } from '../../ui/primitives/TextField'
import { SectionCard } from './SectionCard'

export function PersonalSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  return (
    <SectionCard>
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
        <div className="sm:col-span-2">
          <TextArea
            label="Ringkasan"
            placeholder="Satu atau dua kalimat tentang dirimu. Tampil di bawah nama pada CV."
            value={profile.summary ?? ''}
            onChange={(event) => update({ ...profile, summary: event.target.value })}
          />
        </div>
      </div>
    </SectionCard>
  )
}
