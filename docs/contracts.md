# Contracts v1 — Cognition Pipeline OS redesign (Phase 0)

Frozen design for the MVP. Change only by PR that updates this file first.

## 0. Principles
- One identity per entity (account, person, opportunity). Views are filters, never copies.
- Every derived number is a pure function of data + config (src/prp/engine.ts). No numbers typed into the UI.
- Facts vs hypotheses: every person-role, hypothesis and score input keeps `confirmed`/`source`/`verifiedAt`.
- **Public repo:** the user's real quota, commission plan and personal target are NEVER committed or bundled. The comp plan lives only in localStorage (`cognition-pipeline-comp-plan`) and is entered via the PRP page form or imported from a local JSON file. Tests use `src/prp/__fixtures__/synthetic.json` (synthetic numbers).
- No external integrations in the MVP (no Lusha, no OpenAI, no CRM). Integration seams are interfaces only (§8).

## 1. Config & catalog (repo, versioned, loaded at build time via `?raw` + js-yaml)
| File | Content |
|---|---|
| `config/stages.yaml` | Provisional stages (Kong Excel): `1-disco-scheduled` 5 %, `2-engage` 10 %, `3-qualify` 20 %, `4-evaluate` 40 %, `6-validate` 60 %, `7-negotiate` 80 %, `closed-won` 100 %, `closed-lost` 0 %. Each: `id, label, probability, order, exitCriteria[]`. Swapped for Cognition's by editing this file only. |
| `config/fiscal.yaml` | `fyStartMonth: 1` (Jan–Dec, Q1 = Jan–Mar), `currency: EUR`. |
| `config/engagement.yaml` | Configurable engagement process (NOT Kong's GEP): phases `DM` Discovery meeting, `NBM` New business meeting, `TFW` Technical feasibility workshop, `BVA` Business Value Assessment, `TV` Technical validation, each with `evidenceRequired`. |
| `config/funnel.yaml` | Backward funnel rates: DM→NBM 0.30, NBM→TFW 0.50, TFW→BVA_TV 0.50, BVA_TV→WON 0.50 (from user's Excel monthly funnel 20/6/3/1.5/0.75). |
| `config/pg-score.yaml` | PG Opportunity Score weights: fit 25, signals 25, access 20, economic 20, urgency 10. Inputs 1–5; score = Σ weight × (input−1)/4 → 0–100. |
| `catalog/products.yaml` | Cognition: `devin-cloud`, `devin-desktop` (ex-Windsurf), `devin-cli`, `devin-review`, each with `useCases[]`. |
| `catalog/sales-plays.yaml` | Provisional (to validate with Cognition enablement): `appsec`, `modernization`, `dev-productivity`, `quality-testing`, `ops-incidents`, each with `productIds[]`, `pains[]`. |

## 2. Accounts without code
- Account registry = existing `src/data/accounts.json` **plus** any folder `accounts/<id>/` discovered with `import.meta.glob('/accounts/*/account.yaml', { query: '?raw', import: 'default', eager: true })`.
- `accounts/<id>/account.yaml` (minimal: `id, name, sector, headquarters, country, businessUnits[]`) and `accounts/<id>/stakeholders.yaml` (schema `stakeholders/v1`, same as MAPFRE).
- `accounts/<id>/territory.yaml`: `tier: A|B|C`, `potentialEur: number|null`, `effortPct: number`, `effortReason: string`, `segment`, `priority: 1..5`, `rationale`, `evidence[]`.
- `accounts/_template/` holds empty copies of the three files. Adding an account = copy the template (or run `!onboard_account`).
- All 5 current accounts get `stakeholders.yaml` generated once from `src/data/stakeholders.json` (reports_to null where unknown, `reports_to_confidence: hypothesis`).

## 3. Opportunity v2 (extends current `Opportunity`; legacy fields kept)
```ts
interface OpportunityV2 extends Opportunity {
  amount: number | null; currency: 'EUR' | 'USD';
  closeDate: string | null;            // ISO; quarter is DERIVED, never stored
  stageId: string;                     // config/stages.yaml id
  status: 'open' | 'won' | 'lost';
  forecastCategory: 'Pipeline' | 'Upside' | 'Commit' | 'Closed';
  countsForQuota: boolean;             // false e.g. renewals
  commissionType: 'new' | 'renewal';
  stageHistory: { stageId: string; date: string; note?: string }[];
  exitChecks: Record<stageId, string[]>; // completed exit-criteria labels by stage
  people: OpportunityPerson[];         // MEDDPICC role per opportunity, not per person
  engagement: { phase: string; date: string | null; evidence: string }[];
  origin: { signalIds: string[]; pgId?: string; hypothesisId?: string };
  productIds: string[]; salesPlayId?: string;
}
interface OpportunityPerson { stakeholderId: string; role: PowerRole; confirmed: boolean; evidence?: string; verifiedAt?: string }
```
Migration of legacy stage: Identified→`1-disco-scheduled`, Discovery→`2-engage`, Qualified→`3-qualify`, Proposal→`4-evaluate`, Negotiation→`7-negotiate`, Closed Won→`closed-won`/won, Closed Lost→`closed-lost`/lost. `amount`/`closeDate` = null (shown as "sin importe"/"sin fecha", excluded from PRP and counted as data gaps). `people` built from `stakeholderIds`, `championId`, `economicBuyerId` with `confirmed:false` unless the stakeholder's role is confirmed.

## 4. PRP & commission engine (`src/prp/engine.ts`, pure, no React)
```ts
interface CompPlan { fiscalYear: number; currency: 'EUR'; quotaByQuarter: [number,number,number,number];
  tiers: { fromPct: number; toPct: number | null; rate: number }[];   // cumulative attainment of annual quota
  renewalRate: number; taxFactor: number; fxEurUsd: number;           // EUR × fx = USD
  netTarget: number; personalTargetQuarterSplit: [number,number,number,number];
  coverageMultiple: number; avgDealSize: number }
compGross(salesQuota: number, plan): number            // walk tiers on attainment
salesNeededForGross(gross: number, plan): number       // exact inverse of compGross
toEur(amount, currency, plan): number                  // USD / fxEurUsd
prp(opps: OpportunityV2[], plan, stages, today: string): PrpResult   // year + 4 quarters
```
Rules (each is a test):
- Only opps with `closeDate` inside the fiscal year count; others listed in `oppsOutsideFiscalYear`. Opps with `amount == null` listed in `oppsMissingAmount`, excluded from sums.
- `closedWonQuota` = Σ won & countsForQuota. Renewals: commission = amount × renewalRate, never attainment.
- `grossCommissionNeeded` = netTarget / taxFactor − renewal gross already closed. `personalTargetSales` = salesNeededForGross(that).
- `gapToQuota` = annualQuota − closedWonQuota; `gapToPersonal` = personalTargetSales − closedWonQuota (floor 0).
- `pipelineTotal` = Σ open; `pipelineWeighted` = Σ open × stage probability; `forecastCommit` = closed + open Commit; `forecastBestCase` = commit + open Upside.
- `pipelineRequired*` = gap × coverageMultiple (deliberately on the gap, not the target as the Excel did); `pipelineGap*` = required − pipelineTotal.
- `weeksRemaining` = (days from today to FY end, inclusive) / 7; `weeklyPipelinePacePersonal` = pipelineGapPersonal / weeksRemaining.
- Funnel: WON = ceil(gapToPersonal / avgDealSize); each earlier phase = ceil(WON / cumulative rate).
- Quarter view: quota per quarter, closedWonQuota per quarter, personalTarget = personalTargetSales × split, pipelineTotal per quarter.
- `commissionGrossClosed` = compGross(closedWonQuota) + renewal gross; net = × taxFactor; `commissionGrossCommit` = compGross(forecastCommit) + renewal gross.
Expected values: `src/prp/__fixtures__/synthetic.json` (authoritative; computed independently). Engine tests must match to the cent.

## 5. Navigation (6 entries)
Hoy (`/`) · PRP (`/prp`) · Territorio (`/territory`, account detail `/accounts/:id`) · PG (`/pg`) · Oportunidades (`/opportunities`) · Revisión semanal (`/weekly-review`).
Legacy routes (`/stakeholders`, `/signals`, `/use-cases`, `/initiatives`, `/power-charts`, `/pipeline`, `/tasks`, `/cross-account`) stay working but leave the sidebar; they are reachable as sub-tabs/links from Territorio, PG and Oportunidades.

## 6. Hoy (computed)
Ranked list from rules, each item with `reason` and link: (1) opps with overdue next step or closeDate in past; (2) open opps missing amount/closeDate (blocks PRP); (3) PG targets with score ≥ 70 not yet contacted; (4) champions/EBs without touch > 30 days; (5) signals < 14 days not linked to a PG target. Header shows PRP gap and weekly pace when a comp plan exists, else a CTA to enter it.

## 7. PG flow
`Signal` (+ `productIds`, `salesPlayId`, `scoreInputs`) → `Hypothesis` { id, accountId, title, whyChange, whyNow, whyUs, valueEstimate {amount|null, assumptions}, stakeholderIds, routeToMarket: direct|partner|hyperscaler, nextBestAction, status: hypothesis|validated|converted|discarded, signalIds, source, verifiedAt, productIds, salesPlayId?, pgId? } → `PgRecord` (existing) with `messageStatus: draft|approved|sent`, `messageDraft`, and `touches[] {date, channel, outcome}` → convert to OpportunityV2 carrying `origin`.

## 8. Integration seams (interfaces only in the MVP)
`EnrichmentProvider { findPeople(accountId, query), enrich(personRef) }` → impl `CsvImportProvider` now; `LushaApiProvider` (backend) and Lusha MCP (Devin) later. `LlmProvider` → not implemented in MVP (Skills generate content).

## 9. Persistence
MVP: repo files + localStorage edits + "Guardar en repo" PR prompt (existing pattern). New keys: `cognition-pipeline-comp-plan`, `cognition-pipeline-opps-v2`, `cognition-pipeline-hypotheses`, `cognition-pipeline-territory`. Snapshot versioning as in `power-chart:<id>`.

## Fase 2 — Profundidad

### Escenarios y atribución de comisión

`config/scenarios.yaml` is loaded as `scenariosConfig: ScenarioDefinition[]`. Each definition contains `id`, `label`, `probabilityFactor`, `slipDays`, `slipMaxStageOrder`, and nullable `coverageMultiple`. `prpScenario(opps, plan, stages, today, scenario)` shifts close dates in UTC for open opportunities at or before the configured stage order, caps adjusted stage probabilities at 1, optionally overrides coverage, and delegates the forecast to `prp()`. Its `ScenarioResult` reports projected sales, quota and personal gaps, personal pipeline required, and gross/net commission.

`isCloseDateInFiscalYear` and `opportunityAmountEur` are shared PRP eligibility and currency-conversion helpers. `commissionByOpportunity(opps, plan)` returns `OppCommission[]` for amount-bearing opportunities in the fiscal year. Eligible won new-business commission is attributed marginally in close-date/ID order; renewals receive renewal commission without quota credit; open new-business rows estimate incremental commission on top of closed quota sales.

### Opportunity depth

`OpportunityV2` may include optional `businessCase`, `technicalValidation`, and `decisionPlan` objects. Missing values are treated as empty. A business case stores its value levers and notes; technical validation stores a POC plan, criteria and acceptance date; a decision plan stores dated action steps and partner IDs. These fields are persisted through the existing OpportunityV2 store overlay and do not require a legacy migration.

### Partners

`accounts/<id>/partners.yaml` is optional and contains `partners[]` entries with `id`, `name`, `type` (`SI|hyperscaler|reseller|ISV|other`), `relationship`, `projects`, optional/null `doorOpenerStakeholderId`, `notes`, `source`, and nullable `verifiedAt`. Missing files produce an empty partner list. Entries must be grounded in the account's existing source material.

### PG response metrics

`PgTouch.response` is optional and one of `positive|neutral|negative|none`. `pgMetrics(pg, opps, groupBy, fxEurUsd)` groups target, touch, response, meeting, opportunity, pipeline and won counts/amounts by account, sales play, or channel. For channel grouping, targets and linked opportunities are attributed to each record's first touch channel; touch and response counts are attributed to their respective touch channels. USD amounts are converted to EUR using the supplied plan FX rate.

### Hoy commission actions

`buildToday(data, today, plan?)` retains the existing computed actions. When a compensation plan is supplied, open opportunities closing from today through the next 90 days can add up to three acceleration actions, ranked by estimated net commission from `commissionByOpportunity`.

## Fase 3a — Importación

`src/import/csv.ts` exposes `parseCsv(text)`, which parses quoted RFC 4180 fields (including escaped quotes and embedded newlines), strips a BOM, detects comma/semicolon/tab delimiters from the header, and trims header names. `src/import/providers.ts` defines stakeholder/opportunity presets and header aliases resolved without case or accent sensitivity. `CsvImportProvider` implements the `EnrichmentProvider` seam using local CSV data. Lusha enrichment is described by the `playbooks/lusha-enrich.md` Devin Playbook; no API credentials are required or stored by the MVP.

`planStakeholderImport(rows, preset, accountId, existing)` returns local stakeholder creates, safe updates, and skipped rows. Matching is prioritized by normalized email, LinkedIn URL, then normalized name; duplicate input rows are consolidated. Departed stakeholders remain departed and receive notes only. Contact fields such as email and phone are retained only in the browser overlay and excluded from repository YAML prompts.

`planOpportunityImport(rows, preset, opportunities, accounts)` matches existing opportunities by ID or normalized name plus account, and plans amount/currency/date/stage/forecast updates. Ambiguous dates and unmatched opportunities are skipped; unknown stages are preserved with a warning. The `/import` page previews creates, updates, skips, changed fields and warnings. Nothing is written until Apply, which persists stakeholders through the Power Chart account snapshot and opportunities through the existing OpportunityV2 store. Phase 3b adds the authenticated Lusha and OpenAI API endpoints.

## Fase 3b — API asistida y sincronización

`server/` provides a FastAPI application (`app.main:app`) with SQLite state at `$DATA_DIR/pipeline.db`. `GET /health` and `POST /auth/login` are public; all other routes require a 12-hour HS256 bearer token. Authenticated endpoints include `GET /auth/me`, versioned `GET/PUT/DELETE /state`, `POST /lusha/person`, `POST /llm/signal-analysis`, and `POST /llm/draft-message`. State writes use `baseVersion` optimistic concurrency, allow only `cognition-pipeline-*` and `power-chart:*` keys, and cap JSON values at 2 MiB.

Configure `APP_USERNAME`, bcrypt `APP_PASSWORD_HASH`, `APP_JWT_SECRET`, comma-separated `APP_CORS_ORIGINS`, optional `LUSHA_API_KEY` and `OPENAI_API_KEY`, `LUSHA_DAILY_CAP` (default 25), and `OPENAI_MODEL` (default `gpt-4.1-mini`). The browser enables its login/connect control and provider actions only when `VITE_API_URL` is configured. Login reconciles server state over localStorage, migrates local-only syncable keys, and then reloads. While connected, syncable writes debounce for one second and use optimistic versions; 409 conflicts load the server value, notify the user, and reload. Auth, API URL, and language keys are never synchronized.

The Lusha endpoint caches normalized queries for 30 days and enforces a UTC daily call cap. Enrichment applies only safe stakeholder updates through the CSV dedupe rules; email and phone remain local overlay fields and are excluded from YAML/repository prompts. OpenAI uses the repository's verbatim signal-analysis and draft-message prompts with strict JSON schemas and post-validation against the supplied catalog/stakeholders. Generated outreach remains a draft and must pass the existing human approval step. Provider calls are mocked in tests; no provider credentials or personal contact data belong in the public repository.
