import { describe, expect, it } from 'vitest'
import { pseudonymize } from '../tailor/privacy'
import { SAMPLE_WEB_DEV } from '../tailor/sample-profiles'
import { letterSystem, letterUserPrompt } from './prompt'

const job = { title: 'Frontend Engineer', company: 'Acme', description: 'We build web apps with React.' }

describe('letterSystem', () => {
  it('names the language and the tone, and forbids invented facts', () => {
    const english = letterSystem('en', 'formal')
    expect(english).toMatch(/English/)
    expect(english).toMatch(/formal/i)
    expect(letterSystem('id', 'casual')).toMatch(/Indonesia/)
    expect(letterSystem('id', 'casual')).toMatch(/santai/i)
    expect(english).toMatch(/JSON/)
  })

  it('tells the model to leave the closing and the name to job-kit', () => {
    expect(letterSystem('id', 'formal')).toMatch(/penutup/i)
  })
})

describe('letterUserPrompt', () => {
  const prompt = letterUserPrompt(job, pseudonymize(SAMPLE_WEB_DEV).payload)

  it('carries the posting and the experience', () => {
    expect(prompt).toContain('Frontend Engineer')
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('We build web apps with React.')
    expect(prompt).toContain('Membangun fitur dashboard pelanggan')
  })

  it('carries no name, contact, employer or school (FR-43, FR-46)', () => {
    for (const secret of ['Sari', 'Contohwati', 'example.test', '081200000000', 'Denpasar', 'PT Contoh Teknologi', 'CV Contoh Digital', 'Universitas Contoh Nusantara', '3.5']) {
      expect(prompt).not.toContain(secret)
    }
    expect(prompt).toContain('{C1}')
  })

  it('cuts a very long posting', () => {
    const long = letterUserPrompt({ ...job, description: 'x'.repeat(20000) }, pseudonymize(SAMPLE_WEB_DEV).payload)
    expect(long.length).toBeLessThan(12000)
  })
})
