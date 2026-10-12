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
- `accounts/<id>/territory.yaml`: `tier: A|B|C`, `potentialEur: number|null`, `effortPct: number`, `segment`, `priority: 1..5`, `rationale`, `evidence[]`.
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
