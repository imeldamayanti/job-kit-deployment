import { describe, expect, it } from 'vitest'
import { aiErrorMessage, mapAiFailure } from './errors'

describe('mapAiFailure', () => {
  it('maps a refused key to invalid-key', () => {
    expect(mapAiFailure(401, '')).toBe('invalid-key')
    expect(mapAiFailure(403, '')).toBe('invalid-key')
  })

  it('maps rate and credit problems to quota', () => {
    expect(mapAiFailure(429, '')).toBe('quota')
    expect(mapAiFailure(400, '{"error":{"message":"Your credit balance is too low"}}')).toBe('quota')
  })

  it('maps server trouble to server and anything else to bad-request', () => {
    expect(mapAiFailure(500, '')).toBe('server')
    expect(mapAiFailure(529, '')).toBe('server')
    expect(mapAiFailure(400, '{"error":{"message":"max_tokens"}}')).toBe('bad-request')
  })
})

describe('aiErrorMessage', () => {
  it('has a specific sentence for every reason', () => {
    expect(aiErrorMessage('invalid-key')).toBe('Kunci ditolak penyedia.')
    for (const reason of ['quota', 'network', 'server', 'bad-request', 'no-permission', 'invalid-output', 'no-key'] as const) {
      expect(aiErrorMessage(reason).length).toBeGreaterThan(10)
    }
  })
})
