Playbook: PG Activation — activar prospección para un sales play en una cuenta

## Overview
Selecciona los stakeholders de un sales play que toca trabajar ahora, genera una cadencia por persona con `pg-cadence-writer` y deja todo en borrador para que el AE apruebe y envíe. No envía nada.

## What's Needed From User
- `slug` de la cuenta y sales play.
- Nº máximo de personas a activar (default 5) y owner.
- Restricciones: personas a excluir, tono, idioma.

## Procedure
1. Lee `accounts/<slug>/stakeholders.yaml`, `plan.md`, `signals.md`, `profile.md` y `plays/<sales-play>.md` si existe.
2. Ejecuta la Skill `signal-sweep` (ventana 14 días) para tener ganchos frescos.
3. Prioriza candidatos del sales play: (a) `status: In process | In contact` con `last_touch` > 30 d, (b) `attitude: positive` sin contacto, (c) `influence: 3` sin contacto, (d) resto. Excluye `Blocker` y quien tenga cadencia `running`.
4. Para cada uno de los N elegidos, ejecuta `pg-cadence-writer` → `cadences/<id>.yaml` con `status: draft` y un `hook` explícito.
5. Comprueba que ninguna cadencia repite el mismo email literal; personaliza al menos la primera frase.
6. Actualiza `plan.md` → sección "PG — estado" y `log.md`.
7. Abre PR `pg(<slug>): activación <sales play> — N cadencias` con una tabla persona · hook · primer toque · fecha sugerida.
8. Publica en el canal Slack de la cuenta (si existe) un resumen de 5 líneas con el enlace al PR.

## Specifications
- N ficheros `cadences/<id>.yaml` válidos con 4-6 toques y `status: draft`.
- Cada cadencia referencia una señal o dolor concreto (no genérico).
- Validación: `python3 -c "import yaml,glob;[yaml.safe_load(open(f)) for f in glob.glob('accounts/<slug>/cadences/*.yaml')]"` sin errores.

## Forbidden Actions
- Enviar emails, mensajes de LinkedIn o crear borradores en Gmail (fase sin integraciones).
- Cambiar `role`, `attitude` o `reports_to` en el YAML desde este playbook (eso es `stakeholder-mapping`).
