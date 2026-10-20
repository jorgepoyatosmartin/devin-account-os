---
name: pg-cadence-writer
description: Genera una cadencia de outreach personalizada (email + LinkedIn + llamada, 4-6 toques) para un stakeholder concreto y la guarda en accounts/<slug>/cadences/<id>.yaml. Usar desde el Power Chart ("Generar cadencia") o en la activación de PG por sales play.
---

# pg-cadence-writer

## Entrada
`slug`, `id` del stakeholder, y de contexto: `stakeholders.yaml` (persona, unidad, rol, notas, sales play), `profile.md` (iniciativas y retos), `signals.md` (gancho reciente), `plays/<sales-play>.md` si existe.

## Estructura de la cadencia (`cadences/<id>.yaml`)
```yaml
stakeholder: rtejado
sales_play: Agentic Readiness
owner: Cata & Jorge
status: draft            # draft | approved | running | done
hook: <la señal o dolor concreto que justifica escribirle ahora>
steps:
  - day: 0
    channel: email       # email | linkedin | call | event
    subject: <≤ 60 caracteres>
    body: |
      <≤ 120 palabras>
  - day: 3
    channel: linkedin
    body: <≤ 300 caracteres>
  - day: 7
    channel: call
    body: <guion de 30 segundos + 2 preguntas de discovery>
```

## Reglas de redacción
- Español de negocio, tú/usted según el nivel (C Level → usted).
- Primer email: 1 frase de contexto sobre *ellos* (iniciativa, cita pública o señal), 1 frase de valor ligada a su unidad, 1 pregunta cerrada para reunión. Sin bullets, sin adjetivos de marketing.
- Cada toque aporta algo nuevo (dato, caso, pregunta); nunca "solo hacía seguimiento".
- Si la persona tiene `attitude: negative`, la cadencia es de *desescalada*: pedir su criterio, no vender.
- No prometer funcionalidades ni cifras que no estén en `battlecards/` o `plays/`.

## Salida
PR `cadence(<slug>): <nombre>`. El envío lo hace el AE (o el motor de secuencias) tras aprobar: esta Skill no envía nada.
