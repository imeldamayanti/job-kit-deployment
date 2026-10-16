import type { AppStatus, Application } from './types'

// FR-48. The flow of sent applications through the stages, counted from the status history, not only from the status now.
export type FunnelNodeId = 'applied' | 'in-review' | 'interview' | 'offer' | 'stalled' | 'rejected' | 'ongoing'
export type FunnelNode = { id: FunnelNodeId; label: string; count: number }
export type FunnelLink = { from: FunnelNodeId; to: FunnelNodeId; count: number }
export type Funnel = { total: number; nodes: FunnelNode[]; links: FunnelLink[] }

// "Tanpa kabar": still at Dilamar with no status change for this many days (FR-48 default).
export const STALE_DAYS = 14

const DAY = 86_400_000

// The order of the nodes in the diagram's list, and the words on them.
export const FUNNEL_LABELS: Record<FunnelNodeId, string> = {
  applied: 'Dilamar',
  'in-review': 'Direview',
  interview: 'Interview',
  offer: 'Offer',
  stalled: 'Tanpa kabar',
  rejected: 'Ditolak',
  ongoing: 'Masih berjalan',
}
export const FUNNEL_NODE_IDS = Object.keys(FUNNEL_LABELS) as FunnelNodeId[]

// The stages an application passes through on its way to an end point, in order.
const STAGES = ['applied', 'in-review', 'interview'] as const satisfies readonly FunnelNodeId[]
const STAGE_OF: Partial<Record<AppStatus, number>> = { applied: 0, 'in-review': 1, interview: 2, offer: 2 }

// Draft and Dibatalkan were never (or no longer) sent, so they are not counted.
const isSent = (app: Application) => app.status !== 'draft' && app.status !== 'withdrawn'

// The furthest stage ever reached. An offer counts as Interview here: Offer is an end point, not a stage to pass.
function furthestStage(app: Application): number {
  const reached = [app.status, ...app.events.map((event) => event.to)].map((status) => (status ? STAGE_OF[status] : undefined))
  return Math.max(0, ...reached.filter((stage): stage is number => stage !== undefined))
}

// When the status last changed; an application with no status event has been where it is since it was created.
function lastStatusChange(app: Application): number {
  const times = app.events.filter((event) => event.type === 'status').map((event) => Date.parse(event.at))
  return Math.max(Date.parse(app.createdAt), ...times.filter((time) => !Number.isNaN(time)))
}

function endPoint(app: Application, now: Date): FunnelNodeId {
  if (app.status === 'offer') return 'offer'
  if (app.status === 'rejected') return 'rejected'
  if (app.status === 'applied' && now.getTime() - lastStatusChange(app) >= STALE_DAYS * DAY) return 'stalled'
  return 'ongoing'
}

export function funnelStats(apps: readonly Application[], now: Date): Funnel {
  const counts = new Map<FunnelNodeId, number>()
  const flows = new Map<string, FunnelLink>()
  const add = (id: FunnelNodeId) => counts.set(id, (counts.get(id) ?? 0) + 1)
  const flow = (from: FunnelNodeId, to: FunnelNodeId) => {
    const key = `${from}>${to}`
    flows.set(key, { from, to, count: (flows.get(key)?.count ?? 0) + 1 })
  }

  const sent = apps.filter(isSent)
  for (const app of sent) {
    const passed = STAGES.slice(0, furthestStage(app) + 1)
    passed.forEach((stage, index) => {
      add(stage)
      const next = passed[index + 1]
      if (next) flow(stage, next)
    })
    const end = endPoint(app, now)
    add(end)
    flow(passed.at(-1)!, end)
  }

  return {
    total: sent.length,
    nodes: FUNNEL_NODE_IDS.map((id) => ({ id, label: FUNNEL_LABELS[id], count: counts.get(id) ?? 0 })),
    links: [...flows.values()],
  }
}

// The text for a screen reader: "Alur 12 lamaran: 6 sampai Direview, …; 4 tanpa kabar, …". Zero counts are left out.
export function describeFunnel(funnel: Funnel): string {
  const count = (id: FunnelNodeId) => funnel.nodes.find((node) => node.id === id)?.count ?? 0
  const reached = (['in-review', 'interview'] as const).filter((id) => count(id) > 0).map((id) => `${count(id)} sampai ${FUNNEL_LABELS[id]}`)
  if (count('offer') > 0) reached.push(`${count('offer')} Offer`)
  const ended = (['stalled', 'rejected', 'ongoing'] as const).filter((id) => count(id) > 0).map((id) => `${count(id)} ${FUNNEL_LABELS[id].toLowerCase()}`)
  const parts = [reached.join(', '), ended.join(', ')].filter((part) => part !== '')
  return `Alur ${funnel.total} lamaran: ${parts.join('; ')}`
}
