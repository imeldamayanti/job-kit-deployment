import { describe, expect, it } from 'vitest'
import { isDataHash, previewStateFromHash } from './preview-states'

describe('previewStateFromHash', () => {
  it('finds the sample state named in the hash', () => {
    expect(previewStateFromHash('#data?state=confirm-delete')).toEqual({ kind: 'confirm-delete', typed: '' })
    expect(previewStateFromHash('#data?state=done')?.kind).toBe('done')
  })

  it('has a sample for every Import CV screen', () => {
    expect(previewStateFromHash('#data?state=parsing')?.kind).toBe('parsing')
    expect(previewStateFromHash('#data?state=cv-empty')).toMatchObject({ kind: 'import-cv-preview', rows: [] })
    expect(previewStateFromHash('#data?state=cv-error-scan')).toMatchObject({ kind: 'import-error', reason: 'no-text-layer' })
    expect(previewStateFromHash('#data?state=cv-error-locked')).toMatchObject({ kind: 'import-error', reason: 'encrypted' })
    expect(previewStateFromHash('#data?state=cv-error-broken')).toMatchObject({ kind: 'import-error', reason: 'unreadable' })
  })

  it('shows every kind of row in the CV preview sample', () => {
    const state = previewStateFromHash('#data?state=cv-preview')
    if (state?.kind !== 'import-cv-preview') throw new Error('expected the CV preview sample')
    expect(state.rows.some((row) => row.confidence === 'low')).toBe(true)
    expect(state.rows.some((row) => row.occupied && row.oldValue !== '')).toBe(true)
    expect(state.rows.some((row) => row.group === 'education')).toBe(true)
    expect(state.rows.some((row) => row.group === 'experience')).toBe(true)
    expect(state.unparsed.length).toBeGreaterThan(0)
    expect(state.selected.length).toBeGreaterThan(0)
    expect(state.selected.length).toBeLessThan(state.rows.length)
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
