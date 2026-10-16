import { ChartColumn } from 'lucide-react'
import { describeFunnel, STALE_DAYS, type Funnel, type FunnelNode, type FunnelNodeId } from '../../core/applications/funnel'
import { layoutSankey } from '../../core/applications/sankey'
import type { StatusTone } from '../../core/applications/view'
import { Empty } from './EmptyState'

// Full class names, so Tailwind sees them. Same tones as the status badges (T40 mockup, design-system §4.4).
const FILL: Record<StatusTone, string> = {
  ok: 'fill-green-700',
  prog: 'fill-violet-700',
  warn: 'fill-amber-700',
  bad: 'fill-rose-700',
  dim: 'fill-text-secondary',
}
const BAR: Record<StatusTone, string> = {
  ok: 'bg-green-700',
  prog: 'bg-violet-700',
  warn: 'bg-amber-700',
  bad: 'bg-rose-700',
  dim: 'bg-text-secondary',
}

// The list's order (mockup): the stages, then where they ended.
const LIST_ORDER: readonly FunnelNodeId[] = ['applied', 'in-review', 'interview', 'offer', 'stalled', 'ongoing', 'rejected']

// FR-48 · "Pencarian kerjamu". The layout is core/applications/sankey; this only draws it. At a narrow width the
// diagram's text is unreadable, so a list of bars with the same numbers takes its place.
export function SankeyChart({ funnel }: { funnel: Funnel }) {
  if (funnel.total === 0) {
    return (
      <Empty
        icon={<ChartColumn size={18} strokeWidth={2} />}
        title="Belum ada lamaran yang dikirim"
        body="Diagram muncul setelah ada lamaran yang berstatus Dilamar atau lebih jauh. Draft dan Dibatalkan tidak dihitung."
      />
    )
  }

  const layout = layoutSankey(funnel)
  const toneOf = (id: FunnelNodeId) => layout.nodes.find((node) => node.id === id)?.tone ?? 'dim'
  const rows = LIST_ORDER.flatMap((id) => funnel.nodes.filter((node): node is FunnelNode => node.id === id && node.count > 0))

  return (
    <section aria-label="Pencarian kerjamu" className="@container flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-bold text-text-primary">Pencarian kerjamu</h3>
        <span className="text-[12px] tabular-nums text-text-secondary">{funnel.total} lamaran dikirim</span>
      </div>

      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={describeFunnel(funnel)}
        xmlns="http://www.w3.org/2000/svg"
        className="hidden h-auto max-h-[300px] w-full @min-[600px]:block"
      >
        {layout.ribbons.map((ribbon) => (
          <path key={`${ribbon.from}-${ribbon.to}`} d={ribbon.path} fillOpacity={0.22} className={FILL[ribbon.tone]}>
            <title>{ribbon.title}</title>
          </path>
        ))}
        {layout.nodes.map((node) => (
          <rect key={node.id} x={node.x} y={node.y} width={node.width} height={node.height} rx={3} className={FILL[node.tone]} />
        ))}
        {layout.nodes.map((node) => (
          <g key={node.id} className="text-[12px] font-semibold">
            <text x={node.label.x} y={node.label.y} textAnchor={node.label.anchor} className="fill-text-primary">
              {node.label.countY === undefined ? `${node.name} ${node.count}` : node.name}
            </text>
            {node.label.countY !== undefined && (
              <text x={node.label.x} y={node.label.countY} textAnchor={node.label.anchor} className="fill-text-secondary font-bold tabular-nums">
                {node.count}
              </text>
            )}
          </g>
        ))}
      </svg>

      <ul aria-label="Alur lamaran" className="m-0 flex list-none flex-col gap-2 p-0 @min-[600px]:hidden">
        {rows.map((node) => (
          <li key={node.id} className="grid grid-cols-[104px_minmax(0,1fr)_26px] items-center gap-2 text-[13px]">
            <span>{node.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <i className={'block h-full rounded-[inherit] ' + BAR[toneOf(node.id)]} style={{ width: `${Math.round((node.count / funnel.total) * 100)}%` }} />
            </div>
            <b className="text-right tabular-nums">{node.count}</b>
          </li>
        ))}
      </ul>

      <p className="text-[12px] text-text-secondary">
        Dihitung dari riwayat status. <b>Tanpa kabar</b> = Dilamar tanpa perubahan {STALE_DAYS} hari atau lebih. Draft dan Dibatalkan tidak dihitung.
      </p>
    </section>
  )
}
