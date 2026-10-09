import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { openEditProfile } from './navigation'

describe('openEditProfile', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('opens the options page in a new tab', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create')

    await openEditProfile()

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      url: expect.stringMatching(/\/options\.html$/),
    })
  })
})
