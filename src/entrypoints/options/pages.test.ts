import { describe, expect, it } from 'vitest'
import { applicationRoute, applicationsRoute, dataRoute, jobsRoute, NAV_ITEMS, profileRoute, routeFromHash, routeSubtitle, routeTitle } from './pages'

describe('routeFromHash', () => {
  it('opens Profile on the tab an old link names', () => {
    expect(routeFromHash('#contact')).toEqual(profileRoute('contact'))
    expect(routeFromHash('#preferences')).toEqual(profileRoute('preferences'))
  })

  it('falls back to the first tab of Profile', () => {
    expect(routeFromHash('')).toEqual(profileRoute('personal'))
    expect(routeFromHash('#nope')).toEqual(profileRoute('personal'))
  })

  it('knows the other pages, with or without a preview query', () => {
    expect(routeFromHash('#data')).toEqual(dataRoute)
    expect(routeFromHash('#data?state=list')).toEqual(dataRoute)
    expect(routeFromHash('#jobs')).toEqual(jobsRoute())
    expect(routeFromHash('#jobs?state=empty')).toEqual(jobsRoute())
    expect(routeFromHash('#jobsettings')).toEqual(jobsRoute(true))
  })
})

describe('Lamaran routes', () => {
  it('sits between Lowongan and Data in the sidebar', () => {
    expect(NAV_ITEMS.map((item) => item.title)).toEqual(['Profile', 'Lowongan', 'Lamaran', 'Data'])
  })

  it('opens the board, with or without a preview query', () => {
    expect(routeFromHash('#applications')).toEqual(applicationsRoute())
    expect(routeFromHash('#applications?state=empty')).toEqual(applicationsRoute())
  })

  it('opens one application from its id', () => {
    expect(routeFromHash('#applications/abc-123')).toEqual(applicationRoute('abc-123'))
    expect(applicationRoute('abc-123')).toMatchObject({ page: 'applications', applicationId: 'abc-123' })
    expect(applicationsRoute().applicationId).toBeNull()
  })

  it('titles the page Lamaran', () => {
    expect(routeTitle(applicationsRoute())).toBe('Lamaran')
    expect(routeSubtitle(applicationsRoute())).toBe('Semua lowongan yang kamu lamar, dari draf sampai hasil akhir.')
  })
})

describe('titles', () => {
  it('names each page, and the settings view of Lowongan', () => {
    expect(routeTitle(profileRoute('education'))).toBe('Profile')
    expect(routeTitle(jobsRoute())).toBe('Lowongan')
    expect(routeTitle(jobsRoute(true))).toBe('Atur Lowongan')
    expect(routeTitle(dataRoute)).toBe('Data')
  })

  it('says Preferensi kerja is not used by Fill', () => {
    expect(routeSubtitle(profileRoute('preferences'))).toContain('Tidak dipakai saat mengisi form')
  })
})
