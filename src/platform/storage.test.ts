import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { createEmptyProfile, setPersonalField } from '../core/profile/profile'
import { loadProfile, saveProfile, watchProfile } from './storage'

describe('profile storage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('returns an empty profile when nothing has been saved', async () => {
    expect(await loadProfile()).toEqual(createEmptyProfile())
  })

  it('returns what was saved, as after a page reload', async () => {
    const profile = setPersonalField(createEmptyProfile(), 'firstName', 'Imelda')

    await saveProfile(profile)

    expect((await loadProfile()).personal.firstName).toBe('Imelda')
  })
})

describe('watchProfile', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('tells the panel when the profile is edited elsewhere', async () => {
    const seen: string[] = []
    const stop = watchProfile((profile) => seen.push(profile.personal.firstName))

    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Imelda'))
    stop()

    expect(seen).toEqual(['Imelda'])
  })
})
