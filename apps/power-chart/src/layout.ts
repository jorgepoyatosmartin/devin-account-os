import dagre from '@dagrejs/dagre'
import type { Stakeholder } from './model'

export const NODE_W = 220
export const NODE_H = 78

export function autoLayout(people: Stakeholder[]): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 70, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  const ids = new Set(people.map((p) => p.id))
  for (const p of people) g.setNode(p.id, { width: NODE_W, height: NODE_H })
  for (const p of people) if (p.reportsTo && ids.has(p.reportsTo)) g.setEdge(p.reportsTo, p.id)
  dagre.layout(g)
  const out: Record<string, { x: number; y: number }> = {}
  for (const p of people) {
    const n = g.node(p.id)
    out[p.id] = { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 }
  }
  return out
}
