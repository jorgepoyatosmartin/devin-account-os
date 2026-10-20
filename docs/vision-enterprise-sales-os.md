# Enterprise Sales / Pipeline Generation OS sobre Devin — visión de producto

*Punto de partida: lo aprendido con la Cognition Pipeline App (PG Command Center), el Territory Plan FY27 (34 cuentas), el Account Plan MEDDPICC de MAPFRE, los prompts de Discovery Playbook / Deal Risk Framework / Battlecards, y el intento de fan-out de account plans.*

---

## 1. Qué aprendimos (y qué cambia el diseño)

| Lección de la app actual | Implicación de diseño |
|---|---|
| El estado (cuentas, contactos, planes, cadencias) vivía en SQLite dentro de la VM de una sesión. Una sesión posterior no podía verlo ("los datos están en la máquina de esa sesión, no en esta"). | **El estado no puede vivir en una sesión.** Debe vivir en un lugar que toda sesión, playbook y automation lea y escriba: el repo `devin-account-os` (Git como system of record) + el CRM. |
| La investigación de 34 cuentas se hizo en una sola sesión "a mano", repitiendo el mismo proceso 34 veces sin procedimiento formalizado. | **Todo proceso repetido ≥2 veces debe ser una Skill** (cómo se hace) y, si se lanza como trabajo completo, un **Playbook** (qué se pide). |
| El fan-out de sesiones hijas murió por `out_of_quota`; no había presupuesto ni prioridad por tier. | **Paralelismo con presupuesto**: profundidad de research por tier, lotes pequeños, workflows reanudables, y el "modo single-session" como fallback explícito. |
| Gmail requirió OAuth manual, LinkedIn quedó asistido, y la app hacía de "puente" ad hoc. | **Devin es el runtime, no la app.** Las integraciones se conectan una vez a nivel de org (MCP) y las usan todos los playbooks; la app pasa a ser una vista fina sobre el repo, no el motor. |
| El valor real estaba en los artefactos de conocimiento (MEDDPICC, 3 Whys, battlecards, deal-risk), pero quedaron como .md/.pptx sueltos en adjuntos. | Ese conocimiento es **Knowledge + Skills** de la org: siempre presente, versionado, mejorable por PR. |
| Un AE no quiere abrir una app más: quiere el brief antes de la reunión, el borrador listo y la alerta cuando algo cambia. | **Superficie principal = Slack + Gmail + CRM**, con Devin empujando trabajo terminado. La web es secundaria. |

Resumen de la tesis: **pasar de "una app que llama a Devin" a "Devin como sistema operativo de ventas, con el repo como memoria, Skills como capacidades, Playbooks como trabajos y Automations como reloj".**

---

## 2. Arquitectura en cuatro capas

```
┌─────────────────────────────────────────────────────────────┐
│ 4. SUPERFICIE  Slack (canal por cuenta) · Gmail · CRM ·      │
│                Web ligera (lectura del repo) · Calendar       │
├─────────────────────────────────────────────────────────────┤
│ 3. EJECUCIÓN   Playbooks (trabajos) · Automations (reloj y   │
│                eventos) · Workflows (fan-out con presupuesto) │
├─────────────────────────────────────────────────────────────┤
│ 2. CAPACIDADES Skills (.agents/skills/*) · Knowledge de org  │
│                (metodología, ICP, battlecards, tono)          │
├─────────────────────────────────────────────────────────────┤
│ 1. ESTADO      Repo devin-account-os (Git = system of        │
│                record) ⇄ CRM (HubSpot/Salesforce) · Gmail    │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Estado: el repo como system of record

```
devin-account-os/
  territory/
    FY27.yaml                 # tiers, TAM, owner, partner, NACV objetivo
  accounts/<slug>/
    profile.md                # Value Pyramid: objetivo, estrategias, iniciativas, retos
    plan.md                   # 3 Whys (gap + discovery question), MEDDPICC con estado
    stakeholders.yaml         # ≥25 contactos: rol, nivel, sales play, owner, estado
    signals.md                # disparadores "por qué ahora" con fecha y fuente
    cadences/<contacto>.yaml  # touches, canal, fecha, estado, copy
    log.md                    # diario de la cuenta (append-only, escrito por Devin)
    risk.md                   # Deal Risk Framework: score y mitigaciones
  plays/
    agentic-readiness.md · security-ai-governance.md · legacy-modernization.md
  battlecards/                # objeciones (on-prem, Copilot, calidad, ToS…)
  templates/                  # esquemas de profile/plan/stakeholders/cadence
  .agents/skills/             # ver §3
  docs/
```

Por qué Git y no solo la base de datos de una app:
- Cada sesión de Devin lo clona: **memoria compartida entre sesiones, playbooks y automations**.
- Cada cambio es un **PR revisable** ("Devin propone cambiar el Economic Buyer de Naturgy" → el AE aprueba).
- Historial y `blame`: sabes cuándo y por qué se cambió un MEDDPICC.
- El CRM sigue siendo la verdad comercial (stage, importe, fecha de cierre); el repo es la verdad **de inteligencia y de plan**. Una Skill de sincronización mantiene ambos alineados.

### 2.2 Capacidades: Skills + Knowledge

**Knowledge de org** (siempre cargado, corto, normativo): metodología MEDDPICC tal como la usa Cognition, ICP y sales plays, posicionamiento Devin vs. asistentes IDE, política de canales (LinkedIn siempre asistido, email vía herramienta de secuencias), tono y idioma por cuenta, límites de ACU por tarea.

**Skills** (procedimientos reutilizables y testeados; ver catálogo en §3).

### 2.3 Ejecución: Playbooks, Automations, Workflows

- **Playbook** = un trabajo con entradas y salidas definidas ("Onboarding de cuenta", "Brief pre-reunión"). Se lanza desde Slack, webapp o API.
- **Automation** = un playbook con reloj o disparador (lunes 07:00 → sweep de señales; respuesta en Gmail → triaje).
- **Workflow** = fan-out determinista con presupuesto para trabajo masivo (34 account plans, 850 contactos).

### 2.4 Superficie

- **Slack**: un canal por cuenta Tier 1 (`#acct-mapfre`) + `#pg-daily`. Devin publica briefs, alertas y borradores; el AE responde con lenguaje natural ("actualiza el champion a X", "lanza cadencia a los 5 del CISO office").
- **Gmail**: Devin crea borradores en carpetas por cuenta; nunca envía en frío sin aprobación.
- **CRM**: escribe notas, tareas y cambios de MEDDPICC vía MCP.
- **Web ligera**: la PG Command Center reconstruida como **frontend de solo lectura/edición ligera sobre el repo** (renderiza los .md/.yaml, permite editar y crea un commit). Sin lógica de negocio propia: la lógica es Devin.

---

## 3. Catálogo de Skills (cómo se hace)

Cada Skill es un `SKILL.md` en `.agents/skills/<nombre>/` con pasos, fuentes, formato de salida y criterios de calidad. Las más importantes:

| Skill | Qué encapsula | Entrada → Salida |
|---|---|---|
| `account-research` | El procedimiento que replicó la pestaña 1 de MAPFRE en 33 cuentas: fuentes (web corporativa, informe anual, prensa, ponentes de eventos, ofertas de empleo tech), orden de búsqueda, profundidad por tier, cómo rellenar Value Pyramid. | slug + tier → `profile.md` |
| `meddpicc-plan` | 3 Whys con gap y discovery question; MEDDPICC con estado y evidencia; qué es "confirmado" vs. "hipótesis". | `profile.md` → `plan.md` |
| `stakeholder-mapping` | Cómo llegar a ≥25 contactos con fuentes públicas (LinkedIn solo lo que indexa Google), asignar nivel (C/2nd/3rd), sales play y ángulo. | slug → `stakeholders.yaml` |
| `signal-sweep` | Detectar disparadores "por qué ahora": reorganizaciones (p. ej. Área de Tecnología y Dato de MAPFRE), nombramientos, planes estratégicos, vacantes, resultados, regulación (DORA, AI Act). | slug → `signals.md` diff |
| `pg-cadence-writer` | La cadencia de 21 días multicanal: estructura de touches, reglas de personalización por rol y señal, longitud, CTA, idioma. | contacto + señal → `cadences/<contacto>.yaml` |
| `gmail-drafting` | Uso del MCP de Gmail: crear borradores en la etiqueta de la cuenta, nunca enviar, cómo enlazar hilo y contacto. | cadence step → draft en Gmail |
| `reply-triage` | Clasificar respuestas (interesado / redirige / no ahora / rechazo / OOO), proponer siguiente paso, actualizar `log.md` y CRM. | hilo Gmail → acción + diff |
| `linkedin-assisted` | Desde el Chrome de la VM con sesión del AE: leer perfil y posts, proponer sobre qué comentar, redactar comentario/mensaje. Nunca publicar. | URL perfil → borradores |
| `battlecard-lookup` | Dada una objeción en un email o nota de reunión, localizar la battlecard y adaptar la respuesta al contexto de la cuenta. | texto → respuesta |
| `deal-risk-review` | El Deal Risk Framework: score por dimensión, banderas rojas, preguntas de discovery pendientes. | `plan.md` + CRM → `risk.md` |
| `meeting-brief` | Brief de 1 página: quién va, últimas señales, MEDDPICC abierto, 3 preguntas de discovery, objeciones probables. | calendario → brief |
| `meeting-debrief` | Convertir notas/transcripción en cambios de MEDDPICC, próximos pasos, tareas CRM y diario. | notas → PR + tareas |
| `crm-sync` | Mapeo campo a campo repo ⇄ HubSpot/Salesforce; qué manda en cada conflicto. | diff → llamadas MCP |
| `territory-review` | Agregar 34 cuentas: cobertura de contactos, cadencias activas, señales sin acción, NACV vs. objetivo. | repo → informe |
| `acu-budgeting` | Reglas de coste: profundidad por tier, cuándo usar fan-out vs. single-session, caché de research (no re-investigar lo que tiene <30 días). | tarea → plan de ejecución |

Principio: **las Skills se mejoran por PR**. Cuando un playbook produce un mal resultado, el arreglo es un cambio en la Skill, no repetir la instrucción en el chat.

---

## 4. Catálogo de Playbooks (qué se pide)

| Playbook | Skills que usa | Disparo típico | Salida |
|---|---|---|---|
| **Onboarding de cuenta** | account-research → meddpicc-plan → stakeholder-mapping → signal-sweep | AE añade cuenta al `territory/FY27.yaml` | PR con la carpeta `accounts/<slug>/` completa |
| **Refresh de cuenta** | signal-sweep, account-research (delta) | Automation semanal por tier | PR con diffs + resumen en Slack |
| **Activar PG** | pg-cadence-writer → gmail-drafting | "Lanza cadencia a los 5 contactos del sales play Security" | cadencias + borradores en Gmail + tareas en CRM |
| **Triaje de respuestas** | reply-triage, battlecard-lookup | Automation por evento Gmail / cada 2 h | Resumen en Slack, siguientes pasos, CRM actualizado |
| **Brief pre-reunión** | meeting-brief | Evento en Calendar con dominio de cuenta, T-24 h | Brief en Slack DM |
| **Debrief post-reunión** | meeting-debrief, crm-sync | AE pega notas en el canal | PR a `plan.md` + tareas |
| **Deal risk review** | deal-risk-review | Cambio de stage en CRM o quincenal | `risk.md` + alerta si score empeora |
| **Territory review** | territory-review, acu-budgeting | Lunes 07:00 / fin de mes | Informe HTML + propuesta de foco de la semana |
| **Plan de PG por trimestre** | todas | "Plan PG desde la primera semana de enero 2027, ≥25 contactos por cuenta" | Workflow fan-out (§5) |

Diseño de cada playbook: objetivo, entradas explícitas, Skills obligatorias, formato de salida (siempre PR o mensaje estructurado), criterios de "hecho", límite de ACU y comportamiento si falta acceso (p. ej. Gmail sin OAuth → generar borradores en el repo en vez de fallar).

---

## 5. Automations y Workflows

### Automations (el reloj del OS)

| Cuándo | Qué | Para quién |
|---|---|---|
| Lun 07:00 | Territory review + foco de la semana | AE / manager en `#pg-daily` |
| Diario 07:30 | Signal sweep Tier 1; Tier 2 los miércoles; Tier 3 mensual | canal por cuenta |
| Cada 2 h laborables | Triaje de respuestas Gmail | DM al owner |
| T-24 h de reunión | Brief pre-reunión | DM |
| Evento CRM: stage change / opp creada | Deal risk review | canal de cuenta |
| Viernes 16:00 | Cadencias: vencidas, sin respuesta a 3 touches, propuesta de siguiente ola | DM |

### Workflows (fan-out con presupuesto) — lo que falló y cómo hacerlo bien

- **Lotes por tier**, no una sesión por cuenta: Tier 1 → 1 cuenta/sesión con research profundo; Tier 2 → 2-3 cuentas/sesión; Tier 3/público → 4-5 cuentas/sesión con plantilla ligera.
- **Salida estructurada** (schema fijo de `profile/plan/stakeholders`) para que el padre pueda validar y mergear sin leer prosa.
- **Journal reanudable**: si se agota la cuota a mitad, se retoma donde estaba; ningún lote se repite.
- **Presupuesto explícito** en el propio workflow y aviso previo al usuario con la estimación (la cuota agotada no debe ser una sorpresa).
- **Fallback declarado**: si no hay presupuesto, el mismo workflow se ejecuta en modo secuencial dentro de la sesión.

---

## 6. Integraciones y política de canales

| Sistema | Vía | Uso | Regla |
|---|---|---|---|
| Gmail | MCP (ya instalado) | leer hilos, crear borradores, etiquetar | Devin **no envía**; el AE o la herramienta de secuencias envía |
| HubSpot / Salesforce | MCP | notas, tareas, MEDDPICC custom fields, stage | el CRM manda en stage/importe; el repo en inteligencia |
| Google Calendar | MCP | detectar reuniones con dominio de cuenta | disparo de briefs y debriefs |
| Slack | integración nativa | superficie principal | un canal por cuenta Tier 1 |
| Outreach / Salesloft / HubSpot Sequences | API/MCP | envío masivo con entregabilidad | Devin genera, la herramienta envía |
| Apollo / Clay | MCP o API | enriquecer contactos (email, teléfono) | solo para completar `stakeholders.yaml` |
| LinkedIn | Chrome de la VM con sesión del AE | leer perfiles y posts públicos, redactar | **siempre asistido**, nunca automatizar envío (ToS) |

---

## 7. Gobernanza y coste

- **ACU por tarea** documentado en cada playbook y aplicado por `acu-budgeting`.
- **Caché de research**: no re-investigar una cuenta con `profile.md` <30 días salvo señal nueva.
- **Todo cambio a `accounts/` es PR**; auto-merge solo para `log.md` y `signals.md`; `plan.md` y `stakeholders.yaml` requieren aprobación del owner.
- **Trazabilidad**: cada afirmación en `plan.md` lleva fuente y fecha; MEDDPICC distingue "confirmado en reunión" de "hipótesis por research".
- **Datos personales**: solo fuentes públicas, propósito B2B, borrado a petición; nada de scraping de LinkedIn.

---

## 8. Métricas del OS

- **Cobertura**: cuentas con plan completo, contactos ≥25, señales <30 días.
- **Actividad**: cadencias activas, touches ejecutados, tiempo de AE por touch (objetivo: <2 min, solo revisar y enviar).
- **Conversión**: respuestas/touch, reuniones/cuenta, opps creadas, NACV generada vs. plan FY27 (2,66 M€).
- **Calidad de Devin**: PRs aceptados sin edición, briefs valorados útiles, coste ACU por reunión generada.

---

## 9. Roadmap en sesiones de Devin

**Fase 1 — Memoria y capacidades (2-3 sesiones)**
1. Migrar el contenido de la PG Command Center (34 cuentas, 24 opps, 30 contactos MAPFRE, planes) a la estructura de repo de §2.1.
2. Escribir las Skills núcleo: `account-research`, `meddpicc-plan`, `stakeholder-mapping`, `signal-sweep`, `pg-cadence-writer`, `gmail-drafting`, `acu-budgeting`.
3. Convertir los prompts de Discovery Playbook, Deal Risk Framework y Battlecards en Knowledge + `battlecards/`.

**Fase 2 — Trabajos y reloj (2 sesiones)**
4. Playbooks: Onboarding, Activar PG, Triaje, Brief pre-reunión, Territory review.
5. Automations: sweep semanal, triaje cada 2 h, review de lunes.
6. Completar OAuth de Gmail y conectar CRM + Calendar por MCP.

**Fase 3 — Escala (1-2 sesiones + espera de cuota)**
7. Workflow `account-plans-fanout` v2 con lotes por tier, salida estructurada y journal.
8. Plan de PG enero 2027: ≥25 contactos × 34 cuentas, cadencias y borradores.
9. Web ligera de lectura sobre el repo (opcional) y canales Slack por cuenta.

**Dependencias externas** (a contar aparte): cuota de ACU para el fan-out, OAuth de Gmail y credenciales del CRM, decisión Outreach vs. HubSpot Sequences.

---

## 10. Decisiones que necesito de ti

1. **CRM objetivo**: HubSpot o Salesforce (define la Skill `crm-sync` y los campos MEDDPICC).
2. **Motor de envío**: Outreach / Salesloft / HubSpot Sequences, o solo borradores Gmail en la fase 1.
3. **Política de aprobación**: ¿auto-merge de `plan.md` para Tier 3 o siempre revisión humana?
4. **Idioma por defecto** de artefactos: español para cuentas España, inglés para material interno Cognition.
