# devin-account-os
AI-powered Enterprise Account OS built with Devin for account intelligence, sales execution, pipeline generation, and strategic account management.

Este repo es la **memoria compartida** del OS: Devin es el runtime, las Skills son las capacidades, los Playbooks los trabajos completos y el CRM conserva stage/importe/fechas. Visión completa en [`docs/vision-enterprise-sales-os.md`](docs/vision-enterprise-sales-os.md).

```
accounts/<slug>/        estado por cuenta: profile.md, plan.md, stakeholders.yaml, signals.md, log.md, cadences/
.agents/skills/         Skills de Devin (se cargan automáticamente en cada sesión que clona el repo)
playbooks/              Playbooks de Devin (trabajos completos que encadenan Skills; registrados también en Devin)
apps/power-chart/       Power Chart interactivo (React Flow) que lee/escribe stakeholders.yaml
docs/                   visión, decisiones
```

## App (Cognition Pipeline OS)

Full-stack: frontend React 18 + Vite + TypeScript (raíz del repo, rutas hash `#/` (Hoy), `#/prp`, `#/territory`, `#/pg`, `#/opportunities`, `#/import`, `#/accounts`, `#/power-charts`) y backend FastAPI + SQLite en [`server/`](server/) (login, sync de estado, Lusha, OpenAI). El backend es opcional: sin `VITE_API_URL` la app funciona solo en local con los datos de `src/data/*.json` y `accounts/*/` y guarda las ediciones en `localStorage`.

### Requisitos

- Node.js 20+ y npm
- Python 3.11 y [Poetry](https://python-poetry.org/) (solo para el backend)

### Frontend

```sh
npm ci
npm run dev          # http://localhost:5173
npm test             # Vitest
npx tsc --noEmit -p tsconfig.json && npx oxlint src
npm run build        # genera dist/
```

### Backend

```sh
cd server
poetry install
cp .env.example .env                                   # rellenar valores (no commitear)
echo -n 'tu-password' | poetry run python scripts/hash_password.py   # -> APP_PASSWORD_HASH
set -a && . ./.env && set +a
poetry run uvicorn app.main:app --reload --port 8000
poetry run pytest -q                                   # tests con mocks, sin llamadas externas
```

Variables (ver [`server/.env.example`](server/.env.example)): `APP_USERNAME`, `APP_PASSWORD_HASH`, `APP_JWT_SECRET` (obligatorias); `APP_CORS_ORIGINS` (orígenes del frontend, separados por comas); `DATA_DIR` (SQLite persistente); `LUSHA_API_KEY`, `LUSHA_DAILY_CAP`, `OPENAI_API_KEY`, `OPENAI_MODEL` (opcionales).

Frontend conectado al backend: `cp .env.example .env.local`, poner `VITE_API_URL=http://localhost:8000` y `npm run dev`.

### Despliegue

- **Frontend estático**: `npm run build` y publicar `dist/` en cualquier hosting estático (Devin Apps, Netlify, Vercel, S3…). Al usar rutas hash no hace falta configurar rewrites. Sin `VITE_API_URL` es una build local-only; con `VITE_API_URL=https://tu-api.example npm run build` activa login y sync.
- **Backend**: cualquier host con Python 3.11 (p. ej. Fly.io) ejecutando `uvicorn app.main:app --host 0.0.0.0 --port 8000` desde `server/`, con un volumen montado en `DATA_DIR` y las variables anteriores como secretos de la plataforma. Añadir el dominio del frontend a `APP_CORS_ORIGINS`.

### Seguridad

El repo es público: no commitear `.env`, credenciales, claves privadas ni datos reales de contactos, cuota o comisiones (el plan de comisiones vive solo en el `localStorage` del navegador).

## Skills

| Skill | Qué hace | Escribe en |
|---|---|---|
| `account-research` | Investiga la cuenta y rellena el perfil | `profile.md` |
| `stakeholder-mapping` | Crea/actualiza personas, jerarquía y roles MEDDPICC | `stakeholders.yaml` |
| `power-map-review` | Gaps, candidatos a champion, camino al EB | Slack / `log.md` |
| `meddpicc-plan` | 3 Whys, MEDDPICC, MAP, red flags de una oportunidad | `plan.md` |
| `signal-sweep` | Barrido de señales públicas con acción sugerida | `signals.md` |
| `pg-cadence-writer` | Cadencia de outreach por persona (no envía) | `cadences/<id>.yaml` |
| `deal-risk-review` | Semáforo de riesgo de la oportunidad + 3 acciones | Slack / `log.md` |

Toda escritura de una Skill pasa por PR; nada va directo a `main`.

## Playbooks

| Playbook | Macro | Cuándo |
|---|---|---|
| [`account-onboarding`](playbooks/account-onboarding.md) | `!onboard_account` | Alta de una cuenta desde Account Plan o research |
| [`pg-activation`](playbooks/pg-activation.md) | `!pg_activation` | Arrancar cadencias (draft) para un sales play |
| [`meeting-brief`](playbooks/meeting-brief.md) | `!meeting_brief` | Antes de una reunión |
| [`meeting-debrief`](playbooks/meeting-debrief.md) | `!meeting_debrief` | Después de una reunión: actualizar YAML, plan, señales |
| [`weekly-deal-review`](playbooks/weekly-deal-review.md) | `!deal_review` | Semanal / pre-forecast (candidato a Automation) |

Sin integraciones por ahora: ningún playbook envía emails ni escribe en el CRM; la salida es siempre un PR.

## Power Chart

```
cd apps/power-chart && npm install && npm run dev   # http://localhost:5173
```

Lee `accounts/mapfre/stakeholders.yaml`. Arrastra una tarjeta sobre otra para cambiar a quién reporta; "Exportar YAML" genera el fichero para sustituir el del repo y abrir PR.

## Cuentas

- [MAPFRE](accounts/mapfre/) — Tier 1, FY27
