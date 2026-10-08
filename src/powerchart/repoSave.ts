import { dump as yamlDump } from 'js-yaml'
import type { Stakeholder } from './model'
import { toYamlRecord } from './yaml'

export const REPO_SAVE_TEMPLATE = `Actualiza la fuente de verdad de stakeholders de {ACCOUNT_UPPER} en el repo jorgepoyatosmartin/devin-account-os.

Fichero: accounts/{account}/stakeholders.yaml (schema stakeholders/v1). Trabaja sobre la rama por defecto; si allí no existe el fichero, usa la rama del PR abierto que lo contiene.

Aplica exactamente estos cambios, hechos por el AE desde el Power Chart:
- Busca cada registro por \`id\`. Si existe, sustitúyelo entero por el registro de abajo; si no existe, añádelo al final de \`stakeholders\`.
- No borres a nadie: las bajas llevan \`departed: true\` y \`status: No contact\`.
- No toques ningún otro registro ni reordenes el fichero. Pon \`updated\` a la fecha de hoy.
- Comprueba que el YAML parsea y que todos los \`reports_to\` e \`influences\` apuntan a ids existentes.
- Abre un PR titulado "{ACCOUNT_UPPER}: stakeholders actualizados desde el Power Chart ({n} cambios)" con el resumen de cambios en la descripción. No hagas merge.

Resumen de cambios:
{summary}

Registros (YAML):
\`\`\`yaml
{records}
\`\`\`
`

export function buildRepoSavePrompt(account: string, people: Stakeholder[], summary: string) {
  const records = yamlDump(people.map(toYamlRecord), { lineWidth: 120, noRefs: true }).trimEnd()
  return REPO_SAVE_TEMPLATE
    .replace(/\{ACCOUNT_UPPER\}/g, account.toUpperCase())
    .replace(/\{account\}/g, account)
    .replace(/\{n\}/g, String(people.length))
    .replace(/\{summary\}/g, summary)
    .replace(/\{records\}/g, records)
}
