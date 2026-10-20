---
name: signal-sweep
description: Barrido periódico de señales de una cuenta (noticias, nombramientos, ofertas de empleo, regulación, eventos, actividad LinkedIn de stakeholders) y registro en accounts/<slug>/signals.md con acción sugerida. Usar en automations semanales o antes de una cadencia.
---

# signal-sweep

## Entrada
`accounts/<slug>/profile.md` (para contexto), `stakeholders.yaml` (nombres a vigilar), `signals.md` (para no duplicar), ventana temporal (default: 7 días).

## Fuentes
Noticias corporativas y prensa sectorial · nombramientos y cambios de cargo (LinkedIn público) · ofertas de empleo (stack, proyectos) · regulación aplicable (EU AI Act, DORA, sectorial) · eventos donde hablen los stakeholders · resultados trimestrales.

## Pasos
1. Busca por nombre de la cuenta y por cada stakeholder con `influence >= 2`.
2. Descarta lo que ya esté en `signals.md` (misma fuente o mismo hecho).
3. Para cada señal nueva escribe una línea: `- YYYY-MM-DD · fuente · persona/área · señal → acción` donde la acción es concreta (a quién contactar, con qué gancho, qué actualizar en el plan).
4. Si una señal cambia la organización (nombramiento, salida), abre además una tarea para `stakeholder-mapping`.
5. Si una señal afecta al *Why now* de una oportunidad, márcala con `⚑` y menciónala en la descripción del PR.

## Salida
PR `signals(<slug>): <n> señales` o, si no hay nada nuevo, ningún PR y un mensaje corto en el canal de la cuenta ("sin señales nuevas esta semana").

## Guardrails
- Solo información pública. Nada de scraping de perfiles privados ni de datos personales no profesionales.
- Máximo 10 señales por barrido; prioriza por impacto en las oportunidades abiertas.
