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

// Host permissions for job sources and the AI provider are optional and asked for one at a time
// (FR-32). `request` must start inside a click, before any await.
export function requestOrigins(origins: string[]): Promise<boolean> {
  return browser.permissions.request({ origins })
}

export function hasOrigins(origins: string[]): Promise<boolean> {
  return browser.permissions.contains({ origins })
}
