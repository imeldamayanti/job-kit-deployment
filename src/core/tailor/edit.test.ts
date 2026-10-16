import { describe, expect, it } from 'vitest'
import type { TailoredCv } from '../applications/types'
import { cvParts, editCv, overwritesEdits, restoreAiVersion } from './edit'

const cv = (change: Partial<TailoredCv> = {}): TailoredCv => ({
  id: 'cv-1', applicationId: 'a', createdAt: '2026-10-15T08:00:00.000Z', profileHash: 'h',
  skills: ['React', 'TypeScript'], experience: [{ sourceId: 'x', bullets: ['Membangun dashboard.', 'Menulis tes.'] }], education: ['e1'],
  coverage: { required: ['React'], covered: ['React'], missing: [] }, edited: false,
  aiVersion: { skills: ['React', 'TypeScript'], experience: [{ sourceId: 'x', bullets: ['Membangun dashboard.', 'Menulis tes.'] }], education: ['e1'] },
  ...change,
})

describe('editCv (FR-41)', () => {
  it('keeps the person\'s bullets and marks the CV as edited', () => {
    const next = editCv(cv(), { ...cvParts(cv()), experience: [{ sourceId: 'x', bullets: ['Membangun dashboard internal.', 'Menulis tes.'] }] })
    expect(next.experience[0]?.bullets).toEqual(['Membangun dashboard internal.', 'Menulis tes.'])
    expect(next.edited).toBe(true)
  })

  it('leaves the AI version, the coverage and the hash alone', () => {
    const before = cv()
    const next = editCv(before, { ...cvParts(before), skills: ['React'] })
    expect(next.aiVersion).toEqual(before.aiVersion)
    expect(next.coverage).toEqual(before.coverage)
    expect(next.profileHash).toBe('h')
    expect(next.id).toBe('cv-1')
  })

  it('trims bullets and drops empty ones', () => {
    const next = editCv(cv(), { ...cvParts(cv()), experience: [{ sourceId: 'x', bullets: ['  Membangun dashboard.  ', '', '   ', 'Menulis tes.'] }] })
    expect(next.experience[0]?.bullets).toEqual(['Membangun dashboard.', 'Menulis tes.'])
    expect(next.edited).toBe(false)
  })

  it('is not edited when the text ends up the same as the AI wrote it', () => {
    const edited = editCv(cv(), { ...cvParts(cv()), skills: ['React'] })
    expect(edited.edited).toBe(true)
    expect(editCv(edited, { ...cvParts(edited), skills: ['React', 'TypeScript'] }).edited).toBe(false)
  })

  it('does not change the CV it was given', () => {
    const before = cv()
    editCv(before, { ...cvParts(before), skills: [] })
    expect(before.skills).toEqual(['React', 'TypeScript'])
  })
})

describe('restoreAiVersion', () => {
  it('brings the AI wording back and clears the edited mark', () => {
    const edited = editCv(cv(), { skills: ['React'], experience: [{ sourceId: 'x', bullets: ['Lain.'] }], education: [] })
    const back = restoreAiVersion(edited)
    expect(back).toEqual(cv())
    expect(back.edited).toBe(false)
  })

  it('gives a copy: editing the restored CV does not touch the AI version', () => {
    const back = restoreAiVersion(cv({ edited: true, skills: ['x'] }))
    back.skills.push('y')
    expect(back.aiVersion.skills).toEqual(['React', 'TypeScript'])
  })
})

describe('overwritesEdits', () => {
  it('is true only for a CV the person edited: Buat ulang then asks first (FR-45)', () => {
    expect(overwritesEdits(cv())).toBe(false)
    expect(overwritesEdits(cv({ edited: true }))).toBe(true)
    expect(overwritesEdits(null)).toBe(false)
  })
})
