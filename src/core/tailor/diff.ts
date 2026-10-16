import type { Education, Profile } from '../profile/types'
import { bulletsFromDescription } from './grounded'
import type { TailorOutput } from './types'

// The side-by-side view of a CV (FR-41): the Profile's sentences on the left, the CV's on the right, with what changed marked.
// Added words are green and cut words struck through; red is never used because red means failed (design-system §4.4).
export type Seg = { text: string; kind: 'same' | 'add' | 'rm' }

const tokens = (text: string): string[] => text.match(/\S+\s*/g) ?? []
// Case and a trailing comma or full stop are not changes.
const norm = (token: string) => token.trim().toLowerCase().replace(/[.,;:!?]+$/, '')

function merge(parts: Seg[]): Seg[] {
  const out: Seg[] = []
  for (const part of parts) {
    const last = out.at(-1)
    if (last && last.kind === part.kind) last.text += part.text
    else out.push({ ...part })
  }
  return out
}

// Longest common run of words, so a sentence that only changed a word or two reads as that.
export function diffWords(before: string, after: string): { before: Seg[]; after: Seg[] } {
  const a = tokens(before)
  const b = tokens(after)
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = norm(a[i]!) === norm(b[j]!) ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const left: Seg[] = []
  const right: Seg[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && norm(a[i]!) === norm(b[j]!)) {
      left.push({ text: a[i]!, kind: 'same' })
      right.push({ text: b[j]!, kind: 'same' })
      i++
      j++
    } else if (j < b.length && (i === a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      right.push({ text: b[j]!, kind: 'add' })
      j++
    } else {
      left.push({ text: a[i]!, kind: 'rm' })
      i++
    }
  }
  return { before: merge(left), after: merge(right) }
}

const MIN_RESEMBLANCE = 0.25

function resemblance(a: string, b: string): number {
  const left = new Set(tokens(a).map(norm).filter((t) => t !== ''))
  const right = new Set(tokens(b).map(norm).filter((t) => t !== ''))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  return (2 * shared) / (left.size + right.size)
}

export type BulletPair = { after: string; before: string | null }

// Which original sentence each new bullet came from: best resemblance first, each original used once. A bullet
// that resembles none is unpaired (the model merged or wrote it afresh), and the originals nobody used are "unused".
export function matchBullets(original: string[], tailored: string[]): { pairs: BulletPair[]; unused: string[] } {
  const scores = tailored.flatMap((after, i) => original.map((before, j) => ({ i, j, score: resemblance(before, after) })))
  scores.sort((x, y) => y.score - x.score || x.i - y.i || x.j - y.j)
  const taken = new Map<number, number>() // tailored index -> original index
  const used = new Set<number>()
  for (const { i, j, score } of scores) {
    if (score < MIN_RESEMBLANCE) break
    if (taken.has(i) || used.has(j)) continue
    taken.set(i, j)
    used.add(j)
  }
  return {
    pairs: tailored.map((after, i) => ({ after, before: taken.has(i) ? (original[taken.get(i)!] ?? null) : null })),
    unused: original.filter((_, j) => !used.has(j)),
  }
}

export type CvParts = TailorOutput
export type DiffRow = { before: Seg[] | null; after: Seg[] | null }
export type ExperienceCompare = {
  sourceId: string
  title: string
  company: string
  start: string
  end: string
  current: boolean
  rows: DiffRow[]
  // Original sentences the CV does not use; they stay in the Profile.
  hidden: number
}
export type CvCompare = {
  skills: { original: string[]; tailored: string[]; reordered: boolean; dropped: string[] }
  experience: ExperienceCompare[]
  omittedExperience: number
  education: Education[]
}

export function compareCv(profile: Profile, parts: CvParts): CvCompare {
  const original = profile.skills.map((s) => s.name)
  const inCv = new Set(parts.skills.map((s) => s.toLowerCase()))
  const keptInOrder = original.filter((s) => inCv.has(s.toLowerCase()))
  const tailored = parts.skills.filter((s) => original.some((o) => o.toLowerCase() === s.toLowerCase()))

  const byId = new Map(profile.experience.map((e) => [e.id, e]))
  const experience: ExperienceCompare[] = []
  for (const item of parts.experience) {
    const source = byId.get(item.sourceId)
    if (!source) continue
    const { pairs, unused } = matchBullets(bulletsFromDescription(source.description), item.bullets)
    const rows: DiffRow[] = pairs.map(({ before, after }) => {
      if (before === null) return { before: null, after: [{ text: after, kind: 'add' as const }] }
      const diff = diffWords(before, after)
      return { before: diff.before, after: diff.after }
    })
    for (const text of unused) rows.push({ before: [{ text, kind: 'rm' }], after: null })
    experience.push({ sourceId: source.id, title: source.title, company: source.company, start: source.start, end: source.end, current: source.current, rows, hidden: unused.length })
  }

  const educationById = new Map(profile.education.map((e) => [e.id, e]))
  return {
    skills: {
      original,
      tailored: parts.skills,
      reordered: tailored.length === keptInOrder.length && tailored.some((s, i) => s.toLowerCase() !== keptInOrder[i]?.toLowerCase()),
      dropped: original.filter((s) => !inCv.has(s.toLowerCase())),
    },
    experience,
    omittedExperience: profile.experience.filter((e) => !experience.some((x) => x.sourceId === e.id)).length,
    education: parts.education.map((id) => educationById.get(id)).filter((e): e is Education => e !== undefined),
  }
}
