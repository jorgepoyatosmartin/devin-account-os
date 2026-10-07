export type Level = 'C Level' | '2nd' | '3rd' | '4th'
export type Role = 'EB' | 'Champion' | 'Coach' | 'Influencer' | 'Blocker' | 'None'
export type Attitude = 'positive' | 'neutral' | 'negative' | 'unknown'
export type Status = 'No contact' | 'In contact' | 'In process' | 'Opportunity'
export type SalesPlay = 'Agentic Readiness' | 'Security AI Governance' | 'API + AI Monetization'
export type Confidence = 'confirmed' | 'hypothesis'

export interface Stakeholder {
  id: string
  name: string
  title: string
  level: Level
  unit: string
  salesPlay: SalesPlay
  role: Role
  attitude: Attitude
  influence: 1 | 2 | 3
  status: Status
  owner: string
  lastTouch: string | null
  reportsTo: string | null
  reportsToConfidence: Confidence
  influences: string[]
  notes: string
  external?: boolean
}

export interface Gap {
  kind: 'critical' | 'warning'
  nodeId?: string
  text: string
}

export const ROLE_LABEL: Record<Role, string> = {
  EB: 'Economic Buyer',
  Champion: 'Champion',
  Coach: 'Coach',
  Influencer: 'Influencer',
  Blocker: 'Blocker',
  None: 'Sin rol',
}

export const ROLE_COLOR: Record<Role, string> = {
  EB: '#7c3aed',
  Champion: '#0d9488',
  Coach: '#2563eb',
  Influencer: '#64748b',
  Blocker: '#dc2626',
  None: '#cbd5e1',
}

export const ATTITUDE_COLOR: Record<Attitude, string> = {
  positive: '#16a34a',
  neutral: '#f59e0b',
  negative: '#dc2626',
  unknown: '#94a3b8',
}

export const ATTITUDE_LABEL: Record<Attitude, string> = {
  positive: 'A favor',
  neutral: 'Neutral',
  negative: 'En contra',
  unknown: 'Desconocida',
}

export const LEVELS: Level[] = ['C Level', '2nd', '3rd', '4th']
export const ROLES: Role[] = ['EB', 'Champion', 'Coach', 'Influencer', 'Blocker', 'None']
export const ATTITUDES: Attitude[] = ['positive', 'neutral', 'negative', 'unknown']
export const STATUSES: Status[] = ['No contact', 'In contact', 'In process', 'Opportunity']
export const SALES_PLAYS: SalesPlay[] = ['Agentic Readiness', 'Security AI Governance', 'API + AI Monetization']

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function daysSince(date: string | null): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export type Freshness = 'fresh' | 'aging' | 'stale' | 'never'
export function freshness(date: string | null): Freshness {
  const d = daysSince(date)
  if (d === null) return 'never'
  if (d <= 14) return 'fresh'
  if (d <= 45) return 'aging'
  return 'stale'
}

export const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: '#16a34a',
  aging: '#f59e0b',
  stale: '#dc2626',
  never: '#e2e8f0',
}

export function computeGaps(people: Stakeholder[]): Gap[] {
  const gaps: Gap[] = []
  const byId = new Map(people.map((p) => [p.id, p]))

  const ebs = people.filter((p) => p.role === 'EB')
  if (ebs.length === 0) gaps.push({ kind: 'critical', text: 'No hay Economic Buyer identificado.' })
  for (const eb of ebs) {
    if (eb.status === 'No contact') gaps.push({ kind: 'critical', nodeId: eb.id, text: `${eb.name} es EB y no hay contacto.` })
    else if (freshness(eb.lastTouch) === 'stale') gaps.push({ kind: 'warning', nodeId: eb.id, text: `${eb.name} (EB) sin contacto en ${daysSince(eb.lastTouch)} días.` })
  }

  const champs = people.filter((p) => p.role === 'Champion')
  if (champs.length === 0) gaps.push({ kind: 'critical', text: 'No hay Champion. Candidatos: quien tenga actitud a favor y acceso al EB.' })
  for (const c of champs) {
    const f = freshness(c.lastTouch)
    if (f === 'stale' || f === 'never') gaps.push({ kind: 'critical', nodeId: c.id, text: `Champion ${c.name} sin contacto reciente.` })
    const hasEbPath = ebs.some((eb) => pathExists(c, eb, byId))
    if (ebs.length && !hasEbPath) gaps.push({ kind: 'warning', nodeId: c.id, text: `${c.name} (Champion) no tiene línea directa al EB en el chart.` })
  }

  for (const b of people.filter((p) => p.role === 'Blocker')) {
    if (!/mitig|plan/i.test(b.notes)) gaps.push({ kind: 'warning', nodeId: b.id, text: `Blocker ${b.name} sin plan de mitigación en notas.` })
  }

  for (const p of people) {
    if (p.attitude === 'positive' && freshness(p.lastTouch) === 'stale')
      gaps.push({ kind: 'warning', nodeId: p.id, text: `${p.name} está a favor pero lleva ${daysSince(p.lastTouch)} días sin touch.` })
  }

  const roots = people.filter((p) => !p.reportsTo)
  for (const r of roots) {
    const branch = descendants(r.id, people)
    const touched = branch.filter((p) => p.status !== 'No contact')
    if (branch.length >= 3 && touched.length === 0)
      gaps.push({ kind: 'warning', nodeId: r.id, text: `Rama de ${r.name} (${branch.length} personas) sin ningún contacto activo.` })
  }

  const hyp = people.filter((p) => p.reportsTo && p.reportsToConfidence === 'hypothesis').length
  if (hyp) gaps.push({ kind: 'warning', text: `${hyp} líneas de reporte son hipótesis (sin confirmar en reunión).` })

  return gaps
}

export function descendants(rootId: string, people: Stakeholder[]): Stakeholder[] {
  const out: Stakeholder[] = []
  const stack = [rootId]
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const p = people.find((x) => x.id === id)
    if (p) out.push(p)
    for (const c of people.filter((x) => x.reportsTo === id)) stack.push(c.id)
  }
  return out
}

function pathExists(from: Stakeholder, to: Stakeholder, byId: Map<string, Stakeholder>): boolean {
  let cur: Stakeholder | undefined = from
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    if (cur.id === to.id) return true
    if (cur.influences.includes(to.id)) return true
    seen.add(cur.id)
    cur = cur.reportsTo ? byId.get(cur.reportsTo) : undefined
  }
  return false
}

export function isAncestor(maybeAncestor: string, nodeId: string, people: Stakeholder[]): boolean {
  const byId = new Map(people.map((p) => [p.id, p]))
  let cur = byId.get(nodeId)
  const seen = new Set<string>()
  while (cur?.reportsTo && !seen.has(cur.id)) {
    if (cur.reportsTo === maybeAncestor) return true
    seen.add(cur.id)
    cur = byId.get(cur.reportsTo)
  }
  return false
}
