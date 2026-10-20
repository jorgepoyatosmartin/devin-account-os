---
name: power-map-review
description: Lee accounts/<slug>/stakeholders.yaml y produce una revisión del mapa de poder: gaps MEDDPICC, candidatos a champion, camino al Economic Buyer y 3 acciones concretas. Usar antes de una reunión importante, en la revisión semanal de cuenta o cuando el AE pida "revisa el power map".
---

# power-map-review

## Entrada
`accounts/<slug>/stakeholders.yaml`, `plan.md` (sección MEDDPICC) y `signals.md`.

## Análisis (mismo criterio que `apps/power-chart/src/model.ts::computeGaps`)
1. **EB**: ¿hay `role: EB`? ¿Tiene `status != No contact`? Si no, gap crítico.
2. **Champion**: ¿existe? ¿Tiene touch < 45 días y ruta al EB? Si no hay, lista candidatos: `attitude: positive` ordenados por (influencia, cercanía al EB en saltos de `reports_to`/`influences`).
3. **Blockers**: cada `attitude: negative` debe tener `Mitigación:` en notas.
4. **Frescura**: personas `positive` con `last_touch` > 45 días o null.
5. **Cobertura**: ramas (subárbol de cada C Level) sin ningún `status != No contact`. Relaciónalas con el sales play que bloquean.
6. **Confianza**: % de `reports_to_confidence: hypothesis`. Propón las 3-5 que más importa confirmar (las que están en el camino al EB).
7. **Camino al poder**: para cada candidato a champion, la ruta más corta hasta el EB y quién puede hacer la intro.

## Salida
Markdown con este orden: veredicto en 2 líneas → gaps críticos → candidatos a champion con ruta → 3 acciones para esta semana (persona, canal, mensaje en 1 línea, owner) → hipótesis a confirmar.
Publicar en el canal Slack de la cuenta si existe; si no, en `accounts/<slug>/log.md` bajo la fecha.

## Guardrails
- No cambies el YAML desde esta Skill; si detectas errores, propón el diff y deja que `stakeholder-mapping` lo aplique.
- Sé concreto: nombres, no "trabajar con el equipo de datos".
