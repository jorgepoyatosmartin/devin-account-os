# devin-account-os
AI-powered Enterprise Account OS built with Devin for account intelligence, sales execution, pipeline generation, and strategic account management.

Este repo es la **memoria compartida** del OS: Devin es el runtime, las Skills son las capacidades, los Playbooks los trabajos completos y el CRM conserva stage/importe/fechas. Visión completa en [`docs/vision-enterprise-sales-os.md`](docs/vision-enterprise-sales-os.md).

```
accounts/<slug>/        estado por cuenta: profile.md, plan.md, stakeholders.yaml, signals.md, log.md, cadences/
.agents/skills/         Skills de Devin (se cargan automáticamente en cada sesión que clona el repo)
apps/power-chart/       Power Chart interactivo (React Flow) que lee/escribe stakeholders.yaml
docs/                   visión, decisiones
```

## Skills

| Skill | Qué hace | Escribe en |
|---|---|---|
| `account-research` | Investiga la cuenta y rellena el perfil | `profile.md` |
| `stakeholder-mapping` | Crea/actualiza personas, jerarquía y roles MEDDPICC | `stakeholders.yaml` |
| `power-map-review` | Gaps, candidatos a champion, camino al EB | Slack / `log.md` |
| `meddpicc-plan` | 3 Whys, MEDDPICC, MAP, red flags de una oportunidad | `plan.md` |
| `signal-sweep` | Barrido de señales públicas con acción sugerida | `signals.md` |
| `pg-cadence-writer` | Cadencia de outreach por persona (no envía) | `cadences/<id>.yaml` |
| `deal-risk-review` | Semáforo de riesgo de la oportunidad + 3 acciones | Slack / `log.md` |

Toda escritura de una Skill pasa por PR; nada va directo a `main`.

## Power Chart

```
cd apps/power-chart && npm install && npm run dev   # http://localhost:5173
```

Lee `accounts/mapfre/stakeholders.yaml`. Arrastra una tarjeta sobre otra para cambiar a quién reporta; "Exportar YAML" genera el fichero para sustituir el del repo y abrir PR.

## Cuentas

- [MAPFRE](accounts/mapfre/) — Tier 1, FY27
