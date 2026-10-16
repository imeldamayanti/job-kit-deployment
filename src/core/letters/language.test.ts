import { describe, expect, it } from 'vitest'
import { postingLanguage } from './language'

describe('postingLanguage', () => {
  it('reads an English posting as English', () => {
    const job = {
      title: 'Frontend Engineer',
      description: 'We are looking for an engineer with experience in building and testing web applications. You will work with our product team.',
    }
    expect(postingLanguage(job)).toBe('en')
  })

  it('reads an Indonesian posting as Indonesian', () => {
    const job = {
      title: 'Frontend Engineer',
      description: 'Kami mencari engineer yang memiliki pengalaman membangun aplikasi web dan bisa bekerja sama dalam tim produk.',
    }
    expect(postingLanguage(job)).toBe('id')
  })

  it('does not let an English job title outvote an Indonesian text', () => {
    const job = { title: 'Senior Software Engineer for the Platform Team', description: 'Kami mencari orang yang dapat membangun layanan untuk pengguna dengan tim.' }
    expect(postingLanguage(job)).toBe('id')
  })

  it('falls back to Indonesian when there is no text', () => {
    expect(postingLanguage({ title: 'Developer', description: '' })).toBe('id')
  })
})
