import { sectionFromHash, type SectionId } from '../../core/profile/sections'

// The sidebar has four places; the profile sections are tabs inside Profile (T28). Lamaran has a
// board and, behind it, the detail of one application (a sub-page, not a place in the sidebar).
export type PageId = 'profile' | 'jobs' | 'applications' | 'data' | 'account'
export type Route = { page: PageId; section: SectionId; settings: boolean; applicationId: string | null }

export const NAV_ITEMS: readonly { id: PageId; title: string }[] = [
  { id: 'profile', title: 'Profile' },
  { id: 'jobs', title: 'Lowongan' },
  { id: 'applications', title: 'Lamaran' },
  { id: 'data', title: 'Data' },
  { id: 'account', title: 'Akun' },
]

const route = (page: PageId, extra: Partial<Route> = {}): Route => ({ page, section: 'personal', settings: false, applicationId: null, ...extra })

export const profileRoute = (section: SectionId): Route => route('profile', { section })
export const jobsRoute = (settings = false): Route => route('jobs', { settings })
export const applicationsRoute = (): Route => route('applications')
export const applicationRoute = (applicationId: string): Route => route('applications', { applicationId })
export const dataRoute: Route = route('data')
export const accountRoute: Route = route('account')

// Old links such as #contact keep working: they open Profile on that tab.
export function routeFromHash(hash: string): Route {
  const base = hash.replace(/^#/, '').split('?')[0] ?? ''
  if (base === 'data') return dataRoute
  if (base === 'account') return accountRoute
  if (base === 'jobs') return jobsRoute()
  if (base === 'jobsettings') return jobsRoute(true)
  if (base === 'applications') return applicationsRoute()
  if (base.startsWith('applications/')) return applicationRoute(base.slice('applications/'.length))
  return profileRoute(sectionFromHash(hash))
}

export function routeTitle(current: Route): string {
  if (current.page === 'jobs') return current.settings ? 'Atur Lowongan' : 'Lowongan'
  return NAV_ITEMS.find((item) => item.id === current.page)?.title ?? ''
}

export function routeSubtitle(current: Route): string {
  if (current.page === 'jobs') return current.settings ? 'Sumber, jadwal, dan penilaian AI untuk lowongan harian.' : 'Lowongan yang cocok dengan profilmu, diambil tiap hari.'
  if (current.page === 'applications') return 'Semua lowongan yang kamu lamar, dari draf sampai hasil akhir.'
  if (current.page === 'data') return 'Cadangkan profilmu, atau mulai dari awal.'
  if (current.page === 'account') return 'Simpan dan sinkronkan datamu antar perangkat. Opsional.'
  return current.section === 'preferences'
    ? 'Dipakai untuk mencarikan dan menilai lowongan harian. Tidak dipakai saat mengisi form.'
    : 'Data yang dipakai untuk mengisi form lamaran. Tersimpan otomatis.'
}
