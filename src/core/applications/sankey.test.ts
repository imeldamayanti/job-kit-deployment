import { describe, expect, it } from 'vitest'
import { funnelStats } from './funnel'
import { VIZ_NOW, VIZ_SAMPLE } from './preview'
import { layoutSankey } from './sankey'

const sample = funnelStats(VIZ_SAMPLE, VIZ_NOW)
const layout = layoutSankey(sample)
const node = (id: string) => layout.nodes.find((n) => n.id === id)!
const ribbon = (from: string, to: string) => layout.ribbons.find((r) => r.from === from && r.to === to)!

describe('layoutSankey nodes', () => {
  it('uses the canvas of the mockup', () => {
    expect([layout.width, layout.height]).toEqual([860, 300])
  })

  it('puts the stages in their columns, with the end points together on the right', () => {
    expect(layout.nodes.map((n) => [n.id, n.x]).sort()).toEqual([
      ['applied', 150], ['in-review', 360], ['interview', 540], ['offer', 690], ['ongoing', 690], ['rejected', 690], ['stalled', 690],
    ])
    expect(layout.nodes.every((n) => n.width === 12)).toBe(true)
  })

  it('makes bars as tall as their count: 15 px per application', () => {
    expect(layout.nodes.map((n) => [n.id, n.height]).sort()).toEqual([
      ['applied', 180], ['in-review', 90], ['interview', 45], ['offer', 15], ['ongoing', 45], ['rejected', 60], ['stalled', 60],
    ])
  })

  it('stacks the end points like the mockup: Tanpa kabar, Ditolak, Masih berjalan, Offer, 16 px apart', () => {
    expect(['stalled', 'rejected', 'ongoing', 'offer'].map((id) => node(id).y)).toEqual([28, 104, 180, 241])
  })

  it('keeps every bar inside the canvas', () => {
    for (const n of layout.nodes) {
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y + n.height).toBeLessThanOrEqual(layout.height)
    }
  })

  it('colours the bars from the badge map', () => {
    expect(layout.nodes.map((n) => [n.id, n.tone]).sort()).toEqual([
      ['applied', 'ok'], ['in-review', 'prog'], ['interview', 'warn'], ['offer', 'ok'], ['ongoing', 'prog'], ['rejected', 'bad'], ['stalled', 'dim'],
    ])
  })

  it('places the labels the way the mockup does', () => {
    const applied = node('applied')
    const review = node('in-review')
    const stalled = node('stalled')

    expect(applied.label).toMatchObject({ anchor: 'end', x: 140, y: applied.y + applied.height / 2 - 2, countY: applied.y + applied.height / 2 + 15 })
    expect(review.label).toMatchObject({ anchor: 'middle', x: 366, y: review.y - 8 })
    expect(review.label.countY).toBeUndefined()
    expect(stalled.label).toMatchObject({ anchor: 'start', x: 712, y: stalled.y + stalled.height / 2 + 4 })
  })
})

describe('layoutSankey ribbons', () => {
  it('draws one ribbon per flow, as thick as its count', () => {
    expect(layout.ribbons).toHaveLength(9)
    expect(ribbon('applied', 'in-review').thickness).toBe(90)
    expect(ribbon('in-review', 'interview').thickness).toBe(45)
    expect(ribbon('interview', 'offer').thickness).toBe(15)
  })

  it('draws Dilamar → Tanpa kabar exactly like the mockup: a cubic Bézier whose control points sit halfway', () => {
    const y = node('applied').y

    expect(ribbon('applied', 'stalled').path).toBe(`M162,${y} C426,${y} 426,28 690,28 L690,88 C426,88 426,${y + 60} 162,${y + 60} Z`)
  })

  it('draws Dilamar → Direview with the control points halfway between the two bars', () => {
    const from = node('applied')
    const to = node('in-review')
    const top = from.y + 90 // after Tanpa kabar (60) and Ditolak (30)

    expect(ribbon('applied', 'in-review').path).toBe(
      `M162,${top} C261,${top} 261,${to.y} 360,${to.y} L360,${to.y + 90} C261,${to.y + 90} 261,${top + 90} 162,${top + 90} Z`,
    )
  })

  it('lays the flows leaving a bar out from top to bottom, ordered by where they land', () => {
    const tops = layout.ribbons.filter((r) => r.from === 'applied').map((r) => [r.to, Number(r.path.match(/^M162,([\d.]+)/)![1])])

    expect(tops).toEqual([['stalled', node('applied').y], ['rejected', node('applied').y + 60], ['in-review', node('applied').y + 90]])
  })

  it('lets the flows leaving or entering a bar fill it exactly', () => {
    for (const n of layout.nodes) {
      const out = layout.ribbons.filter((r) => r.from === n.id).reduce((sum, r) => sum + r.thickness, 0)
      const into = layout.ribbons.filter((r) => r.to === n.id).reduce((sum, r) => sum + r.thickness, 0)
      if (n.id !== 'applied') expect(into).toBe(n.height)
      if (!['offer', 'ongoing', 'rejected', 'stalled'].includes(n.id)) expect(out).toBe(n.height)
    }
  })

  it('titles every ribbon for the tooltip: "Direview → Interview: 3"', () => {
    expect(ribbon('in-review', 'interview').title).toBe('Direview → Interview: 3')
    expect(ribbon('applied', 'stalled').title).toBe('Dilamar → Tanpa kabar: 4')
  })

  it('takes its colour from the bar it flows into', () => {
    expect(['rejected', 'in-review', 'stalled'].map((to) => ribbon('applied', to).tone)).toEqual(['bad', 'prog', 'dim'])
    expect(ribbon('in-review', 'interview').tone).toBe('warn')
    expect(ribbon('interview', 'offer').tone).toBe('ok')
  })
})

describe('layoutSankey in general', () => {
  it('draws nothing when no application was sent', () => {
    expect(layoutSankey({ total: 0, nodes: [], links: [] })).toMatchObject({ nodes: [], ribbons: [] })
  })

  it('leaves out bars with a count of zero', () => {
    const one = layoutSankey(funnelStats(VIZ_SAMPLE.slice(0, 1), VIZ_NOW))

    expect(one.nodes.length).toBeGreaterThan(0)
    expect(one.nodes.every((n) => n.count > 0)).toBe(true)
  })

  it('shrinks the unit so a large number of applications still fits in the canvas', () => {
    const many = layoutSankey({
      total: 100,
      nodes: [{ id: 'applied', label: 'Dilamar', count: 100 }, { id: 'stalled', label: 'Tanpa kabar', count: 60 }, { id: 'ongoing', label: 'Masih berjalan', count: 40 }],
      links: [{ from: 'applied', to: 'stalled', count: 60 }, { from: 'applied', to: 'ongoing', count: 40 }],
    })

    expect(Math.max(...many.nodes.map((n) => n.y + n.height))).toBeLessThanOrEqual(many.height)
    expect(many.nodes.find((n) => n.id === 'applied')!.height).toBeLessThan(100 * 15)
  })

  it('gives the same layout for the same numbers', () => {
    expect(layoutSankey(sample)).toEqual(layout)
  })
})
