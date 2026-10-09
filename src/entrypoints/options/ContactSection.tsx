import { CONTACT_FIELDS } from '../../core/profile/fields'
import { setContactField } from '../../core/profile/profile'
import type { Profile } from '../../core/profile/types'
import { TextField } from '../../ui/primitives/TextField'
import { SectionCard } from './SectionCard'

export function ContactSection({ profile, update }: { profile: Profile; update: (next: Profile) => void }) {
  return (
    <SectionCard>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {CONTACT_FIELDS.map(({ key, label, placeholder, wide }) => (
          <div key={key} className={wide ? 'sm:col-span-2' : undefined}>
            <TextField
              label={label}
              placeholder={placeholder}
              value={profile.contact[key]}
              onChange={(event) => update(setContactField(profile, key, event.target.value))}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
