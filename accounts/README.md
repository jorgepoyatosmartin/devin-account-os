# accounts/

Una carpeta por cuenta (`<slug>` en minúsculas). Estructura mínima:

```
accounts/<slug>/
  profile.md          # quién es la cuenta: mercados, value pyramid, organización, partners, competencia
  plan.md             # 3 Whys, MEDDPICC, MAP, red flags, próximos pasos (el CRM manda en stage/importe/fechas)
  stakeholders.yaml   # personas y relaciones — lo lee/escribe apps/power-chart y las Skills
  signals.md          # señales con fecha, fuente y acción (signal-sweep)
  log.md              # cronología de cambios
  cadences/<id>.yaml  # secuencias de outreach por persona (pg-cadence-writer)
```

## `stakeholders.yaml` — schema `stakeholders/v1`

```yaml
account: mapfre
updated: 2026-09-27
schema: stakeholders/v1
stakeholders:
  - id: rtejado                 # slug estable, se usa en reports_to / influences
    name: Raúl Tejado Suárez
    title: Head of Core IT Systems
    level: 3rd                  # C Level | 2nd | 3rd | 4th
    unit: Tecnología
    sales_play: Agentic Readiness
    role: Influencer            # EB | Champion | Coach | Influencer | Blocker | None
    attitude: positive          # positive | neutral | negative | unknown
    influence: 1                # 1 baja · 2 media · 3 alta
    status: In process          # No contact | In contact | In process | Opportunity
    owner: Cata & Jorge
    last_touch: 2026-02-25      # ISO date o null
    reports_to: jcarnero        # id o null (raíz)
    reports_to_confidence: hypothesis   # confirmed | hypothesis
    influences: [iazpeitia]     # ids sobre los que tiene influencia informal
    source: research            # opcional: research | account-plan (default)
    notes: Llamado. Interesado en AI Governance…
```

Reglas:
- `reports_to` no puede crear ciclos.
- Una sola persona con `role: EB` por oportunidad; si hay dudas, la de mayor nivel queda como `None` con `influence: 3`.
- Toda línea de reporte no confirmada en una reunión va como `hypothesis`.
- Las Skills escriben aquí solo vía PR.
