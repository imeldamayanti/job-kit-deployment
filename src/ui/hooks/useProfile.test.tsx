import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProfile } from '../../core/profile/profile'
import type { Profile } from '../../core/profile/types'
import { useProfile } from './useProfile'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// An in-memory stand-in for chrome.storage: what is stored, and who is told when it changes.
const store = vi.hoisted(() => ({ stored: null as unknown as Profile, watchers: new Set<(profile: Profile) => void>() }))
vi.mock('../../platform/storage', () => ({
  loadProfile: async () => structuredClone(store.stored),
  saveProfile: async (profile: Profile) => {
    store.stored = structuredClone(profile)
    return { ok: true as const }
  },
  watchProfile: (onChange: (profile: Profile) => void) => {
    store.watchers.add(onChange)
    return () => void store.watchers.delete(onChange)
  },
}))

type Hook = ReturnType<typeof useProfile>
let container: HTMLElement | null = null
const hook: { current: Hook | null } = { current: null }

function Harness() {
  hook.current = useProfile()
  return null
}

const withRoles = (profile: Profile, roles: string[]): Profile => ({ ...profile, jobPrefs: { ...profile.jobPrefs, roles } })
const wait = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))))

async function open() {
  container = document.createElement('div')
  document.body.append(container)
  await act(async () => createRoot(container!).render(<Harness />))
  await wait(0)
}

beforeEach(() => {
  store.stored = createEmptyProfile()
  store.watchers.clear()
  hook.current = null
})

afterEach(() => {
  container?.remove()
})

describe('useProfile: a tab does not write an old copy over what another tab saved', () => {
  it('follows a change saved elsewhere, so the page shows the current job preferences', async () => {
    await open()
    expect(hook.current?.profile?.jobPrefs.roles).toEqual([])

    store.stored = withRoles(store.stored, ['Frontend Engineer'])
    await act(async () => store.watchers.forEach((notify) => notify(structuredClone(store.stored))))

    expect(hook.current?.profile?.jobPrefs.roles).toEqual(['Frontend Engineer'])
  })

  it('saves only what this tab edited: job preferences saved elsewhere survive an edit made here', async () => {
    await open()
    // Another tab saves the preferences and this tab never hears of it (the change event is missed or late).
    store.stored = withRoles(store.stored, ['Frontend Engineer', 'AI Engineer'])

    const profile = hook.current!.profile!
    await act(async () => hook.current!.update({ ...profile, personal: { ...profile.personal, firstName: 'Imelda' } }))
    await wait(500)

    expect(store.stored.personal.firstName).toBe('Imelda')
    expect(store.stored.jobPrefs.roles).toEqual(['Frontend Engineer', 'AI Engineer'])
  })

  it('still saves a change to the job preferences made here', async () => {
    await open()
    const profile = hook.current!.profile!
    await act(async () => hook.current!.update(withRoles(profile, ['Data Engineer'])))
    await wait(500)
    expect(store.stored.jobPrefs.roles).toEqual(['Data Engineer'])
  })
})
