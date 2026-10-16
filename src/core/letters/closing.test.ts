import { describe, expect, it } from 'vitest'
import { SAMPLE_WEB_DEV } from '../tailor/sample-profiles'
import { createEmptyProfile } from '../profile/profile'
import { finishLetter } from './closing'

const BODY = 'Yth. Tim Rekrutmen,\n\nSaya melamar posisi ini.\n\nTerima kasih atas waktu Anda.'

describe('finishLetter', () => {
  it('adds the closing and the name from the Profile, by language and tone', () => {
    expect(finishLetter(BODY, SAMPLE_WEB_DEV, 'id', 'formal')).toBe(`${BODY}\n\nHormat saya,\nSari Contohwati`)
    expect(finishLetter(BODY, SAMPLE_WEB_DEV, 'id', 'casual')).toBe(`${BODY}\n\nSalam hangat,\nSari Contohwati`)
    expect(finishLetter(BODY, SAMPLE_WEB_DEV, 'en', 'formal')).toBe(`${BODY}\n\nSincerely,\nSari Contohwati`)
    expect(finishLetter(BODY, SAMPLE_WEB_DEV, 'en', 'casual')).toBe(`${BODY}\n\nBest regards,\nSari Contohwati`)
  })

  it('writes the whole name, middle name included', () => {
    const profile = structuredClone(SAMPLE_WEB_DEV)
    profile.personal.middleName = 'Ayu'
    expect(finishLetter(BODY, profile, 'id', 'formal').endsWith('Sari Ayu Contohwati')).toBe(true)
  })

  it('leaves the name out when the Profile has none', () => {
    expect(finishLetter(BODY, createEmptyProfile(), 'id', 'formal')).toBe(`${BODY}\n\nHormat saya,`)
  })

  it('drops a sign-off the model wrote, with the name or placeholder under it', () => {
    expect(finishLetter(`${BODY}\n\nHormat saya,\n{NAMA}`, SAMPLE_WEB_DEV, 'id', 'formal')).toBe(`${BODY}\n\nHormat saya,\nSari Contohwati`)
    expect(finishLetter(`${BODY}\n\nSincerely,\n[Your Name]`, SAMPLE_WEB_DEV, 'en', 'formal')).toBe(`${BODY}\n\nSincerely,\nSari Contohwati`)
    expect(finishLetter(`${BODY}\n\nSalam,\nNama Karangan`, SAMPLE_WEB_DEV, 'id', 'casual')).toBe(`${BODY}\n\nSalam hangat,\nSari Contohwati`)
  })

  it('keeps a body that only ends with a thank-you line', () => {
    const out = finishLetter(BODY, SAMPLE_WEB_DEV, 'id', 'formal')
    expect(out).toContain('Terima kasih atas waktu Anda.')
  })
})
