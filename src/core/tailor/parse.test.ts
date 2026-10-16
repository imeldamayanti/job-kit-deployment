import { describe, expect, it } from 'vitest'
import { parseOutput } from './parse'

const answer = {
  requirements: ['Kotlin', 'Komunikasi'],
  skills: ['React'],
  experience: [{ sourceId: 'exp-a1', bullets: ['Membangun dashboard.'] }],
  education: ['edu-a1'],
}

describe('parseOutput', () => {
  it('reads a well-formed answer', () => {
    const result = parseOutput(JSON.stringify(answer))
    expect(result).toEqual({ ok: true, requirements: ['Kotlin', 'Komunikasi'], claimed: [], output: { skills: ['React'], experience: answer.experience, education: ['edu-a1'] } })
  })

  it('reads the requirements the model says the profile covers, as a claim and not as a fact', () => {
    const result = parseOutput(JSON.stringify({ ...answer, covered: ['Komunikasi', '', 7] }))
    expect(result.ok && result.claimed).toEqual(['Komunikasi'])
  })

  it('treats a missing or malformed covered list as no claim, not as a bad answer', () => {
    for (const covered of [undefined, 'Komunikasi', { a: 1 }, null]) {
      const result = parseOutput(JSON.stringify({ ...answer, covered }))
      expect(result.ok && result.claimed).toEqual([])
    }
  })

  it('reads an answer wrapped in a code fence or in chatter', () => {
    expect(parseOutput('```json\n' + JSON.stringify(answer) + '\n```').ok).toBe(true)
    expect(parseOutput('Berikut hasilnya:\n' + JSON.stringify(answer) + '\nSemoga membantu.').ok).toBe(true)
  })

  it('ignores keys it does not use, such as a coverage the model volunteers', () => {
    const result = parseOutput(JSON.stringify({ ...answer, coverage: { covered: ['x'], missing: [] } }))
    expect(result.ok).toBe(true)
    expect(result.ok && Object.keys(result.output).sort()).toEqual(['education', 'experience', 'skills'])
  })

  it('drops an empty requirement and keeps at most eight', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Requirement ${i + 1}`)
    const result = parseOutput(JSON.stringify({ ...answer, requirements: ['', '  ', ...many] }))
    expect(result.ok && result.requirements).toEqual(many.slice(0, 8))
  })

  it('refuses text that is not JSON', () => {
    expect(parseOutput('maaf, saya tidak bisa')).toEqual({ ok: false, reason: 'Jawaban penyedia bukan JSON.' })
    expect(parseOutput('')).toEqual({ ok: false, reason: 'Jawaban penyedia bukan JSON.' })
    expect(parseOutput('{ "requirements": [')).toEqual({ ok: false, reason: 'Jawaban penyedia bukan JSON.' })
  })

  it('refuses an answer whose shape is wrong, naming the part', () => {
    const bad = (change: Record<string, unknown>) => parseOutput(JSON.stringify({ ...answer, ...change }))
    expect(bad({ skills: 'React' })).toEqual({ ok: false, reason: 'Jawaban penyedia tidak berbentuk CV: skills.' })
    expect(bad({ skills: [1] })).toEqual({ ok: false, reason: 'Jawaban penyedia tidak berbentuk CV: skills.' })
    expect(bad({ requirements: undefined })).toEqual({ ok: false, reason: 'Jawaban penyedia tidak berbentuk CV: requirements.' })
    expect(bad({ experience: [{ bullets: ['x'] }] })).toEqual({ ok: false, reason: 'Jawaban penyedia tidak berbentuk CV: experience.' })
    expect(bad({ experience: [{ sourceId: 'a', bullets: 'x' }] })).toEqual({ ok: false, reason: 'Jawaban penyedia tidak berbentuk CV: experience.' })
    expect(bad({ education: [{ id: 'x' }] })).toEqual({ ok: false, reason: 'Jawaban penyedia tidak berbentuk CV: education.' })
  })

  it('refuses a JSON value that is not an object', () => {
    expect(parseOutput('[1,2]').ok).toBe(false)
    expect(parseOutput('"teks"').ok).toBe(false)
  })

  it('accepts a model that put a company or date key in the answer but does not read it (D12)', () => {
    const result = parseOutput(JSON.stringify({ ...answer, experience: [{ sourceId: 'exp-a1', company: 'PT Karangan', start: '1999', bullets: ['x'] }] }))
    expect(result.ok && result.output.experience).toEqual([{ sourceId: 'exp-a1', bullets: ['x'] }])
  })
})
