import { dump as yamlDump } from 'js-yaml'
import type { TerritoryPlan } from '../accounts/registry'

export type TerritoryChange = {
  accountId: string
  accountName: string
  territory: TerritoryPlan
}

const TEMPLATE = `Actualiza los planes territoriales en el repo jorgepoyatosmartin/devin-account-os.

Para cada cuenta del resumen, sustituye el contenido completo de \`accounts/<id>/territory.yaml\` por el YAML correspondiente. No inventes ni cambies valores que no estén incluidos.
Abre un PR titulado "Territorio actualizado ({n} cuentas)" con este resumen y no hagas merge.

Resumen:
{summary}

Ficheros (YAML):
\`\`\`yaml
{records}
\`\`\`
`

export function buildTerritoryRepoSavePrompt(changes: TerritoryChange[]) {
  const summary = changes.map(({ accountId, accountName }) => `- ${accountName} (${accountId})`).join('\n')
  const records = changes.map(({ accountId, territory }) => (
    `# accounts/${accountId}/territory.yaml\n${yamlDump(territory, { lineWidth: 120, noRefs: true }).trimEnd()}`
  )).join('\n\n')
  return TEMPLATE
    .replace(/\{n\}/g, () => String(changes.length))
    .replace(/\{summary\}/g, () => summary)
    .replace(/\{records\}/g, () => records)
}
