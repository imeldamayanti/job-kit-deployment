import { describe, expect, it } from 'vitest'
import { coverage } from './coverage'
import { assemble } from './grounded'
import { SAMPLE_IT_SUPPORT, SAMPLE_WEB_DEV } from './sample-profiles'

const cv = (profile = SAMPLE_WEB_DEV) => assemble(profile, { skills: [], experience: [], education: [] })

describe('coverage', () => {
  it('splits requirements into covered and missing, keeping their order', () => {
    const result = coverage(['Pengalaman React dan TypeScript', 'Pengalaman Kotlin untuk Android'], cv())
    expect(result).toEqual({
      required: ['Pengalaman React dan TypeScript', 'Pengalaman Kotlin untuk Android'],
      covered: ['Pengalaman React dan TypeScript'],
      missing: ['Pengalaman Kotlin untuk Android'],
    })
  })

  it('covers a requirement only when every technical term in it is in the CV', () => {
    expect(coverage(['React and Docker'], cv()).missing).toEqual(['React and Docker'])
    expect(coverage(['React and Node.js'], cv()).covered).toEqual(['React and Node.js'])
  })

  it('ignores case and dots when matching a term (NodeJS = Node.js)', () => {
    expect(coverage(['Experience with NODEJS'], cv()).covered).toEqual(['Experience with NODEJS'])
  })

  it('finds a term in a bullet as well as in the skill list', () => {
    const onlyInBullet = assemble(SAMPLE_WEB_DEV, { skills: ['React'], experience: [{ sourceId: 'exp-a1', bullets: ['Menulis tes dengan Jest.'] }], education: [] })
    expect(coverage(['Jest'], { ...onlyInBullet, skills: ['React'] }).covered).toEqual(['Jest'])
  })

  it('covers a requirement with no technical term only when most of its content words are in the CV', () => {
    const support = cv(SAMPLE_IT_SUPPORT)
    expect(coverage(['Menangani tiket keluhan pengguna'], support).covered).toEqual(['Menangani tiket keluhan pengguna'])
    expect(coverage(['Memimpin negosiasi kontrak vendor besar'], support).missing).toEqual(['Memimpin negosiasi kontrak vendor besar'])
  })

  it('does not cover a short vague requirement by one shared word', () => {
    expect(coverage(['Tim player'], cv()).missing).toEqual(['Tim player'])
  })

  it('reports the spike case: Kotlin and Swift are missing for a web developer', () => {
    const result = coverage(['Experience developing Android applications using Kotlin', 'Experience developing iOS applications using Swift'], cv())
    expect(result.covered).toEqual([])
    expect(result.missing).toHaveLength(2)
  })

  it('does not count a term quoted inside the requirement as support (the spike false positive)', () => {
    // "Python, PHP, Ruby" is what the posting asks for, not something the CV says.
    expect(coverage(['Backend in Python, PHP or Ruby'], cv()).covered).toEqual([])
  })

  describe('with what the model says is covered', () => {
    it('trusts the claim for a requirement with no technical term, across languages', () => {
      const support = cv(SAMPLE_IT_SUPPORT)
      const requirement = 'Involved in direct end-user support when required'
      expect(coverage([requirement], support).missing).toEqual([requirement])
      expect(coverage([requirement], support, [requirement]).covered).toEqual([requirement])
    })

    it('matches the claim to the requirement ignoring case and spacing', () => {
      const support = cv(SAMPLE_IT_SUPPORT)
      expect(coverage(['Direct end-user support'], support, ['  direct END-user support ']).covered).toEqual(['Direct end-user support'])
    })

    it('never lets a claim cover a technical term the CV does not back', () => {
      const result = coverage(['Experience with Kotlin and Android'], cv(), ['Experience with Kotlin and Android'])
      expect(result.covered).toEqual([])
      expect(result.missing).toEqual(['Experience with Kotlin and Android'])
    })

    it('ignores a claim about something that is not a requirement', () => {
      expect(coverage(['React'], cv(), ['Memimpin tim besar'])).toEqual({ required: ['React'], covered: ['React'], missing: [] })
    })
  })

  it('handles no requirements and repeated ones', () => {
    expect(coverage([], cv())).toEqual({ required: [], covered: [], missing: [] })
    expect(coverage(['React', 'react', ' React '], cv()).required).toEqual(['React'])
  })
})
