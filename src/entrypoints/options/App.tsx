import { useState } from 'react'
import { useFeedSettings } from '../../ui/hooks/useFeedSettings'
import { useProfile } from '../../ui/hooks/useProfile'
import { ContactSection } from './ContactSection'
import { CustomSection } from './CustomSection'
import { DataPage } from './DataPage'
import { EducationSection } from './EducationSection'
import { ExperienceSection } from './ExperienceSection'
import { JobSettingsPage } from './JobSettingsPage'
import { JobsPage } from './JobsPage'
import { PAGE_SUBTITLES, pageFromHash, pageTitle, type PageId } from './pages'
import { PersonalSection } from './PersonalSection'
import { PreferencesSection } from './PreferencesSection'
import { SaveIndicator } from './SaveIndicator'
import { Sidebar } from './Sidebar'
import { StorageFullNotice } from './StorageFullNotice'

export function App() {
  const { profile, update, commit, saveState } = useProfile()
  const feed = useFeedSettings()
  const [page, setPage] = useState<PageId>(() => pageFromHash(location.hash))

  return (
    <div className="min-h-full bg-neutral-100 p-4 md:p-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1200px] flex-col overflow-hidden rounded-xl border border-border-strong bg-surface-sunken shadow-lg md:flex-row">
        <Sidebar current={page} onSelect={setPage} />
        <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
          <div className="mx-auto flex max-w-[880px] flex-col gap-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-bold leading-tight text-text-primary">{pageTitle(page)}</h1>
                <p className="mt-1 text-[14px] text-text-secondary">{PAGE_SUBTITLES[page]}</p>
              </div>
              <SaveIndicator state={saveState} />
            </header>
            {saveState === 'storage-full' && <StorageFullNotice />}
            {page === 'jobs' && <JobsPage />}
            {page === 'jobsettings' && feed.settings && (
              <JobSettingsPage profile={profile} settings={feed.settings} aiKey={feed.key} update={feed.update} changeKey={feed.changeKey} go={setPage} />
            )}
            {page === 'data' && <DataPage profile={profile} commit={commit} />}
            {profile && page === 'personal' && <PersonalSection profile={profile} update={update} />}
            {profile && page === 'contact' && <ContactSection profile={profile} update={update} />}
            {profile && page === 'education' && <EducationSection profile={profile} update={update} />}
            {profile && page === 'experience' && <ExperienceSection profile={profile} update={update} />}
            {profile && page === 'custom' && <CustomSection profile={profile} update={update} />}
            {profile && page === 'preferences' && <PreferencesSection profile={profile} update={update} />}
          </div>
        </main>
      </div>
    </div>
  )
}
