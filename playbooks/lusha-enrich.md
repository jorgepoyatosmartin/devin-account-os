Playbook: Lusha Enrich — enriquecer stakeholders y detectar cambios de puesto con Lusha

## Overview
Para una cuenta, contrasta `accounts/<slug>/stakeholders.yaml` con Lusha (MCP oficial `https://mcp.lusha.com`, cabecera `x-api-key: $LUSHA_API_KEY`): detecta salidas y cambios de puesto, propone personas nuevas por rol objetivo y abre un PR con los cambios para revisión humana. Nunca contacta a nadie.

## What's Needed From User
- `slug` de la cuenta.
- Modo: `refresh` (solo personas existentes) o `discover` (además, buscar nuevos por rol/unidad).
- Tope de créditos Lusha para esta ejecución (default 25 revelaciones).

## Procedure
1. Comprueba que existe `LUSHA_API_KEY`; si no, para y avisa. Conecta el MCP de Lusha; si no está disponible, para y propone la importación CSV de la app (`/import`, preset Lusha).
2. Lee `stakeholders.yaml` y `account.yaml`. Excluye `departed: true`.
3. `refresh`: por persona, busca en Lusha por nombre + empresa (o LinkedIn si existe). Clasifica:
   - **sin cambios**;
   - **cambio de puesto** dentro de la cuenta (nuevo `title`/unidad);
   - **salida** (empresa actual distinta) → proponer `departed: true` con nota "Salió (Lusha, <fecha>) → <empresa nueva>";
   - **no encontrado** → no cambiar nada.
4. `discover`: busca por los roles que faltan según los gaps del Power Map (EB, Champion, Technical Evaluator, Security, Procurement) en las unidades de `account.yaml`. Máximo 10 candidatos, `source: lusha`, `status: Not contacted`, `reports_to_confidence: hypothesis`.
5. Deduplica antes de proponer: email normalizado → URL de LinkedIn → nombre normalizado (sin acentos, minúsculas) + cuenta. Un duplicado actualiza; nunca crea otro registro.
6. Datos de contacto (email/teléfono) solo se revelan para personas con rol objetivo y dentro del tope de créditos; anota los créditos consumidos.
7. Aplica los cambios en `stakeholders.yaml` (preservando ids, roles, `reports_to` e influencias existentes) y añade una línea a `log.md`.
8. Valida: `python3 -c "import yaml;yaml.safe_load(open('accounts/<slug>/stakeholders.yaml'))"` y `npm test`.
9. Abre PR `enrich(<slug>): Lusha <modo> — N cambios` con la tabla persona · cambio · evidencia Lusha · acción propuesta, y créditos consumidos.

## Specifications
- Cada cambio lleva `source: lusha` y fecha de verificación.
- Ninguna persona se elimina físicamente; las salidas se marcan con `departed: true`.
- Créditos consumidos ≤ tope indicado.

## Forbidden Actions
- Enviar emails, mensajes o invitaciones; crear borradores en Gmail.
- Imprimir, commitear o pegar la API key.
- Cambiar `role`, `attitude`, `influence` o `reports_to` confirmados sin evidencia; dejar el cambio como propuesta en el PR.
- Publicar emails o teléfonos en ficheros del repo (es público): guárdalos solo en el informe de la sesión.
