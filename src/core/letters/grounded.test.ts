import { describe, expect, it } from 'vitest'
import { SAMPLE_WEB_DEV } from '../tailor/sample-profiles'
import { validateLetter } from './grounded'

const job = { title: 'Frontend Engineer', company: 'PT Acme QA' }

describe('validateLetter', () => {
  it('lets a letter through that only uses what the Profile has', () => {
    const body = 'Saya membangun dashboard pelanggan dengan React dan TypeScript, dan menaikkan cakupan tes dari 40% ke 70% dengan Jest. Saya tertarik pada posisi Frontend Engineer.'
    expect(validateLetter(body, SAMPLE_WEB_DEV, job)).toEqual({ ok: true, violations: [] })
  })

  it('refuses a technical term that is not in the Profile', () => {
    const result = validateLetter('Saya berpengalaman dengan Kubernetes dan React.', SAMPLE_WEB_DEV, job)
    expect(result.ok).toBe(false)
    expect(result.violations).toEqual([{ type: 'term', value: 'kubernetes', where: 'surat' }])
  })

  it('refuses a number that no experience has', () => {
    const result = validateLetter('Saya menaikkan cakupan tes menjadi 95% dan memimpin 12 orang.', SAMPLE_WEB_DEV, job)
    expect(result.violations.map((v) => v.value)).toEqual(['95', '12'])
  })

  it('reports each term once', () => {
    const result = validateLetter('Saya memakai Docker. Docker membantu. DOCKER lagi.', SAMPLE_WEB_DEV, job)
    expect(result.violations).toHaveLength(1)
  })

  it('accepts a number from any experience, not only the first', () => {
    expect(validateLetter('Saya belajar sejak 2022 dan kini di posisi saya.', SAMPLE_WEB_DEV, job).ok).toBe(true)
  })

  it('does not count the words of the job title or the company as claims', () => {
    expect(validateLetter('Saya melamar sebagai Frontend Engineer di PT Acme QA.', SAMPLE_WEB_DEV, job).ok).toBe(true)
  })

  it('does not count the Profile\'s own employers and schools as claims', () => {
    expect(validateLetter('Saya bekerja di PT Contoh Teknologi dan lulus dari Universitas Contoh Nusantara.', SAMPLE_WEB_DEV, job).ok).toBe(true)
  })

  it('refuses a code the model invented', () => {
    const result = validateLetter('Saya pernah bekerja di {C9}.', SAMPLE_WEB_DEV, job)
    expect(result.ok).toBe(false)
    expect(result.violations).toContainEqual({ type: 'term', value: 'c9', where: 'surat' })
  })
})
