import { describe, expect, it } from 'vitest'
import { CV_SYSTEM, cvUserPrompt } from './prompt'
import { pseudonymize } from './privacy'
import { SAMPLE_WEB_DEV } from './sample-profiles'

const job = { title: 'Frontend Engineer', description: 'Kami mencari engineer React dan TypeScript.' }

describe('CV prompt', () => {
  it('tells the model to use only the profile and to write no title, company, school or date', () => {
    expect(CV_SYSTEM).toMatch(/hanya/i)
    expect(CV_SYSTEM).toMatch(/jabatan, nama perusahaan, institusi, atau tanggal/i)
    expect(CV_SYSTEM).toMatch(/JSON/)
  })

  it('asks for the requirements and the draft in one call, in the shape parseOutput reads', () => {
    for (const key of ['requirements', 'covered', 'skills', 'experience', 'sourceId', 'bullets', 'education']) expect(CV_SYSTEM).toContain(key)
  })

  it('carries the posting title and text and the pseudonymized profile', () => {
    const { payload } = pseudonymize(SAMPLE_WEB_DEV)
    const prompt = cvUserPrompt(job, payload)
    expect(prompt).toContain('Frontend Engineer')
    expect(prompt).toContain('Kami mencari engineer React dan TypeScript.')
    expect(prompt).toContain('exp-a1')
    expect(prompt).toContain('{C1}')
  })

  it('carries no identity and no employer or school name', () => {
    const { payload } = pseudonymize(SAMPLE_WEB_DEV)
    const sent = `${CV_SYSTEM}\n${cvUserPrompt(job, payload)}`
    for (const value of ['Sari', 'Contohwati', 'sari@example.test', '081200000000', 'Denpasar', 'PT Contoh Teknologi', 'Contoh Digital', 'Universitas Contoh Nusantara']) {
      expect(sent, value).not.toContain(value)
    }
  })

  it('cuts a very long posting', () => {
    const { payload } = pseudonymize(SAMPLE_WEB_DEV)
    const prompt = cvUserPrompt({ title: 't', description: 'kata '.repeat(5000) }, payload)
    expect(prompt.length).toBeLessThan(9000)
  })
})
