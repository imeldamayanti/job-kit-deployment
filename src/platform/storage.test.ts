import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('says storage is full when the browser refuses the write, and keeps the old data', async () => {
    await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Imelda'))
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))

    const outcome = await saveProfile(setPersonalField(createEmptyProfile(), 'firstName', 'Baru'))

    expect(outcome).toEqual({ ok: false, reason: 'storage-full' })
    expect((await loadProfile()).personal.firstName).toBe('Imelda')
  })

  it('does not hide other errors as storage-full', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('something else broke'))

    await expect(saveProfile(createEmptyProfile())).rejects.toThrow('something else broke')
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
