import { load as yamlLoad } from 'js-yaml'
import type { Stakeholder } from '../model'
import raw from '../../../accounts/mapfre/stakeholders.yaml?raw'

// Fuente de verdad: accounts/mapfre/stakeholders.yaml (schema stakeholders/v1).
// Este módulo solo traduce snake_case (YAML) -> camelCase (modelo de la app).
type YamlStakeholder = {
  id: string
  name: string
  title: string
  level: Stakeholder['level']
  unit: string
  sales_play: Stakeholder['salesPlay']
  role: Stakeholder['role']
  attitude: Stakeholder['attitude']
  influence: Stakeholder['influence']
  status: Stakeholder['status']
  owner: string
  last_touch: string | null
  reports_to: string | null
  reports_to_confidence: Stakeholder['reportsToConfidence']
  influences?: string[]
  source?: 'research' | 'account-plan'
  notes?: string
}

type YamlDoc = { account: string; updated: string; schema: string; stakeholders: YamlStakeholder[] }

const doc = yamlLoad(raw) as YamlDoc

export const ACCOUNT = doc.account

// Hash del YAML empaquetado: invalida snapshots locales cuando cambia la fuente.
export const MAPFRE_VERSION: string = (() => {
  let h = 0
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0
  return h.toString(16)
})()

export const MAPFRE: Stakeholder[] = doc.stakeholders.map((s) => ({
  id: s.id,
  name: s.name,
  title: s.title,
  level: s.level,
  unit: s.unit,
  salesPlay: s.sales_play,
  role: s.role,
  attitude: s.attitude,
  influence: s.influence,
  status: s.status,
  owner: s.owner,
  lastTouch: s.last_touch,
  reportsTo: s.reports_to,
  reportsToConfidence: s.reports_to_confidence,
  influences: s.influences ?? [],
  notes: s.notes ?? '',
  external: s.source === 'research',
}))
