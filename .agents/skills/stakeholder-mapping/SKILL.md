---
name: stakeholder-mapping
description: Crea o actualiza accounts/<slug>/stakeholders.yaml (schema stakeholders/v1) a partir de un Account Plan, notas de reunión o research; asigna nivel, unidad, líneas de reporte (confirmadas vs hipótesis), rol MEDDPICC y actitud. Usar al onboardear una cuenta o tras cada reunión con información organizativa.
---

# stakeholder-mapping

## Entrada
- `accounts/<slug>/stakeholders.yaml` (si existe) y la fuente nueva: tabla PG, notas de reunión, lista de research.

## Reglas del schema (ver `accounts/README.md`)
- `id`: inicial del nombre + apellido, sin acentos (`rtejado`). Estable: nunca renombrar un id existente.
- `reports_to`: solo `confirmed` si lo dijo la propia persona, un colega, o consta en un organigrama oficial. Todo lo demás `hypothesis`.
- Un solo `role: EB` por oportunidad. Si hay una persona por encima del EB, va como `None` con `influence: 3` y `influences: [<eb>]`.
- `role: Champion` exige: actitud `positive`, acceso al EB (ruta por `reports_to` o `influences`) y al menos un touch en 45 días. Si no, es `Coach` o `Influencer`.
- `attitude: negative` → añade en `notes` una línea `Mitigación:`; si no la hay, el chart lo marcará como gap.
- No borrar personas: si se van de la empresa, `status: No contact` y `notes: "Salió en <fecha>"`.

## Pasos
1. Carga el YAML actual; construye el mapa id → persona.
2. Para cada persona nueva o modificada, decide nivel (C Level / 2nd / 3rd / 4th) por cargo y unidad por área funcional.
3. Propón `reports_to` por cargo y unidad; márcalo `hypothesis`. Comprueba que no hay ciclos.
4. Asigna rol MEDDPICC con las reglas anteriores; si dudas, `None`.
5. Escribe el YAML ordenado por unidad y nivel; actualiza `updated`.
6. Valida: `cd apps/power-chart && npm run build` debe pasar (el chart importa el YAML).
7. Añade línea a `log.md` con el resumen (`+N personas, M líneas confirmadas`).

## Salida
PR `stakeholders(<slug>): <resumen>`. En la descripción, lista las hipótesis nuevas que hay que confirmar en la próxima reunión.
