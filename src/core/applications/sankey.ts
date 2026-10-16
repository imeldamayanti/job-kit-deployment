import { FUNNEL_LABELS, type Funnel, type FunnelNodeId } from './funnel'
import type { StatusTone } from './view'

// The Sankey diagram of FR-48 laid out as plain numbers (no chart library). The canvas and the spacing come from the
// T40 mockup (design-system §9.2): 860 × 300, bars 12 wide, 15 px per application, 16 px between the end points.
export type SankeySize = { width: number; height: number }
export const SANKEY_SIZE: SankeySize = { width: 860, height: 300 }

export type SankeyLabel = {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  // Present when the count goes on a line of its own below the name; absent when it follows the name on the same line.
  countY?: number
}
export type SankeyNode = {
  id: FunnelNodeId
  name: string
  count: number
  tone: StatusTone
  x: number
  y: number
  width: number
  height: number
  label: SankeyLabel
}
export type SankeyRibbon = {
  from: FunnelNodeId
  to: FunnelNodeId
  count: number
  tone: StatusTone
  thickness: number
  // A closed shape: the top edge and the bottom edge are cubic Béziers whose control points sit halfway across.
  path: string
  title: string
}
export type SankeyLayout = SankeySize & { nodes: SankeyNode[]; ribbons: SankeyRibbon[] }

// Badge map: green for Dilamar and Offer, violet while it is being looked at, amber for Interview, rose for Ditolak, grey for no news.
const TONE: Record<FunnelNodeId, StatusTone> = {
  applied: 'ok',
  'in-review': 'prog',
  interview: 'warn',
  offer: 'ok',
  stalled: 'dim',
  rejected: 'bad',
  ongoing: 'prog',
}

const COLUMN: Record<FunnelNodeId, number> = { applied: 0, 'in-review': 1, interview: 2, stalled: 3, rejected: 3, ongoing: 3, offer: 3 }
// Where the four columns sit on the 860 px canvas of the mockup.
const COLUMN_X = [150, 360, 540, 690]
// The end points, top to bottom.
const ENDS: readonly FunnelNodeId[] = ['stalled', 'rejected', 'ongoing', 'offer']
// The stages, in the order they are placed: from the right, so each one can look at the bars it feeds.
const STAGES: readonly FunnelNodeId[] = ['interview', 'in-review', 'applied']

const BAR = 12
const TOP = 28
const BOTTOM = 44
const GAP = 16
const MAX_UNIT = 15

const round = (value: number) => Math.round(value * 100) / 100
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high))

function labelOf(id: FunnelNodeId, x: number, y: number, height: number): SankeyLabel {
  const column = COLUMN[id]
  const middle = y + height / 2
  if (column === 0) return { x: x - 10, y: middle - 2, anchor: 'end', countY: middle + 15 }
  if (column === 3) return { x: x + BAR + 10, y: middle + 4, anchor: 'start' }
  return { x: x + BAR / 2, y: y - 8, anchor: 'middle' }
}

export function layoutSankey(funnel: Funnel, size: SankeySize = SANKEY_SIZE): SankeyLayout {
  const present = funnel.nodes.filter((node) => node.count > 0)
  if (funnel.total === 0 || present.length === 0) return { ...size, nodes: [], ribbons: [] }

  const has = (id: FunnelNodeId) => present.some((node) => node.id === id)
  const countOf = (id: FunnelNodeId) => present.find((node) => node.id === id)?.count ?? 0
  const links = funnel.links.filter((link) => link.count > 0 && has(link.from) && has(link.to))
  const ends = ENDS.filter(has)

  // 15 px per application, less when there are so many that the end points would not fit.
  const unit = Math.min(MAX_UNIT, (size.height - TOP - BOTTOM - GAP * (ends.length - 1)) / funnel.total)
  const height = (id: FunnelNodeId) => countOf(id) * unit
  const x = (id: FunnelNodeId) => Math.round((COLUMN_X[COLUMN[id]]! * size.width) / SANKEY_SIZE.width)

  const y = new Map<FunnelNodeId, number>()
  let cursor = TOP
  for (const id of ends) {
    y.set(id, cursor)
    cursor += height(id) + GAP
  }

  // Flows into a bar stack in the order of the columns they come from; flows out of a bar, in the order of where they land.
  const into = (id: FunnelNodeId) => links.filter((link) => link.to === id).sort((a, b) => COLUMN[a.from] - COLUMN[b.from])
  const out = (id: FunnelNodeId) => links.filter((link) => link.from === id).sort((a, b) => (y.get(a.to) ?? 0) - (y.get(b.to) ?? 0) || COLUMN[a.to] - COLUMN[b.to])
  const before = (list: typeof links, link: (typeof links)[number]) =>
    list.slice(0, list.indexOf(link)).reduce((sum, other) => sum + other.count * unit, 0)

  // Each stage sits where the flows leaving it run straightest into the bars they feed (weighted by count).
  for (const id of STAGES.filter(has)) {
    const leaving = out(id)
    const weight = leaving.reduce((sum, link) => sum + link.count, 0)
    const straight = leaving.reduce(
      (sum, link) => sum + link.count * ((y.get(link.to) ?? TOP) + before(into(link.to), link) - before(leaving, link)),
      0,
    )
    y.set(id, Math.round(clamp(weight > 0 ? straight / weight : TOP, TOP, size.height - BOTTOM - height(id))))
  }

  const nodes: SankeyNode[] = present.map(({ id, count }) => {
    const top = y.get(id) ?? TOP
    return {
      id, name: FUNNEL_LABELS[id], count, tone: TONE[id], x: x(id), y: top, width: BAR, height: height(id),
      label: labelOf(id, x(id), top, height(id)),
    }
  })
  const box = (id: FunnelNodeId) => nodes.find((node) => node.id === id)!

  const ribbons: SankeyRibbon[] = [...links]
    .sort((a, b) => COLUMN[a.from] - COLUMN[b.from] || (y.get(a.from) ?? 0) - (y.get(b.from) ?? 0) || (y.get(a.to) ?? 0) - (y.get(b.to) ?? 0))
    .map((link) => {
      const from = box(link.from)
      const to = box(link.to)
      const thickness = link.count * unit
      const sx = from.x + BAR
      const sy = from.y + before(out(link.from), link)
      const ty = to.y + before(into(link.to), link)
      const mid = round((sx + to.x) / 2)
      const path =
        `M${sx},${round(sy)} C${mid},${round(sy)} ${mid},${round(ty)} ${to.x},${round(ty)} ` +
        `L${to.x},${round(ty + thickness)} C${mid},${round(ty + thickness)} ${mid},${round(sy + thickness)} ${sx},${round(sy + thickness)} Z`
      return {
        from: link.from, to: link.to, count: link.count, tone: TONE[link.to], thickness: round(thickness), path,
        title: `${from.name} → ${to.name}: ${link.count}`,
      }
    })

  return { ...size, nodes, ribbons }
}
