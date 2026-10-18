import { useState } from 'react'
import { countNew } from '../../core/feed/schedule'
import type { SectionId } from '../../core/profile/sections'
import { addManualApplication, changeApplicationStatus, patchApplication, removeApplication } from '../../platform/applications'
import { openApplication } from '../../platform/open-job'
import { useApplications } from '../../ui/hooks/useApplications'
import { useCv } from '../../ui/hooks/useCv'
import { useLetter } from '../../ui/hooks/useLetter'
import { useFeed } from '../../ui/hooks/useFeed'
import { useFeedSettings } from '../../ui/hooks/useFeedSettings'
import { useProfile } from '../../ui/hooks/useProfile'
import { Button } from '../../ui/primitives/Button'
import { ContactSection } from './ContactSection'
import { CustomSection } from './CustomSection'
import { ApplicationDetailPage } from './ApplicationDetailPage'
import { ApplicationsPage } from './ApplicationsPage'
import { Empty } from './EmptyState'
import { AccountPage } from './AccountPage'
import { accountApi } from '../../platform/sync-api'
import { DataPage } from './DataPage'
import { EducationSection } from './EducationSection'
import { ExperienceSection } from './ExperienceSection'
import { JobSettingsPage } from './JobSettingsPage'
import { JobsPage } from './JobsPage'
import { accountRoute, applicationRoute, applicationsRoute, dataRoute, jobsRoute, profileRoute, routeFromHash, routeSubtitle, routeTitle, type PageId, type Route } from './pages'
import { ProjectsSection } from './ProjectsSection'
import { PersonalSection } from './PersonalSection'
import { PreferencesSection } from './PreferencesSection'
import { ProfileTabs } from './ProfileTabs'
import { SaveIndicator } from './SaveIndicator'
import { Sidebar } from './Sidebar'
import { StorageFullNotice } from './StorageFullNotice'
import { ViewToggle, type ApplicationsViewId } from './ViewToggle'
import { dueCount, todayKey } from '../../core/applications/followup'
import { previewApplicationsFromHash } from '../../core/applications/preview'
import { useToday } from '../../ui/hooks/useToday'
import { cvViewFor } from '../../core/tailor/view'
import { letterViewFor } from '../../core/letters/view'

// The CV tab in a dev preview shows a fixed state; its buttons do nothing.
const NO_LETTER_ACTIONS = { onCreate: () => {}, onContinue: () => {}, onDismissNotice: () => {}, onLink: () => {}, onEdit: () => {}, onRestore: () => {}, onCopy: () => {}, onLang: () => {}, onTone: () => {} }
const NO_CV_ACTIONS = { onCreate: () => {}, onContinue: () => {}, onDismissNotice: () => {}, onLink: () => {}, onEdit: () => {}, onRestore: () => {}, onDownload: () => {}, onDownloadWord: () => {}, onCopyText: () => {} }

export function App() {
  const { profile, update, commit, saveState } = useProfile()
  const feed = useFeedSettings()
  const live = useFeed()
  const { applications, ready: applicationsReady } = useApplications()
  const liveToday = useToday()
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash))
  const [applicationsView, setApplicationsView] = useState<ApplicationsViewId>(
    () => (import.meta.env.DEV ? previewApplicationsFromHash(location.hash)?.view : undefined) ?? 'board',
  )

  const go = (next: Route) => {
    setRoute(next)
    if (next.page === 'jobs' && !next.settings) live.markSeen()
  }
  const choose = (id: PageId) =>
    go(id === 'profile' ? profileRoute(route.section) : id === 'jobs' ? jobsRoute() : id === 'applications' ? applicationsRoute() : id === 'account' ? accountRoute : dataRoute)
  const section = (id: SectionId) => route.section === id
  const preview = import.meta.env.DEV ? previewApplicationsFromHash(location.hash) : undefined
  const today = preview?.now ? todayKey(new Date(preview.now)) : liveToday
  const detailId = route.page === 'applications' ? (route.applicationId ?? preview?.detail?.id ?? null) : null
  const detailApp = detailId ? (preview?.applications ?? applications).find((app) => app.id === detailId) : undefined
  const backToBoard = () => go(applicationsRoute())
  const cvTab = useCv(preview ? undefined : detailApp, (link) => go(link === 'settings' ? jobsRoute(true) : profileRoute('experience')), `${route.page}/${route.applicationId ?? ''}/${route.settings ? 's' : ''}`)

  const letterTab = useLetter(preview ? undefined : detailApp, (link) => go(link === 'settings' ? jobsRoute(true) : profileRoute('experience')), `${route.page}/${route.applicationId ?? ''}/${route.settings ? 's' : ''}`)

  return (
    <div className="min-h-full bg-neutral-100 p-4 md:h-screen md:p-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1200px] flex-col overflow-hidden rounded-xl md:h-full md:min-h-0 border border-border-strong bg-surface-sunken shadow-lg md:flex-row">
        <Sidebar current={route.page} onSelect={choose} badges={{ jobs: countNew(live.feed, live.state.seenAt), applications: dueCount(preview?.applications ?? applications, today) }} />
        <main
          className={
            'min-w-0 flex-1 px-5 md:overflow-y-auto md:px-10 ' +
            (route.page === 'jobs' ? '' : 'md:[mask-image:linear-gradient(to_bottom,transparent,black_28px)]')
          }
        >
          <div className="mx-auto flex max-w-[880px] flex-col gap-6 py-8">
            {!detailId && route.page === 'jobs' && route.settings && (
              <div className="-mb-3">
                <Button variant="secondary" onClick={() => go(jobsRoute())}>← Lowongan</Button>
              </div>
            )}
            {!detailId && (
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="min-w-[14rem] flex-1">
                <h1 className="text-[28px] font-bold leading-tight text-text-primary">{routeTitle(route)}</h1>
                <p className="mt-1 text-[14px] text-text-secondary">{routeSubtitle(route)}</p>
              </div>
              {route.page === 'applications' && <ViewToggle view={applicationsView} onChange={setApplicationsView} />}
              {route.page !== 'jobs' && route.page !== 'applications' && <SaveIndicator state={saveState} />}
              {route.page === 'jobs' && route.settings && <SaveIndicator state={feed.saveState} />}
            </header>
            )}
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
                {profile && section('projects') && <ProjectsSection profile={profile} update={update} />}
              </>
            )}
            {route.page === 'jobs' && !route.settings && (
              <JobsPage
                profile={profile}
                settings={feed.settings}
                live={live}
                applications={applications}
                onOpenApplication={(id) => go(applicationRoute(id))}
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
            {detailId && detailApp && (
              <ApplicationDetailPage
                key={detailApp.id}
                application={detailApp}
                initialTab={preview?.detail?.tab}
                onBack={backToBoard}
                onStatus={(status) => !preview && void changeApplicationStatus(detailApp.id, status)}
                onSave={(draft) => (preview ? Promise.resolve({ ok: true as const }) : patchApplication(detailApp.id, draft))}
                onDelete={async () => {
                  if (preview) return
                  await removeApplication(detailApp.id)
                  backToBoard()
                }}
                onOpenForm={() => !preview && void openApplication(detailApp)}
                cvTab={preview ? (preview.cv ? { ...cvViewFor(preview.cv), ...NO_CV_ACTIONS } : undefined) : cvTab}
                letterTab={preview ? (preview.letter ? { ...letterViewFor(preview.letter), ...NO_LETTER_ACTIONS } : undefined) : letterTab}
              />
            )}
            {detailId && !detailApp && applicationsReady && (
              <Empty icon title="Lamaran tidak ditemukan" body="Lamaran ini sudah dihapus, atau berkas Import menggantinya.">
                <Button variant="secondary" onClick={backToBoard}>Ke Lamaran</Button>
              </Empty>
            )}
            {route.page === 'applications' && !detailId && (
              <ApplicationsPage
                applications={applications}
                view={applicationsView}
                today={today}
                onOpen={(id) => go(applicationRoute(id))}
                onJobs={() => go(jobsRoute())}
                onMove={(id, status) => !preview && void changeApplicationStatus(id, status)}
                onAdd={async (input) => {
                  if (preview) return { ok: true as const, id: '' }
                  const result = await addManualApplication(input)
                  return result.ok ? { ok: true as const, id: result.app.id } : result
                }}
              />
            )}
            {route.page === 'data' && <DataPage profile={profile} commit={commit} />}
            {route.page === 'account' && <AccountPage api={accountApi} onExport={() => go(dataRoute)} />}
          </div>
        </main>
      </div>
    </div>
  )
}
