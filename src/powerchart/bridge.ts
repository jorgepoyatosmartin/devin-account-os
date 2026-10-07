import type { Dataset, Level as AppLevel, PowerRole, RelationshipStatus, Stakeholder as AppStakeholder } from '../types'
import type { Role, Stakeholder as ChartStakeholder, Status } from './model'

// Puente entre el schema stakeholders/v1 (YAML / Power Chart) y el modelo legado de la app.
// Ids antiguos de stakeholders.json -> ids del YAML; las referencias (oportunidades, PG, cockpit) se reescriben.
export const LEGACY_ID_ALIAS: Record<string, string> = {
  'mapfre-wiznez': 'swiznez', 'mapfre-escriva': 'vescriva', 'mapfre-solanas': 'msolanas', 'mapfre-bernal': 'jbernal',
  'mapfre-huertas': 'ahuertas', 'mapfre-delicado': 'mdelicado', 'mapfre-ledesma': 'jledesma', 'mapfre-jimenez': 'ljimenez',
  'mapfre-lacave': 'ilacave', 'mapfre-javanovic': 'mjavanovic', 'mapfre-marana': 'jmarana', 'mapfre-andujar': 'gandujar',
  'mapfre-bodas': 'dbodas', 'mapfre-andres-hevia': 'ahevia', 'mapfre-gonzalo-cabanillas': 'gcabanillas',
  'mapfre-enrique-turillo': 'eturillo', 'mapfre-mario-encinar': 'mencinar', 'mapfre-jesus-lopez': 'jlopez',
}

const ROLE_TO_APP: Record<Role, PowerRole> = { EB: 'Economic Buyer', Champion: 'Champion', Coach: 'Coach', Influencer: 'Influencer', Blocker: 'Blocker', None: 'Unknown' }
const APP_TO_ROLE: Record<string, Role> = {
  'Economic Buyer': 'EB', 'Executive Sponsor': 'Influencer', Champion: 'Champion', 'Technical Champion': 'Champion', 'Business Champion': 'Champion',
  Coach: 'Coach', Influencer: 'Influencer', 'Technical Evaluator': 'Influencer', Security: 'Influencer', Procurement: 'Influencer', Legal: 'Influencer', Blocker: 'Blocker',
}
const STATUS_TO_APP: Record<Status, RelationshipStatus> = { 'No contact': 'No contact', 'In contact': 'Contacted', 'In process': 'Engaged', Opportunity: 'Engaged' }
const APP_TO_STATUS: Record<RelationshipStatus, Status> = { 'No contact': 'No contact', Identified: 'No contact', Contacted: 'In contact', Engaged: 'In contact', Champion: 'In process' }
const LEVEL_TO_APP: Record<ChartStakeholder['level'], AppLevel> = { 'C Level': 'Executive Committee', '2nd': 'Senior Leadership', '3rd': 'Director', '4th': 'Manager' }
const INFLUENCE_TO_APP = { 1: 'Low', 2: 'Medium', 3: 'High' } as const

export function toAppStakeholder(p: ChartStakeholder, legacy: AppStakeholder | undefined): AppStakeholder {
  const base: AppStakeholder = legacy ?? {
    id: p.id, accountId: 'mapfre', name: p.name, title: p.title, functionArea: p.unit, responsibilities: '', strategicPriorities: '',
    technologyPriorities: '', relevantInitiatives: [], publicStatements: [], recentActivity: '', potentialPain: '', cognitionRelevance: '',
    relationshipStatus: 'No contact', buyingRole: 'Unknown', sources: [],
  }
  const status = p.role === 'Champion' && p.status !== 'No contact' ? 'Champion' : STATUS_TO_APP[p.status]
  return {
    ...base, id: p.id, name: p.name, title: p.title, functionArea: base.functionArea || p.unit, businessUnit: p.unit,
    relationshipStatus: status, buyingRole: ROLE_TO_APP[p.role], powerRole: ROLE_TO_APP[p.role], roleIsHypothesis: p.reportsToConfidence === 'hypothesis',
    level: LEVEL_TO_APP[p.level], influence: INFLUENCE_TO_APP[p.influence], reportsTo: p.reportsTo ?? undefined,
    dataOrigin: p.external ? 'PUBLIC RESEARCH' : 'TERRITORY PLAN', lastUpdated: p.lastTouch ?? base.lastUpdated,
    recentActivity: p.notes || base.recentActivity,
  }
}

// Traduce una edición hecha en las vistas legadas (tabla de stakeholders, perfil) a campos del chart.
export function appOverrideToChartPatch(path: string, value: unknown): Partial<ChartStakeholder> | null {
  if (path === 'relationshipStatus') return { status: APP_TO_STATUS[value as RelationshipStatus] ?? 'No contact' }
  if (path === 'buyingRole' || path === 'powerRole') return { role: APP_TO_ROLE[String(value)] ?? 'None' }
  if (path === 'recentActivity') return { notes: String(value) }
  return null
}

function remapIds<T>(value: T): T {
  if (typeof value === 'string') return (LEGACY_ID_ALIAS[value] ?? value) as T
  if (Array.isArray(value)) return value.map(remapIds) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapIds(v)])) as T
  return value
}

export function unifyMapfre(dataset: Dataset, people: ChartStakeholder[]): Dataset {
  const legacyById = new Map<string, AppStakeholder>()
  dataset.stakeholders.filter((s) => s.accountId === 'mapfre').forEach((s) => legacyById.set(LEGACY_ID_ALIAS[s.id] ?? s.id, s))
  const mapfre = people.map((p) => toAppStakeholder(p, legacyById.get(p.id)))
  const others = dataset.stakeholders.filter((s) => s.accountId !== 'mapfre')
  return {
    ...remapIds({ ...dataset, stakeholders: [] }),
    stakeholders: [...others, ...mapfre],
  }
}

export const isMapfreChartId = (id: string, people: ChartStakeholder[]) => people.some((p) => p.id === id)
