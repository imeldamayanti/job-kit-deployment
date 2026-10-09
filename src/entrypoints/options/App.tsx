import { useState } from 'react'
import { useProfile } from '../../ui/hooks/useProfile'
import { ContactSection } from './ContactSection'
import { CustomSection } from './CustomSection'
import { EducationSection } from './EducationSection'
import { ExperienceSection } from './ExperienceSection'
import { PersonalSection } from './PersonalSection'
import { SaveIndicator } from './SaveIndicator'
import { Sidebar } from './Sidebar'
import type { SectionId } from './sections'

export function App() {
  const { profile, update, saveState } = useProfile()
  const [section, setSection] = useState<SectionId>('personal')

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-bold text-text-primary">Edit Profile</h1>
        <SaveIndicator state={saveState} />
      </header>
      {profile && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <Sidebar current={section} onSelect={setSection} />
          {section === 'personal' && <PersonalSection profile={profile} update={update} />}
          {section === 'contact' && <ContactSection profile={profile} update={update} />}
          {section === 'education' && <EducationSection profile={profile} update={update} />}
          {section === 'experience' && <ExperienceSection profile={profile} update={update} />}
          {section === 'custom' && <CustomSection profile={profile} update={update} />}
        </div>
      )}
    </main>
  )
}
