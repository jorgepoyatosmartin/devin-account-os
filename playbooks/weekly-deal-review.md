Playbook: Weekly Deal Review — revisión semanal de una cuenta u oportunidad

## Overview
Cada semana produce un informe corto de riesgo y cobertura para una cuenta: semáforo MEDDPICC, gaps del mapa de poder, señales nuevas y 3 acciones. Pensado para lanzarse como Automation semanal o a demanda antes del forecast. Sin integraciones: la salida va al PR/`log.md` y a Slack si existe.

## What's Needed From User
- `slug` (o lista de slugs). Opcional: oportunidad concreta y datos del CRM (stage, importe, fecha de cierre) pegados a mano.

## Procedure
1. Lee `accounts/<slug>/plan.md`, `stakeholders.yaml`, `signals.md`, `log.md` y `cadences/*.yaml`.
2. Ejecuta `signal-sweep` (ventana 7 días).
3. Ejecuta `deal-risk-review` sobre la oportunidad principal.
4. Ejecuta `power-map-review`.
5. Revisa cadencias: `draft` > 7 días sin aprobar y `running` con siguiente toque vencido → listarlas.
6. Compón el informe (≤ 300 palabras): semáforo + score · 3 riesgos · 3 acciones (owner, persona, fecha) · señales ⚑ · cadencias atascadas · hipótesis a confirmar esta semana.
7. Añade el informe a `accounts/<slug>/log.md` bajo `## Review YYYY-MM-DD` y, si hubo señales nuevas, actualiza `signals.md`.
8. Abre PR `review(<slug>): semana <YYYY-Www>` con el informe como descripción; publica el mismo texto en el canal Slack de la cuenta si existe.

## Specifications
- Un solo PR por cuenta y semana; si no hay cambios en señales/plan, el PR solo toca `log.md`.
- Las acciones nombran a personas concretas del YAML.
- Validación: el semáforo coincide con el score calculado en `deal-risk-review` (< 8 rojo, 8-12 ámbar, > 12 verde).

## Advice and Pointers
- Presupuesto: una sesión por cuenta; si se lanza para varias cuentas, usar un Workflow con lotes por tier y journal reanudable (ver `docs/vision-enterprise-sales-os.md`).
