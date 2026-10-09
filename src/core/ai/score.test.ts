import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import type { Job } from '../feed/types'
import { AiError } from './errors'
import { buildProfileSummary, hashSummary, parseScoreOutput, scoreJobs, type ScoringClient } from './score'

const NOW = new Date('2026-10-10T08:00:00Z')

function profile(): Profile {
  const p = createEmptyProfile()
  p.personal.firstName = 'Sari'
  p.personal.lastName = 'Contohwati'
  p.personal.birthDate = '12 Mei 2003'
  p.contact.email = 'sari.rahasia@example.test'
  p.contact.phone = '081200009999'
  p.contact.street = 'Jl. Rahasia No. 7'
  p.contact.city = 'Denpasar'
  p.education = [{ id: 'e', institution: 'Universitas Rahasia', level: 'S1', major: 'Informatika', gpa: '3.9', year: '2024' }]
  p.experience = [{ id: 'x', company: 'PT Rahasia Karya', title: 'Frontend Developer', start: '2023-01', end: '', current: true, description: 'Detail internal' }]
  p.skills = [{ group: 'teknis', name: 'React' }]
  p.custom = [{ id: 'c', key: 'Gaji', value: '99 juta' }]
  p.jobPrefs.roles = ['Frontend Engineer']
  p.jobPrefs.level = 'Mid'
  p.jobPrefs.locations = ['Jakarta']
  p.jobPrefs.workModes = ['Remote']
  return p
}

function job(id: string, change: Partial<Job> = {}): Job {
  return {
    id, status: 'new', score: null, aiFilled: [], firstSeenAt: '', lastSeenAt: '', source: 'ashby', title: `Frontend ${id}`,
    company: 'PT Contoh', location: 'Remote', workplace: 'unknown', contract: '', level: '', salary: '', experience: '',
    postedAt: '2026-10-08', deadline: '', url: `https://x.test/${id}`, description: 'React dan TypeScript', logoUrl: '', ...change,
  }
}

function reply(items: unknown[]) {
  return { text: JSON.stringify(items), usage: { inputTokens: 100, outputTokens: 40 } }
}

describe('buildProfileSummary', () => {
  it('holds only what PRD 4.1 allows', () => {
    expect(buildProfileSummary(profile(), NOW)).toEqual({
      roles: ['Frontend Engineer'],
      level: 'Mid',
      skills: ['React'],
      experience: { titles: ['Frontend Developer'], years: 3.8 },
      education: ['S1'],
      locations: ['Jakarta'],
      workModes: ['Remote'],
    })
  })

  it('never carries a name, email, phone, address, birth date or company', () => {
    const payload = JSON.stringify(buildProfileSummary(profile(), NOW))
    for (const secret of ['Sari', 'Contohwati', 'rahasia', '081200009999', 'Denpasar', '12 Mei', 'Universitas', 'PT Rahasia', '99 juta', 'Detail internal']) {
      expect(payload).not.toContain(secret)
    }
  })
})

describe('hashSummary', () => {
  it('is stable for the same profile and changes when preferences change', () => {
    const a = hashSummary(buildProfileSummary(profile(), NOW))
    expect(hashSummary(buildProfileSummary(profile(), NOW))).toBe(a)
    const changed = profile()
    changed.jobPrefs.level = 'Senior'
    expect(hashSummary(buildProfileSummary(changed, NOW))).not.toBe(a)
  })

  it('does not change when only a private field changes', () => {
    const a = hashSummary(buildProfileSummary(profile(), NOW))
    const other = profile()
    other.personal.firstName = 'Dewi'
    expect(hashSummary(buildProfileSummary(other, NOW))).toBe(a)
  })
})

describe('parseScoreOutput', () => {
  const good = { id: 'a', score: 82, matches: ['React'], gaps: ['GraphQL'], summary: 'Cocok di stack.' }

  it('reads a clean array', () => {
    expect(parseScoreOutput(JSON.stringify([good]), ['a'])).toEqual([{ id: 'a', score: 82, matches: ['React'], gaps: ['GraphQL'], summary: 'Cocok di stack.', fill: {} }])
  })

  it('reads an array inside a code fence or with chatter around it', () => {
    expect(parseScoreOutput('Ini hasilnya:\n```json\n' + JSON.stringify([good]) + '\n```', ['a'])).toHaveLength(1)
  })

  it('drops an item that is not valid, keeps the others', () => {
    const items = [good, { id: 'b', score: 'tinggi' }, { id: 'zzz', score: 50, matches: [], gaps: [], summary: 'x' }, { id: 'c', score: 120, matches: [], gaps: [], summary: 'x' }]
    expect(parseScoreOutput(JSON.stringify(items), ['a', 'b', 'c']).map((r) => r.id)).toEqual(['a'])
  })

  it('returns nothing for text that is not JSON', () => {
    expect(parseScoreOutput('maaf, saya tidak bisa', ['a'])).toEqual([])
  })

  it('keeps only fill values it understands', () => {
    const item = { ...good, fill: { workplace: 'remote', level: 'Mid', experience: '3+ tahun', salary: 7, contract: 'Full-time', bogus: 'x' } }
    expect(parseScoreOutput(JSON.stringify([item]), ['a'])[0]?.fill).toEqual({ workplace: 'remote', level: 'Mid', experience: '3+ tahun', contract: 'Full-time' })
  })
})

describe('scoreJobs', () => {
  const settings = { model: 'm', key: 'k' }

  it('scores every unscored job with a reason, in batches', async () => {
    const calls: string[] = []
    const client: ScoringClient = {
      async complete(request) {
        calls.push(request.user)
        const ids = [...request.user.matchAll(/"id":"(\w+)"/g)].map((m) => m[1])
        return reply(ids.map((id) => ({ id, score: 80, matches: ['React'], gaps: [], summary: 'Cocok' })))
      },
    }
    const result = await scoreJobs({ jobs: ['a', 'b', 'c'].map((id) => job(id)), profile: profile(), client, ...settings, now: NOW, batchSize: 2 })
    expect(calls).toHaveLength(2)
    expect(result.jobs.every((j) => j.score?.rough === false && j.score.value === 80 && j.score.matches.length > 0)).toBe(true)
    expect(result.jobs[0]?.score?.inputHash).toBe(hashSummary(buildProfileSummary(profile(), NOW)))
    expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 80 })
    expect(result.aiProblem).toBeUndefined()
  })

  it('does not ask again for a job already scored for the same profile', async () => {
    const hash = hashSummary(buildProfileSummary(profile(), NOW))
    const scored = job('a', { score: { value: 70, matches: ['x'], gaps: [], summary: 's', rough: false, inputHash: hash } })
    let called = 0
    const client: ScoringClient = { complete: async () => (called++, reply([])) }
    const result = await scoreJobs({ jobs: [scored], profile: profile(), client, ...settings, now: NOW })
    expect(called).toBe(0)
    expect(result.jobs[0]?.score?.value).toBe(70)
  })

  it('asks again when the profile or preferences changed', async () => {
    const scored = job('a', { score: { value: 70, matches: ['x'], gaps: [], summary: 's', rough: false, inputHash: 'old' } })
    const client: ScoringClient = { complete: async () => reply([{ id: 'a', score: 55, matches: ['y'], gaps: [], summary: 'baru' }]) }
    const result = await scoreJobs({ jobs: [scored], profile: profile(), client, ...settings, now: NOW })
    expect(result.jobs[0]?.score?.value).toBe(55)
  })

  it('scores at most the limit with the AI and the rest by rules', async () => {
    const client: ScoringClient = {
      complete: async (request) => reply([...request.user.matchAll(/"id":"(\w+)"/g)].map((m) => ({ id: m[1], score: 90, matches: ['m'], gaps: [], summary: 's' }))),
    }
    const result = await scoreJobs({ jobs: ['a', 'b', 'c', 'd'].map((id) => job(id)), profile: profile(), client, ...settings, now: NOW, limit: 2 })
    expect(result.jobs.filter((j) => j.score?.rough === false)).toHaveLength(2)
    expect(result.jobs.filter((j) => j.score?.rough === true)).toHaveLength(2)
  })

  it('falls back to the rough score for every job when the key is refused, and says why', async () => {
    const client: ScoringClient = { complete: async () => { throw new AiError('invalid-key') } }
    const result = await scoreJobs({ jobs: ['a', 'b', 'c'].map((id) => job(id)), profile: profile(), client, ...settings, now: NOW, batchSize: 1 })
    expect(result.aiProblem).toBe('invalid-key')
    expect(result.jobs.every((j) => j.score?.rough === true)).toBe(true)
  })

  it('stops calling the AI after the key is refused', async () => {
    let called = 0
    const client: ScoringClient = { complete: async () => { called += 1; throw new AiError('invalid-key') } }
    await scoreJobs({ jobs: ['a', 'b', 'c'].map((id) => job(id)), profile: profile(), client, ...settings, now: NOW, batchSize: 1 })
    expect(called).toBe(1)
  })

  it('uses the rule score for a batch with unusable output and carries on', async () => {
    let n = 0
    const client: ScoringClient = {
      complete: async (request) => (++n === 1 ? { text: 'bukan json', usage: { inputTokens: 1, outputTokens: 1 } } : reply([...request.user.matchAll(/"id":"(\w+)"/g)].map((m) => ({ id: m[1], score: 60, matches: ['m'], gaps: [], summary: 's' })))),
    }
    const result = await scoreJobs({ jobs: ['a', 'b'].map((id) => job(id)), profile: profile(), client, ...settings, now: NOW, batchSize: 1 })
    expect(result.jobs.map((j) => j.score?.rough)).toEqual([true, false])
    expect(result.aiProblem).toBeUndefined()
  })

  it('fills only empty fields from the AI and marks them', async () => {
    const client: ScoringClient = {
      complete: async () => reply([{ id: 'a', score: 80, matches: ['m'], gaps: [], summary: 's', fill: { workplace: 'remote', level: 'Mid', experience: '3+ tahun' } }]),
    }
    const result = await scoreJobs({ jobs: [job('a', { level: 'Senior' })], profile: profile(), client, ...settings, now: NOW })
    const out = result.jobs[0] as Job
    expect(out.workplace).toBe('remote')
    expect(out.level).toBe('Senior')
    expect(out.experience).toBe('3+ tahun')
    expect(out.aiFilled).toEqual(['workplace', 'experience'])
  })

  it('never sends personal data to the client', async () => {
    const seen: string[] = []
    const client: ScoringClient = { complete: async (request) => (seen.push(request.system + request.user), reply([])) }
    await scoreJobs({ jobs: [job('a')], profile: profile(), client, ...settings, now: NOW })
    for (const secret of ['Sari', 'sari.rahasia', '081200009999', 'Denpasar', 'Jl. Rahasia', '12 Mei']) expect(seen.join('')).not.toContain(secret)
  })

  it('does not change the jobs it was given', async () => {
    const original = [job('a')]
    const client: ScoringClient = { complete: async () => reply([{ id: 'a', score: 80, matches: ['m'], gaps: [], summary: 's' }]) }
    await scoreJobs({ jobs: original, profile: profile(), client, ...settings, now: NOW })
    expect(original[0]?.score).toBeNull()
  })
})
