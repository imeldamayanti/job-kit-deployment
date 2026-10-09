import { describe, expect, it } from 'vitest'
import {
  addEntry,
  createEducation,
  createExperience,
  moveEntry,
  removeEntry,
  summarizeEducation,
  summarizeExperience,
  updateEntry,
} from './entries'

const ids = (list: { id: string }[]) => list.map((entry) => entry.id)
const abc = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('entry lists', () => {
  it('adds an entry at the end', () => {
    expect(ids(addEntry(abc, { id: 'd' }))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('removes an entry by id', () => {
    expect(ids(removeEntry(abc, 'b'))).toEqual(['a', 'c'])
  })

  it('updates one entry and leaves the rest', () => {
    const list = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]

    expect(updateEntry(list, 'b', { n: 9 })).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 9 }])
  })

  it('moves an entry up and down', () => {
    expect(ids(moveEntry(abc, 'c', 'up'))).toEqual(['a', 'c', 'b'])
    expect(ids(moveEntry(abc, 'a', 'down'))).toEqual(['b', 'a', 'c'])
  })

  it('does nothing when moving past either end', () => {
    expect(ids(moveEntry(abc, 'a', 'up'))).toEqual(['a', 'b', 'c'])
    expect(ids(moveEntry(abc, 'c', 'down'))).toEqual(['a', 'b', 'c'])
  })

  it('does not change the original list', () => {
    moveEntry(abc, 'c', 'up')

    expect(ids(abc)).toEqual(['a', 'b', 'c'])
  })
})

describe('summaries', () => {
  it('writes an education entry as one line', () => {
    const entry = { ...createEducation('e1'), institution: 'Universitas Padjadjaran', level: 'S1', major: 'Sastra Inggris', year: '2024' }

    expect(summarizeEducation(entry)).toBe('Universitas Padjadjaran · S1 Sastra Inggris · 2024')
  })

  it('skips the parts that are empty', () => {
    expect(summarizeEducation({ ...createEducation('e1'), institution: 'SMA 1 Bandung' })).toBe('SMA 1 Bandung')
  })

  it('says so when an education entry is still empty', () => {
    expect(summarizeEducation(createEducation('e1'))).toBe('Belum diisi')
  })

  it('writes a job with its period', () => {
    const entry = { ...createExperience('x1'), title: 'Staf Administrasi', company: 'PT Maju Jaya', start: '2022', end: '2024' }

    expect(summarizeExperience(entry)).toBe('Staf Administrasi · PT Maju Jaya · 2022 - 2024')
  })

  it('shows sekarang for a job that is still going', () => {
    const entry = { ...createExperience('x1'), title: 'Staf', company: 'PT Maju', start: '2022', current: true }

    expect(summarizeExperience(entry)).toBe('Staf · PT Maju · 2022 - sekarang')
  })
})
