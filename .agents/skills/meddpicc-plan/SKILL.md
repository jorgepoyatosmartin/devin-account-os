---
name: meddpicc-plan
description: Crea o actualiza la sección de oportunidad de accounts/<slug>/plan.md (3 Whys, tabla MEDDPICC con estado Y/M/N, Mutual Action Plan, red flags). Usar al abrir una oportunidad, tras una reunión de discovery o en el deal review.
---

# meddpicc-plan

## Entrada
`accounts/<slug>/plan.md`, `stakeholders.yaml`, notas de reunión o transcripción, y el stage/importe/fecha del CRM (no los inventes; si no los tienes, deja `<CRM>`).

## Pasos
1. **3 Whys** — una frase por pregunta, con la evidencia del cliente entre comillas cuando exista:
   - Why anything? (dolor identificado y coste de no actuar)
   - Why now? (evento forzoso: presupuesto, regulación, calendario)
   - Why nosotros? (capacidad diferencial vs. alternativa)
2. **MEDDPICC** — tabla con columnas Letra · Estado (Y = validado por el cliente, M = parcial/inferido, N = desconocido) · Detalle. El EB y el Champion deben referenciar ids de `stakeholders.yaml`.
3. **MAP** — lista numerada con fecha, hito, owner (cliente y nuestro). Cada hito de validación necesita criterios de "pass" explícitos.
4. **Red flags** — tabla Riesgo · Quién · Mitigación. Todo `N` en MEDDPICC es al menos un red flag.
5. **Próximos pasos** — checkboxes con owner y fecha.
6. Coherencia: si el plan nombra EB/Champion que no coincide con el YAML, avisa en el PR y no lo arregles en silencio.
7. Línea en `log.md`.

## Salida
PR `plan(<slug>): <oportunidad> — <qué cambió>`. Descripción: diff de estados MEDDPICC (p.ej. `Champion N → M`).
