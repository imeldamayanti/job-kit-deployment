import { describe, expect, it } from 'vitest'
import { isShareBuild } from './build'

describe('isShareBuild', () => {
  it('is on only for the string "true"', () => {
    expect(isShareBuild('true')).toBe(true)
    expect(isShareBuild(undefined)).toBe(false)
    expect(isShareBuild('1')).toBe(false)
    expect(isShareBuild('')).toBe(false)
  })
})
