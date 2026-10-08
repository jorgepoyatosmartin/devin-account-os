Playbook: Account Onboarding — dar de alta una cuenta en devin-account-os

## Overview
Crea `accounts/<slug>/` completo (perfil, plan, stakeholders, señales, log) a partir de un Account Plan (xlsx/slides) o desde cero por research, y deja la cuenta lista para el Power Chart y el resto de playbooks. Encadena las Skills `account-research`, `stakeholder-mapping`, `meddpicc-plan` y `power-map-review`.

## What's Needed From User
- Nombre de la cuenta y `slug` (minúsculas, sin espacios; p.ej. `mapfre`).
- Account Plan adjunto (xlsx con pestaña PG, o enlace a slides) — opcional; si no hay, se hace todo por research.
- Owner (AE) y tier.
- Sales plays a considerar (p.ej. Agentic Readiness, Security AI Governance, API + AI Monetization).

## Procedure
1. Clona `devin-account-os`, crea rama `devin/<timestamp>-onboard-<slug>` y lee `accounts/README.md` (schema) y `accounts/mapfre/` como referencia.
2. Si hay xlsx, extrae con `openpyxl` todas las pestañas; guarda el volcado en `/tmp`, no en el repo.
3. Ejecuta la Skill `account-research` → `accounts/<slug>/profile.md`.
4. Ejecuta la Skill `stakeholder-mapping` con la tabla PG (o la lista de research) → `stakeholders.yaml`. Marca `hypothesis` toda línea de reporte no confirmada; un solo `EB` por oportunidad.
5. Ejecuta la Skill `meddpicc-plan` por cada oportunidad conocida → `plan.md`. Si no hay oportunidad, deja la tabla MEDDPICC en `N` con los sales plays como hipótesis.
6. Crea `signals.md` con las señales que aparezcan en el Account Plan (comentarios de la tabla PG) y `log.md` con la línea de alta.
7. Valida: `(cd apps/power-chart && npm run build)` pasa. Si la cuenta no es MAPFRE, actualiza el import del YAML en `apps/power-chart/src/data/mapfre.ts` o parametriza por `VITE_ACCOUNT` (documenta lo que hagas).
8. Ejecuta la Skill `power-map-review` y pega el resultado en la descripción del PR.
9. Añade la cuenta a la lista del `README.md` raíz.
10. Abre PR `onboard(<slug>): Account Plan FY27 → repo` con: nº de personas, % líneas confirmadas, gaps críticos, hipótesis a confirmar.

## Specifications
- Existen los 5 ficheros + `cadences/` y cumplen el schema `stakeholders/v1`.
- Build del Power Chart en verde.
- Ningún dato inventado: lo no público va como "sin dato" o "hipótesis".
- Validación: abrir el chart y comprobar que el nº de personas coincide con el YAML y que Modo Gaps no da errores.

## Forbidden Actions
- Push directo a `main`.
- Añadir emails, teléfonos o datos personales no profesionales al YAML.
