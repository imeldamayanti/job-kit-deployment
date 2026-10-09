import { describe, expect, it } from 'vitest'
import {
  addListItem,
  countJobPreferences,
  createEmptyJobPreferences,
  normalizeJobPreferences,
  removeListItem,
  toggleWorkMode,
} from './job-preferences'

describe('createEmptyJobPreferences', () => {
  it('starts with nothing chosen', () => {
    expect(createEmptyJobPreferences()).toEqual({
      roles: [],
      level: '',
      locations: [],
      workModes: [],
      mustHave: [],
      avoid: [],
      minSalary: '',
    })
  })
})

describe('addListItem', () => {
  it('adds a trimmed value at the end', () => {
    expect(addListItem(['Frontend Engineer'], '  UI Engineer ')).toEqual(['Frontend Engineer', 'UI Engineer'])
  })

  it('ignores an empty value', () => {
    expect(addListItem(['React'], '   ')).toEqual(['React'])
  })

  it('ignores a value already there, whatever its case', () => {
    expect(addListItem(['React'], 'react')).toEqual(['React'])
  })
})

describe('removeListItem', () => {
  it('removes the matching value', () => {
    expect(removeListItem(['React', 'PHP'], 'PHP')).toEqual(['React'])
  })
})

describe('toggleWorkMode', () => {
  it('adds a mode that is off and removes one that is on', () => {
    const on = toggleWorkMode([], 'Remote')
    expect(on).toEqual(['Remote'])
    expect(toggleWorkMode(on, 'Remote')).toEqual([])
  })

  it('keeps the order Remote, Hybrid, On-site', () => {
    expect(toggleWorkMode(['Hybrid'], 'Remote')).toEqual(['Remote', 'Hybrid'])
  })
})

describe('normalizeJobPreferences', () => {
  it('returns empty preferences for anything that is not an object', () => {
    expect(normalizeJobPreferences(undefined)).toEqual(createEmptyJobPreferences())
    expect(normalizeJobPreferences('x')).toEqual(createEmptyJobPreferences())
    expect(normalizeJobPreferences([1])).toEqual(createEmptyJobPreferences())
  })

  it('keeps valid values and drops unknown ones', () => {
    const result = normalizeJobPreferences({
      roles: ['Frontend Engineer', 7, ' ', 'frontend engineer'],
      level: 'Mid',
      locations: ['Jakarta'],
      workModes: ['Hybrid', 'Remote', 'Mars'],
      mustHave: 'React',
      avoid: ['PHP'],
      minSalary: '15000000',
      bogus: true,
    })
    expect(result).toEqual({
      roles: ['Frontend Engineer'],
      level: 'Mid',
      locations: ['Jakarta'],
      workModes: ['Remote', 'Hybrid'],
      mustHave: [],
      avoid: ['PHP'],
      minSalary: '15000000',
    })
  })

  it('drops a level that is not one of the four', () => {
    expect(normalizeJobPreferences({ level: 'Wizard' }).level).toBe('')
  })
})

describe('countJobPreferences', () => {
  it('counts the parts that are filled', () => {
    expect(countJobPreferences(createEmptyJobPreferences())).toBe(0)
    expect(
      countJobPreferences({ ...createEmptyJobPreferences(), roles: ['A'], level: 'Mid', minSalary: ' ' }),
    ).toBe(2)
  })
})
