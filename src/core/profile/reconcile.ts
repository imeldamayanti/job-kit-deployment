import type { Profile } from './types'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// The Profile page keeps the profile it loaded and saves the whole of it on every edit. When another tab saved
// something in between (job preferences, say), a plain save would write the old copy over it. So a tab saves only
// what it changed: for each part of the profile, a part this tab left as it loaded it takes whatever is stored now,
// and a part this tab changed stays as this tab has it.
//   base   = the profile as this tab last loaded or saved it
//   mine   = the profile this tab wants to save
//   theirs = the profile that is stored right now
export function reconcileProfile(base: Profile, mine: Profile, theirs: Profile): Profile {
  const keys = new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)]) as Set<keyof Profile>
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const value = same(mine[key], base[key]) ? theirs[key] : mine[key]
    if (value !== undefined) result[key] = structuredClone(value)
  }
  return result as unknown as Profile
}
