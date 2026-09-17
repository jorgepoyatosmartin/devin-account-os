# devin-account-os

AI-powered Enterprise Account OS built with Devin for account intelligence, sales execution, pipeline generation, and strategic account management.

## SaaS Sales Tycoon (playable demo)

A 3-level incremental/tycoon game about enterprise software sales, built with React + TypeScript + Vite. All company data is fictional and local; no external APIs.

- **Level 1 · Startup** — research, prospect and close SMB accounts manually.
- **Level 2 · Enterprise** — hire an SDR, Enterprise AE and Sales Engineer, sign partners, run multi-stakeholder deals (Discovery → Technical → Business Case → Negotiation → Closing).
- **Level 3 · Strategic Enterprise** — security reviews, procurement and executive relationships to sign a €250K+ contract and finish the demo.

Core loop: `Find Account → Prospect → Meeting → Opportunity → Negotiate → Close → Earn Revenue → Hire → Unlock → Repeat`.

### Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
npx tsx scripts/sim.ts   # 20 headless playthroughs, checks for dead-ends
```

Progress is saved in `localStorage` and continues while you are away.

### Layout

- `src/game/types.ts` — game state types
- `src/game/data.ts` — roles, partners, stages, 22 fictional accounts, achievements
- `src/game/engine.ts` — pure game logic (prospecting, meetings, negotiation, contracts, hiring, automation, ticks)
- `src/game/store.ts` — React hook, save/load, offline progression
- `src/components/` — Accounts, Pipeline, Team, Partners, Modals
