import { describe, expect, it } from 'vitest'
import type { PlanItem } from './plan'
import { selectItems } from './selection'

const item = (fieldId: string, hasExistingText = false): PlanItem => ({
  fieldId,
  label: fieldId,
  key: 'email',
  value: 'v',
  hasExistingText,
})

const none = { disabled: new Set<string>(), overwrite: new Set<string>() }

describe('selectItems', () => {
  it('keeps everything when nothing is switched off', () => {
    expect(selectItems([item('a'), item('b')], none).map((i) => i.fieldId)).toEqual(['a', 'b'])
  })

  it('drops a field the user switched off', () => {
    const selected = selectItems([item('a'), item('b')], { ...none, disabled: new Set(['a']) })

    expect(selected.map((i) => i.fieldId)).toEqual(['b'])
  })

  it('skips a field that already has text unless the user chose to overwrite it', () => {
    const items = [item('a', true), item('b', true)]

    expect(selectItems(items, none)).toEqual([])
    expect(selectItems(items, { ...none, overwrite: new Set(['b']) }).map((i) => i.fieldId)).toEqual(['b'])
  })

  it('a switched-off field stays off even when overwrite was chosen', () => {
    const selected = selectItems([item('a', true)], {
      disabled: new Set(['a']),
      overwrite: new Set(['a']),
    })

    expect(selected).toEqual([])
  })
})
