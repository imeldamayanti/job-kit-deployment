import { describe, expect, it } from 'vitest'
import { accessLevel, expiryWarning, featureMode, PACKAGE, type AccountStatus } from './access'

const status = (over: Partial<AccountStatus> = {}): AccountStatus => ({
  credits: 0, paid: false, trialGranted: false, expiresAt: null, checkedAt: '2026-11-19T00:00:00.000Z', ...over,
})

describe('accessLevel', () => {
  it('is preview without a session, whatever the cache says', () => {
    expect(accessLevel(false, null)).toBe('preview')
    expect(accessLevel(false, status({ paid: true, credits: 9 }))).toBe('preview')
  })

  it('is paid once an account has bought', () => {
    expect(accessLevel(true, status({ paid: true, credits: 0, trialGranted: true }))).toBe('paid')
  })

  it('is trial while unpaid credits remain', () => {
    expect(accessLevel(true, status({ credits: 2, trialGranted: true }))).toBe('trial')
  })

  it('is free once the trial is spent and nothing was bought', () => {
    expect(accessLevel(true, status({ credits: 0, trialGranted: true }))).toBe('free')
  })

  it('is free for a signed-in account whose status is not known yet', () => {
    expect(accessLevel(true, null)).toBe('free')
  })
})

describe('featureMode', () => {
  it('opens for every signed-in level', () => {
    expect(featureMode('paid', status({ paid: true }))).toBe('open')
    expect(featureMode('trial', status({ credits: 2, trialGranted: true }))).toBe('open')
    expect(featureMode('free', status({ trialGranted: true }))).toBe('open')
    expect(featureMode('free', status({ trialGranted: true, credits: 0 }))).toBe('open')
  })

  it('stays open for a signed-in free account with no trial granted and for an unknown status (AI follows credits only)', () => {
    expect(featureMode('free', status({ trialGranted: false }))).toBe('open')
    expect(featureMode('free', null)).toBe('open')
  })

  it('is locked only for preview (not signed in), whatever the cache says', () => {
    expect(featureMode('preview', null)).toBe('locked')
    expect(featureMode('preview', status({ paid: true, credits: 9, trialGranted: true }))).toBe('locked')
  })
})

describe('expiryWarning', () => {
  const now = new Date('2026-11-19T00:00:00.000Z')
  const days = (n: number, extraMs = 0) => new Date(now.getTime() + n * 86_400_000 + extraMs).toISOString()

  it('warns at exactly 30 days and not a moment before', () => {
    expect(expiryWarning(status({ credits: 5, expiresAt: days(30) }), now)).toBe(true)
    expect(expiryWarning(status({ credits: 5, expiresAt: days(30, 1) }), now)).toBe(false)
  })

  it('stays quiet with no credits, no date, or no status', () => {
    expect(expiryWarning(status({ credits: 0, expiresAt: days(3) }), now)).toBe(false)
    expect(expiryWarning(status({ credits: 5, expiresAt: null }), now)).toBe(false)
    expect(expiryWarning(null, now)).toBe(false)
  })

  it('keeps warning once the date has passed', () => {
    expect(expiryWarning(status({ credits: 5, expiresAt: days(-1) }), now)).toBe(true)
  })
})

describe('PACKAGE', () => {
  it('is the one package on sale', () => {
    expect(PACKAGE).toEqual({ id: 'basic', priceIdr: 10800, credits: 50 })
  })
})
