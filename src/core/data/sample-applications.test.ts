import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyApplicationData } from '../applications/data'
import { EMPTY_APPLICATION_DATA } from '../applications/types'
import { parseImport } from './import'

// fixtures/applications/sample-applications.json is made by scripts/make-sample-applications.mjs.
// It is for trying the Lamaran pages by hand, and later the Visualisasi (T54), without real applications.
const text = readFileSync('fixtures/applications/sample-applications.json', 'utf8')
const raw = JSON.parse(text) as { applications: unknown[]; cvs: unknown[]; letters: unknown[] }

describe('sample applications dump', () => {
  const parsed = parseImport(text)
  if (!parsed.ok || parsed.applications === null) throw new Error('the dump is not a readable version 3 export')
  const data = parsed.applications

  it('is read by Import without dropping anything', () => {
    expect(data.applications).toHaveLength(raw.applications.length)
    expect(data.cvs).toHaveLength(raw.cvs.length)
    expect(data.letters).toHaveLength(raw.letters.length)
  })

  it('has no profile of its own, so Gabung leaves the profile alone', () => {
    const filled = Object.values({ ...parsed.profile.personal, ...parsed.profile.contact }).filter((value) => value !== '')

    expect(filled).toEqual([])
    expect(parsed.profile.education).toEqual([])
    expect(parsed.profile.experience).toEqual([])
  })

  it('fills every column of the board, and the folded Ditolak and Dibatalkan', () => {
    const count = (status: string) => data.applications.filter((app) => app.status === status).length

    expect(['draft', 'applied', 'in-review', 'interview', 'offer', 'rejected', 'withdrawn'].map(count)).toEqual([2, 5, 1, 1, 1, 4, 1])
  })

  it('matches the funnel example of PRD FR-48: 12 sent, 6 reached review, 3 interview, 1 offer, 4 rejected', () => {
    const sent = data.applications.filter((app) => app.events.some((e) => e.type === 'status' && e.to === 'applied'))
    const reached = (status: string) => sent.filter((app) => app.events.some((e) => e.to === status)).length

    expect(sent).toHaveLength(12)
    expect(reached('in-review')).toBe(6)
    expect(reached('interview')).toBe(3)
    expect(reached('offer')).toBe(1)
    expect(reached('rejected')).toBe(4)
  })

  it('has four applications with no reply for 14 days or more, and three still going', () => {
    const DAY = 24 * 60 * 60 * 1000
    const now = Date.now()
    const stillApplied = data.applications.filter((app) => app.status === 'applied')
    const silent = stillApplied.filter((app) => now - Date.parse(app.updatedAt) >= 14 * DAY)
    const going = data.applications.filter((app) => ['in-review', 'interview'].includes(app.status)).length + (stillApplied.length - silent.length)

    expect(silent).toHaveLength(4)
    expect(going).toBe(3)
  })

  it('gives a CV and a letter to some applications, with the links in place', () => {
    const withCv = data.applications.filter((app) => app.cvId !== null)
    const withLetter = data.applications.filter((app) => app.letterId !== null)

    expect(withCv.length).toBeGreaterThan(0)
    expect(withLetter.length).toBeGreaterThan(0)
    expect(data.cvs.map((cv) => cv.applicationId).sort()).toEqual(withCv.map((app) => app.id).sort())
    expect(data.letters.map((letter) => letter.applicationId).sort()).toEqual(withLetter.map((app) => app.id).sort())
  })

  it('has one application without posting text, to see the paste box', () => {
    expect(data.applications.filter((app) => app.job.description === '')).toHaveLength(1)
  })

  it('can be imported twice: the second Gabung adds nothing', () => {
    const once = applyApplicationData(EMPTY_APPLICATION_DATA, data, 'merge')

    expect(applyApplicationData(once, data, 'merge')).toEqual(once)
  })
})
