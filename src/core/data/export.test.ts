import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import { buildExport, exportFileName } from './export'

describe('buildExport', () => {
  it('wraps the profile in a versioned envelope', () => {
    const profile = createEmptyProfile()
    const parsed = JSON.parse(buildExport(profile, new Date('2026-10-09T08:00:00Z')))
    expect(parsed).toEqual({ app: 'job-kit', version: 1, exportedAt: '2026-10-09T08:00:00.000Z', profile })
  })
})

describe('exportFileName', () => {
  it('names the file after the export date', () => {
    expect(exportFileName(new Date('2026-10-09T08:00:00Z'))).toBe('job-kit-export-2026-10-09.json')
  })
})
