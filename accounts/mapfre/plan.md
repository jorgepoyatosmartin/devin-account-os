# MAPFRE — Plan de cuenta FY27

> El CRM es la fuente de verdad de stage, importe y fechas. Este fichero es la fuente de verdad del *razonamiento* (3 Whys, MEDDPICC, riesgos, próximos pasos).

## Sales plays activos

| Play | Estado | Contactos PG | Entrada |
|---|---|---|---|
| Agentic Readiness | OPP-1 abierta | 18 | Santiago Wiznez (EB), equipo Tecnología / Datos e IA |
| Security AI Governance | Prospección | 9 | Ricardo Llorente (coach, "prioridad B"), Alvaro Trigo, Alberto Colino |
| API + AI Monetization | Prospección | 6 | Finanzas / Digital / Compras |

## OPP-1 — Global Agentic Platform (Kong AI Gateway)

### 3 Whys

- **Why anything?** El Comité Ejecutivo aprobó presupuesto para la Global Agentic Platform (MVP oct-2026, POC Kong nov-2026 a más tardar). Todos los nuevos casos de uso de IA y los asistentes existentes (Super Asistente Conversacional España) deben migrar a ella. La capa LLM no está gobernada de forma agnóstica, segura ni con control FinOps.
- **Why now?** Presupuesto y calendario públicos; la plataforma debe entregar desde Q1 2027. MAPFRE decide su arquitectura este año. EU AI Act (agosto 2026) y DORA exigen trazabilidad y evidencia operativa. Cada mes sin gobierno encarece el arreglo y quema recursos limitados.
- **Why Kong?** Una capa consistente para LLMs, MCPs y agentes que cierra los gaps que ya encontró el equipo de Santiago; control de coste FinOps; un único camino gobernado para todos los equipos; latencia probada a escala enterprise.

### MEDDPICC

| Letra | Estado | Detalle |
|---|---|---|
| Metrics | M | Cuatro dimensiones a probar: Governance & Control, Usability, Cost reduction, Latency. Sin definición de "pass" firmada. |
| Economic Buyer | Y | Santiago Wiznez (Chief Technology Transformation Officer). GO/NO-GO: revisar MAP, plan de POC, criterios, personas. |
| Decision Criteria | Y | PoC con criterios acordados + business case claro + alineamiento de precio. |
| Decision Process | M | POC → propuesta final → RFP. |
| Paper Process | N | RFP, reventa vía partner (Accenture / Inetum / NTT Data; AWS alternativo). T&Cs de seguros muy restrictivos. |
| Identified Pain | M | Escalar IA sin plataforma gobernada: más coste, más riesgo de cumplimiento y seguridad. |
| Champion | N | **Sin champion identificado.** Candidatos: quien tenga acceso a Santiago y actitud a favor. |
| Competition | M | Azure (desarrollo propio). |

### Mutual Action Plan

1. AIMA Workshop — primeras 2 semanas de octubre 2026 (acordar criterios de éxito por escrito).
2. POC — noviembre 2026. Hito técnico #1: validar APIM con caso de uso X.
3. Validación (TVE) — diciembre 2026.
4. Acuerdo comercial + redlines legales — enero 2027 (firma obligatoria en enero para arrancar en febrero).
5. Kick-off / PS start — febrero 2027.

### Red flags

| Riesgo | Quién | Mitigación |
|---|---|---|
| Sin holgura en el calendario POC→Validación→Firma→Kick-off | Jean Pierre | Cerrar alcance, casos de uso y criterios con el equipo de Santiago **antes** de noviembre; timeline compartido con hitos duros. |
| Criterios de evaluación del POC no formalizados | Jorge | Acuerdo escrito de "pass" para las cuatro métricas antes del POC (AIMA W octubre). |
| T&Cs restrictivos, poca flexibilidad | Jorge | Reventa a través de partner. |
| Sin champion | Jorge | Ver `stakeholders.yaml` → Modo Gaps. Trabajar Raúl Tejado / Iñigo Azpeitia / Diego Sagi como candidatos. |

## PG — estado (27/09/2026)

- 32 stakeholders mapeados (30 del Account Plan + 2 por research). Solo 3 con contacto activo.
- Señales: Diego Sagi pidió info de AI Governance por LinkedIn (sin respuesta posterior); Raúl Tejado interesado en AI Governance (pendiente re-llamada); Ricardo Llorente: seguridad es prioridad, abierto a conocer la solución "más adelante".
- Rama Finanzas (Daniel Quermia, 4 personas) sin ningún contacto — bloquea el play API + AI Monetization.

## Próximos pasos

- [ ] Confirmar líneas de reporte del Área de Tecnología y Dato en la próxima reunión (25 hipótesis).
- [ ] Reactivar Raúl Tejado y Diego Sagi (cadencia Agentic Readiness / AI Governance).
- [ ] Definir con Santiago los criterios de éxito del POC por escrito.
- [ ] Abrir Finanzas vía Rodrigo Yepes / Virginia Rubal para API + AI Monetization.
