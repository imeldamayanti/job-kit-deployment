import { useState } from 'react'
import { countNew } from '../../core/feed/schedule'
import type { SectionId } from '../../core/profile/sections'
import { useFeed } from '../../ui/hooks/useFeed'
import { useFeedSettings } from '../../ui/hooks/useFeedSettings'
import { useProfile } from '../../ui/hooks/useProfile'
import { Button } from '../../ui/primitives/Button'
import { ContactSection } from './ContactSection'
import { CustomSection } from './CustomSection'
import { DataPage } from './DataPage'
import { EducationSection } from './EducationSection'
import { ExperienceSection } from './ExperienceSection'
import { JobSettingsPage } from './JobSettingsPage'
import { JobsPage } from './JobsPage'
import { dataRoute, jobsRoute, profileRoute, routeFromHash, routeSubtitle, routeTitle, type PageId, type Route } from './pages'
import { PersonalSection } from './PersonalSection'
import { PreferencesSection } from './PreferencesSection'
import { ProfileTabs } from './ProfileTabs'
import { SaveIndicator } from './SaveIndicator'
import { Sidebar } from './Sidebar'
import { StorageFullNotice } from './StorageFullNotice'

export function App() {
  const { profile, update, commit, saveState } = useProfile()
  const feed = useFeedSettings()
  const live = useFeed()
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash))

  const go = (next: Route) => {
    setRoute(next)
    if (next.page === 'jobs' && !next.settings) live.markSeen()
  }
  const choose = (id: PageId) => go(id === 'profile' ? profileRoute(route.section) : id === 'jobs' ? jobsRoute() : dataRoute)
  const section = (id: SectionId) => route.section === id

  return (
    <div className="min-h-full bg-neutral-100 p-4 md:p-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1200px] flex-col overflow-hidden rounded-xl border border-border-strong bg-surface-sunken shadow-lg md:flex-row">
        <Sidebar current={route.page} onSelect={choose} badges={{ jobs: countNew(live.feed, live.state.seenAt) }} />
        <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
          <div className="mx-auto flex max-w-[880px] flex-col gap-6">
            {route.page === 'jobs' && route.settings && (
              <div className="-mb-3">
                <Button variant="secondary" onClick={() => go(jobsRoute())}>← Lowongan</Button>
              </div>
            )}
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-bold leading-tight text-text-primary">{routeTitle(route)}</h1>
                <p className="mt-1 text-[14px] text-text-secondary">{routeSubtitle(route)}</p>
              </div>
              {route.page !== 'jobs' && <SaveIndicator state={saveState} />}
              {route.page === 'jobs' && route.settings && <SaveIndicator state={feed.saveState} />}
            </header>
            {saveState === 'storage-full' && <StorageFullNotice />}

            {route.page === 'profile' && (
              <>
                <ProfileTabs current={route.section} onSelect={(id) => go(profileRoute(id))} />
                {profile && section('personal') && <PersonalSection profile={profile} update={update} />}
                {profile && section('contact') && <ContactSection profile={profile} update={update} />}
                {profile && section('education') && <EducationSection profile={profile} update={update} />}
                {profile && section('experience') && <ExperienceSection profile={profile} update={update} />}
                {profile && section('custom') && <CustomSection profile={profile} update={update} />}
                {profile && section('preferences') && <PreferencesSection profile={profile} update={update} />}
              </>
            )}
            {route.page === 'jobs' && !route.settings && (
              <JobsPage
                profile={profile}
                settings={feed.settings}
                live={live}
                onSettings={() => go(jobsRoute(true))}
                onPreferences={() => go(profileRoute('preferences'))}
              />
            )}
            {route.page === 'jobs' && route.settings && feed.settings && (
              <JobSettingsPage
                profile={profile}
                settings={feed.settings}
                aiKey={feed.key}
                update={feed.update}
                changeKey={feed.changeKey}
                goPreferences={() => go(profileRoute('preferences'))}
                runs={live.runs}
                state={live.state}
              />
            )}
            {route.page === 'data' && <DataPage profile={profile} commit={commit} />}
          </div>
        </main>
      </div>
    </div>
  )
}
