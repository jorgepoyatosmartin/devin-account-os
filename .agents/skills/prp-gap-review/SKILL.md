---
name: prp-gap-review
description: Revisión semanal del gap PRP (cuota oficial y objetivo personal) frente al pipeline: qué oportunidades acelerar, cuánta PG generar y en qué cuentas. Usar en la revisión semanal o cuando el usuario pregunta "¿llego a cuota / al objetivo?".
---

# prp-gap-review

## Entrada
- Pipeline por oportunidad: importe, moneda, fecha de cierre, stage, forecast category (export JSON de la app o lo que indique el usuario).
- Plan de comisiones y objetivo personal: **solo si el usuario los aporta en la sesión**. Nunca están en el repo (repo público).
- `config/stages.yaml`, `config/funnel.yaml`, `config/scenarios.yaml`, `accounts/*/territory.yaml`.

## Pasos
1. Calcula cerrado, pipeline total, ponderado (importe × probabilidad del stage), Commit y Best Case del año fiscal (enero-diciembre). Convierte USD a EUR con el `fxEurUsd` del plan.
2. Gap a cuota y gap al objetivo personal; pipeline necesario = gap × cobertura, por escenario de `scenarios.yaml`.
3. Top 3 oportunidades a acelerar: abiertas con cierre en ≤ 90 días, ordenadas por impacto en el gap (importe × probabilidad). Para cada una, el siguiente criterio de salida pendiente.
4. PG necesaria: pipeline a crear por semana hasta fin de año y reparto por cuenta según tier/potencial/esfuerzo de `territory.yaml`; embudo inverso DM → NBM → TFW → BVA/TV → WON con `funnel.yaml`.
5. Lista los datos que faltan (oportunidades sin importe o fecha) como primera acción.

## Salida
Markdown en el chat: tabla de KPIs (cuota, cerrado, gap, ponderado, Commit) por escenario → 3 oportunidades a acelerar con acción → objetivo semanal de PG por cuenta → datos que faltan.

## Guardrails
- No escribas cuota, tramos, comisiones ni objetivo personal en ningún fichero del repo ni en PRs.
- Si no hay plan de comisiones, calcula solo frente a pipeline y dilo explícitamente.
- No cambies stage, importe ni fecha de ninguna oportunidad.
