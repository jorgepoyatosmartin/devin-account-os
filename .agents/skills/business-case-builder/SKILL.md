---
name: business-case-builder
description: Construye o revisa el business case de una oportunidad como tabla de palancas trazables (valor, unidad, fuente, tipo dato-cliente/benchmark/supuesto). Usar antes de BVA, al preparar propuesta o cuando el EB pide justificar la inversión.
---

# business-case-builder

## Entrada
- `accounts/<slug>/plan.md` (oportunidad, MEDDPICC: Metrics e Identify Pain) y `profile.md`.
- Importe y moneda de la oportunidad (si no se conocen, indícalo y calcula solo el valor).
- Datos que aporte el usuario o el cliente (nº de ingenieros, coste/hora, backlog, incidentes, tiempo de ciclo...).

## Pasos
1. Lista 3-6 palancas de valor ligadas al dolor documentado (productividad de ingeniería, modernización de legacy, reducción de incidentes, time-to-market, coste de contratación/outsourcing).
2. Para cada palanca: fórmula explícita (p. ej. `ingenieros × horas ahorradas/semana × 46 semanas × coste/hora`), valor anual en EUR, fuente y tipo:
   - `customer`: dato dado por el cliente (cita quién y cuándo).
   - `benchmark`: dato público (enlace).
   - `assumption`: supuesto propio, marcado para validar.
3. Total anual, payback (meses) y ROI frente al importe. Muestra el total solo con `customer` + `benchmark` y, aparte, el total incluyendo supuestos.
4. Lista las 3 preguntas que convertirían los supuestos de mayor peso en datos del cliente.

## Salida
Tabla Markdown (palanca · fórmula · valor € · fuente · tipo) + totales + preguntas. Añade la tabla en la sección "Business case" de `plan.md` y una línea en `log.md`, mediante PR.

## Guardrails
- Ningún número sin fuente o sin la etiqueta `assumption`.
- No inventes datos del cliente ni cifras de casos de éxito de Cognition no publicados.
- Si el supuesto principal supera el 50 % del valor total, el semáforo del business case es ámbar como máximo.
