import { describe, expect, it } from 'vitest'
import { describeUsage, formatBytes } from './storage-usage'

describe('formatBytes', () => {
  it('uses bytes, KB and MB with one decimal from 1 KB up', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1887436)).toBe('1.8 MB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
  })
})

describe('describeUsage', () => {
  it('writes the used and total sizes and the filled share', () => {
    expect(describeUsage(1887436, 10485760)).toEqual({ text: '1.8 MB dari 10 MB', ratio: 0.18 })
  })

  it('never reports a share above 1 or below 0', () => {
    expect(describeUsage(20, 10).ratio).toBe(1)
    expect(describeUsage(-5, 10).ratio).toBe(0)
  })

  it('treats an unknown quota as empty instead of dividing by zero', () => {
    expect(describeUsage(100, 0).ratio).toBe(0)
  })
})
