import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { createEmptyProfile, setPersonalField } from '../core/profile/profile'
import { loadProfile, saveProfile } from './storage'

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
