import { describe, expect, it } from 'vitest'
import { aiModeFrom, isShareBuild } from './build'

describe('isShareBuild', () => {
  it('is on only for the string "true"', () => {
    expect(isShareBuild('true')).toBe(true)
    expect(isShareBuild(undefined)).toBe(false)
    expect(isShareBuild('1')).toBe(false)
    expect(isShareBuild('')).toBe(false)
  })
})

describe('aiModeFrom', () => {
  it('turns AI off for the shared build, whatever the mode says', () => {
    expect(aiModeFrom(undefined, 'true')).toBe('off')
    expect(aiModeFrom('byok', 'true')).toBe('off')
    expect(aiModeFrom('server', 'true')).toBe('off')
  })

  it('uses the owner key only when the mode is exactly "byok"', () => {
    expect(aiModeFrom('byok', undefined)).toBe('byok')
    expect(aiModeFrom('byok', 'false')).toBe('byok')
    expect(aiModeFrom('BYOK', undefined)).toBe('server')
  })

  it('defaults to the server, for an unset or unknown mode', () => {
    expect(aiModeFrom(undefined, undefined)).toBe('server')
    expect(aiModeFrom('', '')).toBe('server')
    expect(aiModeFrom('server', undefined)).toBe('server')
    expect(aiModeFrom('whatever', '1')).toBe('server')
  })
})
