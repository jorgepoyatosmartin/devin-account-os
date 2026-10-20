---
name: account-research
description: Investiga una cuenta enterprise (mercados, estrategia, iniciativas, organización, partners, competencia) y crea o actualiza accounts/<slug>/profile.md. Usar al dar de alta una cuenta o cuando el perfil tenga más de 90 días.
---

# account-research

## Entrada
- `slug` de la cuenta y, si existe, `accounts/<slug>/profile.md`.
- Opcional: Account Plan (xlsx/slides) adjunto.

## Pasos
1. Lee `accounts/<slug>/profile.md` si existe; anota qué secciones están vacías o con fecha > 90 días.
2. Fuentes, en este orden: informe anual / resultados, notas de prensa corporativas, entrevistas del CIO/CTO/CDO (últimos 18 meses), LinkedIn de C-level y N-1, ofertas de empleo (revelan stack), anuncios de partners y proveedores.
3. Rellena las secciones del template (ver `accounts/README.md`): mercados, value pyramid (objetivo → estrategias → iniciativas → retos → capacidades requeridas), organización, partners, competencia.
4. Cada dato no evidente lleva fuente y fecha entre paréntesis. Lo que sea inferencia va marcado como *hipótesis*.
5. Si detectas personas nuevas relevantes, **no** las añadas al YAML directamente: pásalas a la Skill `stakeholder-mapping` con `source: research`.
6. Añade una línea a `accounts/<slug>/log.md`.

## Salida
PR con `profile.md` (y `log.md`). Título: `research(<slug>): <qué cambió>`. Nunca push directo a main.

## Guardrails
- No inventar cifras. Si no hay dato, escribe "sin dato público".
- Idioma: español, salvo términos comerciales estándar (EB, Champion, MEDDPICC).
