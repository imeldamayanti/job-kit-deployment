import { describe, expect, it } from 'vitest'
import { isDataHash, previewStateFromHash } from './preview-states'

describe('previewStateFromHash', () => {
  it('finds the sample state named in the hash', () => {
    expect(previewStateFromHash('#data?state=confirm-delete')).toEqual({ kind: 'confirm-delete', typed: '' })
    expect(previewStateFromHash('#data?state=done')?.kind).toBe('done')
  })

  it('returns nothing for a missing or unknown name', () => {
    expect(previewStateFromHash('#data')).toBeUndefined()
    expect(previewStateFromHash('#data?state=nope')).toBeUndefined()
    expect(previewStateFromHash('')).toBeUndefined()
  })
})

describe('isDataHash', () => {
  it('matches the Data page with or without a query', () => {
    expect(isDataHash('#data')).toBe(true)
    expect(isDataHash('#data?state=done')).toBe(true)
    expect(isDataHash('#personal')).toBe(false)
    expect(isDataHash('')).toBe(false)
  })
})
