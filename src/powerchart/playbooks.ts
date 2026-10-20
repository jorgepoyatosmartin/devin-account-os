import type { Stakeholder } from './model'

export const DEVIN_URL = 'https://app.devin.ai/'

type Action = 'cadence' | 'brief' | 'team'

const MACRO: Record<Action, string> = {
  cadence: '!pg_activation',
  brief: '!meeting_brief',
  team: '!onboard_account',
}

function context(account: string, p: Stakeholder): string {
  return [
    `Cuenta: ${account} (repo devin-account-os, accounts/${account}/)`,
    `Persona: ${p.name} — ${p.title} (id: ${p.id}, nivel ${p.level}, unidad ${p.unit})`,
    `Rol MEDDPICC: ${p.role} · actitud: ${p.attitude} · influencia: ${p.influence} · estado PG: ${p.status}`,
    `Sales play: ${p.salesPlay} · owner: ${p.owner} · último touch: ${p.lastTouch ?? 'nunca'}`,
    p.reportsTo ? `Reporta a: ${p.reportsTo} (${p.reportsToConfidence})` : 'Sin línea de reporte conocida',
    p.notes ? `Notas: ${p.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildPrompt(action: Action, account: string, p: Stakeholder): string {
  const ctx = context(account, p)
  switch (action) {
    case 'cadence':
      return `${MACRO.cadence}\nActiva solo a esta persona (N=1) con la Skill pg-cadence-writer; cadencia en draft, no envíes nada.\n\n${ctx}`
    case 'brief':
      return `${MACRO.brief}\nBrief de 1 página centrado en esta persona (sin fecha de reunión fija: prepárame el próximo contacto).\n\n${ctx}`
    case 'team':
      return `Usa la Skill stakeholder-mapping sobre accounts/${account}/stakeholders.yaml: busca en fuentes públicas quién más hay en el equipo de esta persona (reports directos y pares), añádelos con source: research y reports_to_confidence: hypothesis, y abre PR.\n\n${ctx}`
  }
}

export async function launchPlaybook(action: Action, account: string, p: Stakeholder): Promise<{ prompt: string; copied: boolean }> {
  const prompt = buildPrompt(action, account, p)
  let copied = false
  try {
    await navigator.clipboard.writeText(prompt)
    copied = true
  } catch {
    copied = false
  }
  if (copied) window.open(DEVIN_URL, '_blank', 'noopener')
  return { prompt, copied }
}
