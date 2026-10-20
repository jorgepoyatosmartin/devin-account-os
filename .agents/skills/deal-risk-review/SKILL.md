---
name: deal-risk-review
description: Revisión de riesgo de una oportunidad a partir de plan.md, stakeholders.yaml y signals.md: puntúa MEDDPICC, detecta incoherencias (EB sin contacto, MAP sin fechas, hitos vencidos) y propone 3 acciones. Usar en el deal review semanal o antes de comprometer forecast.
---

# deal-risk-review

## Entrada
`accounts/<slug>/plan.md` (oportunidad concreta), `stakeholders.yaml`, `signals.md`, y del CRM: stage, importe, fecha de cierre (si no están disponibles, indícalo en la salida).

## Checks
1. **MEDDPICC score**: Y = 2, M = 1, N = 0 sobre 16. < 8 → riesgo alto; 8-12 → medio; > 12 → bajo.
2. **EB**: existe en el YAML, `status != No contact`, touch < 30 días.
3. **Champion**: existe, cumple criterios de `stakeholder-mapping`, y ha hecho algo verificable (intro, reunión interna, doc compartido).
4. **MAP**: todos los hitos con fecha y owner; ninguno vencido sin nota; el hito de firma tiene ≥ 2 semanas de holgura respecto al kick-off.
5. **Paper process**: si es `N` y la fecha de cierre está a < 90 días → riesgo alto automático.
6. **Competencia**: si es `N` o "desarrollo propio" sin plan de diferenciación → red flag.
7. **Señales negativas** en `signals.md` de los últimos 30 días (reorganización, congelación de presupuesto, salida de un stakeholder clave).
8. **Coherencia** entre plan y CRM (stage vs. estado MEDDPICC: p.ej. stage "Negotiation" con Champion `N`).

## Salida
Markdown: semáforo (verde/ámbar/rojo) + score → 3 riesgos principales con evidencia → 3 acciones para 7 días (owner, persona del cliente, resultado esperado) → pregunta que el manager debería hacer en el review.
Publicar en el canal de la cuenta y añadir resumen de 1 línea a `log.md`.

## Guardrails
- No cambies stage, importe ni fecha: eso es del CRM.
- Si el plan no tiene la sección MEDDPICC, para y pide ejecutar `meddpicc-plan` primero.
