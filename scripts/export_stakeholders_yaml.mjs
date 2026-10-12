import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dump } from 'js-yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const accounts = JSON.parse(readFileSync(resolve(root, 'src/data/accounts.json'), 'utf8'))
const stakeholders = JSON.parse(readFileSync(resolve(root, 'src/data/stakeholders.json'), 'utf8'))
const salesPlays = new Set(['Agentic Readiness', 'Security AI Governance', 'API + AI Monetization'])
const roleMap = {
  'Economic Buyer': 'EB',
  'Executive Sponsor': 'Influencer',
  Champion: 'Champion',
  'Technical Champion': 'Champion',
  'Business Champion': 'Champion',
  Influencer: 'Influencer',
  'Technical Evaluator': 'Influencer',
  Security: 'Influencer',
  Procurement: 'Influencer',
  Legal: 'Influencer',
  Coach: 'Coach',
  Blocker: 'Blocker',
}
const levelMap = {
  'Board / CEO': 'C Level',
  'Executive Committee': 'C Level',
  'Senior Leadership': '2nd',
  Director: '3rd',
  Manager: '4th',
  'Individual Contributor': '4th',
}
const statusMap = {
  'No contact': 'No contact',
  Identified: 'No contact',
  Contacted: 'In contact',
  Engaged: 'In contact',
  Champion: 'In process',
}
const influenceMap = { Low: 1, Medium: 2, High: 3, Unknown: 2 }
const dumpYaml = (value) => dump(value, { lineWidth: 120, noRefs: true })
const output = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

for (const account of accounts) {
  const folder = resolve(root, 'accounts', account.id)
  const country = account.headquarters.match(/,\s*([^,]+)$/)?.[1] ?? null
  const accountYaml = {
    id: account.id,
    name: account.name,
    sector: account.sector,
    headquarters: account.headquarters,
    country,
    businessUnits: account.businessUnits ?? [],
  }
  output(resolve(folder, 'account.yaml'), dumpYaml(accountYaml))

  const source = account.territory ?? {}
  const territoryYaml = {
    tier: source.tier ?? null,
    potentialEur: source.potentialEur ?? null,
    effortPct: source.effortPct ?? null,
    segment: source.segment ?? null,
    priority: source.priority ?? null,
    rationale: source.rationale ?? '',
    evidence: source.evidence ?? [],
  }
  output(resolve(folder, 'territory.yaml'), dumpYaml(territoryYaml))

  if (account.id === 'mapfre') continue
  const people = stakeholders
    .filter((person) => person.accountId === account.id)
    .map((person) => {
      const sourceRole = person.powerRole && person.powerRole !== 'Unknown'
        ? person.powerRole
        : person.buyingRole
      const lastTouch = person.lastTouch ?? null
      const reportsTo = person.reportsTo ?? null
      const salesPlay = salesPlays.has(person.excel?.salesPlay)
        ? person.excel.salesPlay
        : 'Agentic Readiness'
      return {
        id: person.id,
        name: person.name,
        title: person.title,
        level: levelMap[person.level] ?? '3rd',
        unit: person.functionArea || person.businessUnit || 'Sin asignar',
        business_unit: person.businessUnit || person.functionArea || 'Sin asignar',
        sales_play: salesPlay,
        role: roleMap[sourceRole] ?? 'None',
        attitude: 'unknown',
        influence: influenceMap[person.influence] ?? 2,
        status: statusMap[person.relationshipStatus] ?? 'No contact',
        owner: '',
        last_touch: lastTouch,
        reports_to: reportsTo,
        reports_to_confidence: reportsTo
          ? (person.roleIsHypothesis ? 'hypothesis' : 'confirmed')
          : 'hypothesis',
        influences: [],
        ...(person.dataOrigin === 'PUBLIC RESEARCH' ? { source: 'research' } : {}),
        ...(person.responsibilities && !/^UNKNOWN(?: — VALIDATION REQUIRED)?$/.test(person.responsibilities)
          ? { responsibilities: person.responsibilities }
          : {}),
        ...(person.strategicPriorities && !/^UNKNOWN(?: — VALIDATION REQUIRED)?$/.test(person.strategicPriorities)
          ? { priorities: person.strategicPriorities }
          : {}),
        ...(person.recentActivity && person.recentActivity !== 'UNKNOWN'
          ? { notes: person.recentActivity }
          : {}),
      }
    })
  const doc = { account: account.id, updated: new Date().toISOString().slice(0, 10), schema: 'stakeholders/v1', stakeholders: people }
  output(
    resolve(folder, 'stakeholders.yaml'),
    `# Fuente de verdad de stakeholders de ${account.name.toUpperCase()}.\n${dumpYaml(doc)}`,
  )
}

const template = resolve(root, 'accounts/_template')
output(resolve(template, 'account.yaml'), dumpYaml({
  id: '',
  name: '',
  sector: '',
  headquarters: '',
  country: null,
  businessUnits: [],
}))
output(resolve(template, 'territory.yaml'), dumpYaml({
  tier: null,
  potentialEur: null,
  effortPct: null,
  segment: null,
  priority: null,
  rationale: '',
  evidence: [],
}))
output(
  resolve(template, 'stakeholders.yaml'),
  `account: ''\nupdated: '${new Date().toISOString().slice(0, 10)}'\nschema: stakeholders/v1\nstakeholders: []\n`,
)
output(
  resolve(template, 'README.md'),
  '# Add an account\n\nCopy this folder to `accounts/<id>/`, fill in the account and territory YAML, then add stakeholder records using the `stakeholders/v1` schema. The Vite account registry discovers folders containing `account.yaml`; no application code changes are needed.\n',
)
