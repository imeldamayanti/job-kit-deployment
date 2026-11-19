import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { createDefaultSettings } from '../core/feed/settings'
import type { Job } from '../core/feed/types'
import { createEmptyProfile } from '../core/profile/profile'

vi.mock('./account', () => ({ callGenerate: vi.fn(), noteCredits: vi.fn(), loadAccountStatus: vi.fn() }))
vi.mock('./sync', () => ({ storedUserId: vi.fn(), currentSession: vi.fn() }))
vi.mock('./ai-client', () => ({ clientWithPermission: vi.fn() }))

import { callGenerate } from './account'
import { clientWithPermission } from './ai-client'
import { executeRun } from './feed-runner'
import { loadFeed, loadState, saveFeed, saveSettings } from './feed-storage'
import { saveProfile } from './storage'
import { storedUserId } from './sync'

const AT = new Date().toISOString()

const job = (id: string): Job => ({
  id, source: 'ashby', title: `Frontend ${id}`, company: 'PT Contoh', location: 'Remote', workplace: 'remote', contract: '', level: '', salary: '', experience: '',
  postedAt: AT.slice(0, 10), deadline: '', url: `https://x.test/${id}`, description: 'React', logoUrl: '', status: 'new', aiFilled: [], score: null, firstSeenAt: AT, lastSeenAt: AT,
})

beforeEach(async () => {
  fakeBrowser.reset()
  vi.mocked(callGenerate).mockReset()
  vi.mocked(clientWithPermission).mockReset()
  vi.mocked(storedUserId).mockReset()
  vi.mocked(storedUserId).mockResolvedValue('u1')
  const profile = createEmptyProfile()
  profile.jobPrefs.roles = ['Frontend']
  await saveProfile(profile)
  await saveSettings(createDefaultSettings())
  await saveFeed([job('1'), job('2')])
})

// The tests run as the server build, the default.
describe('executeRun in the server build', () => {
  it('scores the daily feed by rules and never asks the server or a provider', async () => {
    const handle = await executeRun({ auto: true })
    expect(handle.status).toBe('started')
    await handle.finished
    expect(callGenerate).not.toHaveBeenCalled()
    expect(clientWithPermission).not.toHaveBeenCalled()
    const feed = await loadFeed()
    expect(feed).toHaveLength(2)
    expect(feed.every((item) => item.score?.rough === true)).toBe(true)
    expect((await loadState()).aiProblem).toBeNull()
  })

  it('does not run when nobody is signed in', async () => {
    vi.mocked(storedUserId).mockResolvedValue(null)
    const handle = await executeRun({ auto: true })
    expect(handle.status).toBe('signed-out')
    await handle.finished
    expect((await loadFeed()).every((item) => item.score === null)).toBe(true)
    expect((await loadState()).running).toBe(false)
  })
})
