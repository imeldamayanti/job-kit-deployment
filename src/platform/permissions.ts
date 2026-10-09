import { browser } from 'wxt/browser'
import { originPatternOf } from '../core/fill/page-access'

// Must be called from a user gesture (a click), or Chrome rejects the request.
export async function requestSiteAccess(url: string | undefined): Promise<boolean> {
  const origin = originPatternOf(url)
  if (!origin) return false
  return browser.permissions.request({ origins: [origin] })
}

export async function hasSiteAccess(url: string | undefined): Promise<boolean> {
  const origin = originPatternOf(url)
  if (!origin) return false
  return browser.permissions.contains({ origins: [origin] })
}
