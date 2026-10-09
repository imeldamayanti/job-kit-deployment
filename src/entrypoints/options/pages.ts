import { sectionFromHash, type SectionId } from '../../core/profile/sections'

// The sidebar has three places; the profile sections are tabs inside Profile (T28).
export type PageId = 'profile' | 'jobs' | 'data'
export type Route = { page: PageId; section: SectionId; settings: boolean }

export const NAV_ITEMS: readonly { id: PageId; title: string }[] = [
  { id: 'profile', title: 'Profile' },
  { id: 'jobs', title: 'Lowongan' },
  { id: 'data', title: 'Data' },
]

export const profileRoute = (section: SectionId): Route => ({ page: 'profile', section, settings: false })
export const jobsRoute = (settings = false): Route => ({ page: 'jobs', section: 'personal', settings })
export const dataRoute: Route = { page: 'data', section: 'personal', settings: false }

// Old links such as #contact keep working: they open Profile on that tab.
export function routeFromHash(hash: string): Route {
  const base = hash.replace(/^#/, '').split('?')[0]
  if (base === 'data') return dataRoute
  if (base === 'jobs') return jobsRoute()
  if (base === 'jobsettings') return jobsRoute(true)
  return profileRoute(sectionFromHash(hash))
}

export function routeTitle(route: Route): string {
  if (route.page === 'jobs') return route.settings ? 'Atur Lowongan' : 'Lowongan'
  return NAV_ITEMS.find((item) => item.id === route.page)?.title ?? ''
}

export function routeSubtitle(route: Route): string {
  if (route.page === 'jobs') return route.settings ? 'Sumber, jadwal, dan penilaian AI untuk lowongan harian.' : 'Lowongan yang cocok dengan profilmu, diambil tiap hari.'
  if (route.page === 'data') return 'Cadangkan profilmu, atau mulai dari awal.'
  return route.section === 'preferences'
    ? 'Dipakai untuk mencarikan dan menilai lowongan harian. Tidak dipakai saat mengisi form.'
    : 'Data yang dipakai untuk mengisi form lamaran. Tersimpan otomatis.'
}
