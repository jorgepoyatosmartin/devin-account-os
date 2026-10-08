import { dump as yamlDump } from 'js-yaml'
import { ACCOUNT, MAPFRE_UPDATED } from './data/mapfre'
import type { Stakeholder } from './model'

export function toYamlRecord(p: Stakeholder): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    title: p.title,
    level: p.level,
    unit: p.unit,
    ...(p.businessUnit ? { business_unit: p.businessUnit } : {}),
    ...(p.country ? { country: p.country } : {}),
    sales_play: p.salesPlay,
    role: p.role,
    attitude: p.attitude,
    influence: p.influence,
    status: p.status,
    owner: p.owner,
    last_touch: p.lastTouch,
    reports_to: p.reportsTo,
    reports_to_confidence: p.reportsToConfidence,
    influences: p.influences,
    ...(p.external ? { source: 'research' } : {}),
    ...(p.departed ? { departed: true } : {}),
    ...(p.responsibilities ? { responsibilities: p.responsibilities } : {}),
    ...(p.priorities ? { priorities: p.priorities } : {}),
    ...(p.notes ? { notes: p.notes } : {}),
  }
}

export function toYamlText(people: Stakeholder[], account: string) {
  const doc = {
    account,
    updated: account === ACCOUNT ? MAPFRE_UPDATED : new Date().toISOString().slice(0, 10),
    schema: 'stakeholders/v1',
    stakeholders: people.map(toYamlRecord),
  }
  return `# Fuente de verdad de stakeholders de ${account.toUpperCase()}. Editar aquí o desde apps/power-chart (Exportar YAML).\n` +
    yamlDump(doc, { lineWidth: 120, noRefs: true })
}
