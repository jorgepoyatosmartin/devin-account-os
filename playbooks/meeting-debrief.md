Playbook: Meeting Debrief — actualizar el repo tras una reunión

## Overview
Convierte las notas o transcripción de una reunión en cambios concretos en el repo: stakeholders (roles, actitud, líneas confirmadas, touch), plan (MEDDPICC, MAP), señales y log. Es el playbook que mantiene la memoria viva.

## What's Needed From User
- `slug`, fecha, asistentes.
- Notas o transcripción (texto pegado o adjunto).
- Brief previo si existe (`accounts/<slug>/briefs/`).

## Procedure
1. Lee las notas y el brief previo; lista hechos (dichos por el cliente) separados de interpretaciones.
2. Ejecuta `stakeholder-mapping`: actualiza `last_touch` de los asistentes a la fecha; cambia `reports_to_confidence` a `confirmed` solo para lo dicho explícitamente; ajusta `attitude`/`role` con evidencia y anótala en `notes`.
3. Ejecuta `meddpicc-plan`: mueve letras Y/M/N con la cita del cliente; actualiza MAP y red flags; añade próximos pasos con owner y fecha.
4. Añade a `signals.md` cualquier señal nueva (proyectos, presupuesto, competidores mencionados, cambios organizativos).
5. Añade a `log.md` una entrada de 3-5 líneas: resultado, compromisos de cada parte, siguiente hito.
6. Si se acordó una cadencia o seguimiento con alguien, crea/actualiza `cadences/<id>.yaml` con `pg-cadence-writer` (draft).
7. Ejecuta `power-map-review` y `deal-risk-review`; incluye ambos resúmenes en el PR.
8. Abre PR `debrief(<slug>): <fecha> <tema>` con diff de MEDDPICC (p.ej. `Champion N → M`) y lista de hipótesis confirmadas/refutadas.

## Specifications
- Todo cambio en el YAML o plan tiene evidencia en las notas (cita o referencia).
- `updated` del YAML y build del chart actualizados.
- Validación: `git diff` solo toca `accounts/<slug>/`; el build pasa.

## Forbidden Actions
- Subir la transcripción completa al repo (solo el resumen).
- Marcar `confirmed` por inferencia.
