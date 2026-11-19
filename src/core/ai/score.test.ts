import { describe, expect, it } from 'vitest'
import { createEmptyProfile } from '../profile/profile'
import type { Profile } from '../profile/types'
import type { Job } from '../feed/types'
import { AiError } from './errors'
import { RemoteRefusal, SCORE_BATCH, type RemoteScore, type ScoreRequest } from '../generate/protocol'
import { SCORE_SYSTEM, buildProfileSummary, hashSummary, parseScoreOutput, readScoreResults, scoreJobs, scorePrompt, type ScoringClient } from './score'

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

  describe('with a remote', () => {
    const remoteOk = () => {
      const requests: ScoreRequest[] = []
      const remote: RemoteScore = async (request) => {
        requests.push(request)
        return {
          results: request.jobs.map((j) => ({ id: j.id, score: 77, matches: ['React'], gaps: [], summary: 'Cocok', fill: {} })),
          usage: { inputTokens: 10, outputTokens: 4 },
        }
      }
      return { remote, requests }
    }
    const unusedClient: ScoringClient = { complete: async () => { throw new Error('the client must not be called') } }

    it('sends one batch of ten jobs and marks the scores as not rough', async () => {
      const { remote, requests } = remoteOk()
      const jobs = Array.from({ length: 10 }, (_, i) => job(`j${i}`))
      const result = await scoreJobs({ jobs, profile: profile(), client: unusedClient, remote, ...settings, now: NOW, limit: 10 })
      expect(SCORE_BATCH).toBe(10)
      expect(requests).toHaveLength(1)
      expect(requests[0]?.kind).toBe('score')
      expect(requests[0]?.jobs).toHaveLength(10)
      expect(requests[0]?.summary).toEqual(buildProfileSummary(profile(), NOW))
      expect(result.jobs.every((j) => j.score?.rough === false && j.score.value === 77)).toBe(true)
      expect(result.aiScored).toBe(10)
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 4 })
    })

    it('sends only the fields of a posting that the prompt uses', async () => {
      const { remote, requests } = remoteOk()
      await scoreJobs({ jobs: [job('a')], profile: profile(), client: unusedClient, remote, ...settings, now: NOW })
      expect(Object.keys(requests[0]?.jobs[0] ?? {}).sort()).toEqual(
        ['company', 'contract', 'description', 'experience', 'id', 'level', 'location', 'salary', 'title', 'workplace'],
      )
    })

    it('makes one call per batch', async () => {
      const { remote, requests } = remoteOk()
      await scoreJobs({ jobs: Array.from({ length: 25 }, (_, i) => job(`j${i}`)), profile: profile(), client: unusedClient, remote, ...settings, now: NOW, limit: 25 })
      expect(requests.map((r) => r.jobs.length)).toEqual([10, 10, 5])
    })

    it('stops at a refusal, scores the rest by rules and says why', async () => {
      const calls: number[] = []
      const remote: RemoteScore = async () => {
        calls.push(1)
        throw new RemoteRefusal('insufficient', 'Kredit tidak cukup')
      }
      const result = await scoreJobs({ jobs: Array.from({ length: 12 }, (_, i) => job(`j${i}`)), profile: profile(), client: unusedClient, remote, ...settings, now: NOW, limit: 12 })
      expect(calls).toHaveLength(1)
      expect(result.refused).toBe('insufficient')
      expect(result.aiScored).toBe(0)
      expect(result.roughScored).toBe(12)
      expect(result.jobs.every((j) => j.score?.rough === true)).toBe(true)
    })

    it('treats a network failure of the remote like one of the provider', async () => {
      const remote: RemoteScore = async () => {
        throw new TypeError('Failed to fetch')
      }
      const result = await scoreJobs({ jobs: [job('a')], profile: profile(), client: unusedClient, remote, ...settings, now: NOW })
      expect(result.aiProblem).toBe('network')
      expect(result.refused).toBeUndefined()
    })
  })
})

describe('scorePrompt', () => {
  it('is the prompt the local path sends, so the server builds the same one', async () => {
    const seen: { system: string; user: string }[] = []
    const client: ScoringClient = { complete: async (request) => (seen.push(request), reply([])) }
    const jobs = [job('a', { description: 'x'.repeat(2000) })]
    await scoreJobs({ jobs, profile: profile(), client, model: 'm', key: 'k', now: NOW })
    expect(seen[0]?.system).toBe(SCORE_SYSTEM)
    expect(seen[0]?.user).toBe(scorePrompt(buildProfileSummary(profile(), NOW), jobs))
    expect(scorePrompt(buildProfileSummary(profile(), NOW), jobs)).toContain('Postings:')
  })
})

describe('readScoreResults', () => {
  const row = { id: 'a', score: 82.4, matches: ['React'], gaps: [], summary: ' Cocok. ', fill: { workplace: 'remote', salary: 7 } }

  it('reads rows already parsed, the way a server sends them', () => {
    expect(readScoreResults([row], ['a'])).toEqual([{ id: 'a', score: 82, matches: ['React'], gaps: [], summary: 'Cocok.', fill: { workplace: 'remote' } }])
  })

  it('gives nothing for anything that is not a list of rows', () => {
    expect(readScoreResults(undefined, ['a'])).toEqual([])
    expect(readScoreResults('x', ['a'])).toEqual([])
    expect(readScoreResults({ results: [row] }, ['a'])).toEqual([])
  })

  it('drops rows with an unknown id, a repeated id, a score out of range, or no reason', () => {
    const rows = [row, { ...row }, { ...row, id: 'zzz' }, { ...row, id: 'b', score: -1 }, { ...row, id: 'c', score: 101 }, { ...row, id: 'd', summary: ' ' }, { ...row, id: 'e', matches: 'x' }]
    expect(readScoreResults(rows, ['a', 'b', 'c', 'd', 'e']).map((r) => r.id)).toEqual(['a'])
  })

  it('agrees with parseScoreOutput on the same rows', () => {
    expect(parseScoreOutput(JSON.stringify([row]), ['a'])).toEqual(readScoreResults([row], ['a']))
  })
})
