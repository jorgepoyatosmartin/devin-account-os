Playbook: Meeting Brief — preparar una reunión con la cuenta

## Overview
Produce un brief de 1 página para una reunión concreta: quién viene, qué sabemos, qué queremos sacar, preguntas de discovery y riesgos. Usa el repo como memoria y `power-map-review` para el mapa de poder.

## What's Needed From User
- `slug`, fecha de la reunión y asistentes del cliente (nombres o ids del YAML).
- Objetivo de la reunión (discovery, demo, POC scoping, negociación).
- Opcional: agenda o invitación.

## Procedure
1. Lee `accounts/<slug>/profile.md`, `plan.md`, `stakeholders.yaml`, `signals.md` y `log.md` (últimas 10 líneas).
2. Para cada asistente: ficha de 3 líneas (cargo, rol MEDDPICC, actitud, último touch, notas) y si es hipótesis su línea de reporte, márcalo para confirmar en la reunión.
3. Si algún asistente no está en el YAML, investígalo (LinkedIn público, prensa) y proponlo con `source: research` para `stakeholder-mapping`.
4. Ejecuta `power-map-review` limitado a los asistentes y su rama.
5. Redacta el brief: objetivo y resultado mínimo · asistentes · contexto de la cuenta en 5 bullets · estado MEDDPICC y qué letra queremos mover · 6-8 preguntas de discovery (ordenadas por letra MEDDPICC) · riesgos y objeciones esperadas con respuesta · próximos pasos a proponer al cierre.
6. Guarda en `accounts/<slug>/briefs/<YYYY-MM-DD>-<tema>.md` y añade línea a `log.md`.
7. Abre PR `brief(<slug>): <fecha> <tema>` y pega el brief completo en la descripción.

## Specifications
- ≤ 1 página (≈ 600 palabras), en español.
- Cada pregunta de discovery apunta a una letra MEDDPICC concreta.
- Las hipótesis a confirmar aparecen como checklist al final.
- Validación: el brief no contiene afirmaciones sin fuente en el repo o en research citado.

## Advice and Pointers
- Si la reunión es con el EB, el brief empieza por *Why now* y el MAP, no por producto.
- Si hay un `Blocker` entre los asistentes, incluye su `Mitigación:` explícita.
