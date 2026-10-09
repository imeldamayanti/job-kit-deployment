import { PERSONAL_FIELDS } from '../../core/profile/fields'
import { setPersonalField } from '../../core/profile/profile'
import type { Profile } from '../../core/profile/types'
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
      </div>
    </SectionCard>
  )
}
