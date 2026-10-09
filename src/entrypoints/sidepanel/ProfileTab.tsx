import { summarizeProfile, isProfileEmpty } from '../../core/profile/summary'
import type { Profile } from '../../core/profile/types'
import { openEditProfile } from '../../platform/navigation'
import { Button } from '../../ui/primitives/Button'
import { EmptyProfile } from './EmptyProfile'

export function ProfileTab({ profile }: { profile: Profile | null }) {
  if (!profile) return null
  if (isProfileEmpty(profile)) return <EmptyProfile />

  const { name, email, sections } = summarizeProfile(profile)
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl border border-border bg-surface p-3">
        <p className="text-[14px] font-bold text-text-primary">{name || 'Tanpa nama'}</p>
        {email && <p className="break-words text-text-secondary">{email}</p>}
      </section>
      <section className="rounded-xl border border-border bg-surface p-3">
        <ul className="flex flex-col gap-2">
          {sections.map((section) => (
            <li key={section.id} className="text-[13px] text-text-primary">
              {section.text}
            </li>
          ))}
        </ul>
      </section>
      <div>
        <Button onClick={() => void openEditProfile()}>Edit Profile</Button>
      </div>
    </div>
  )
}
