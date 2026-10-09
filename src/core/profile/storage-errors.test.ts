import { describe, expect, it } from 'vitest'
import { isQuotaError } from './storage-errors'

describe('isQuotaError', () => {
  it.each([
    'QUOTA_BYTES quota exceeded',
    'Resource::kQuotaBytes quota exceeded',
    'QUOTA_BYTES_PER_ITEM quota exceeded',
  ])('recognises %s', (message) => {
    expect(isQuotaError(new Error(message))).toBe(true)
  })

  it('does not treat other failures as quota', () => {
    expect(isQuotaError(new Error('Extension context invalidated'))).toBe(false)
    expect(isQuotaError('quota')).toBe(false)
    expect(isQuotaError(undefined)).toBe(false)
  })
})
