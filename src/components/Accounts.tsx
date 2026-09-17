import { useEffect, useRef } from 'react';
import { COMPANIES } from '../game/data';
import { capacity, fmtEur, isCustomer, oppFor, prospectChance, prospect, requirements, research } from '../game/engine';
import type { ActionResult } from '../game/engine';
import type { CompanyDef, GameState } from '../game/types';

interface Props { s: GameState; act: (fn: (s: GameState) => ActionResult | void) => void; selected?: string; goPipeline: (id: string) => void }

const LEVEL_LABEL = { 1: 'SMB & Mid-market', 2: 'Enterprise', 3: 'Strategic Enterprise' } as const;

export function Accounts({ s, act, selected, goPipeline }: Props) {
  const groups: (1 | 2 | 3)[] = [1, 2, 3];
  return (
    <div className="stack">
      {groups.map(lv => {
        const list = COMPANIES.filter(c => c.tier === lv);
        const hidden = lv > s.level + 1;
        return (
          <section key={lv}>
            <h3 className="section-title">
              <span className={`lvl-pill l${lv}`}>Level {lv}</span> {LEVEL_LABEL[lv]}
              {lv > s.level && <span className="muted"> · unlocks at level {lv}</span>}
            </h3>
            {hidden ? <div className="muted small">Reach level {lv - 1} to see these accounts.</div> : (
              <div className="grid">
                {list.map(c => <AccountCard key={c.id} c={c} s={s} act={act} highlight={selected === c.id} goPipeline={goPipeline} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Dots({ n, max = 5 }: { n: number; max?: number }) {
  return <span className="dots">{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}

function AccountCard({ c, s, act, highlight, goPipeline }: { c: CompanyDef; s: GameState; act: Props['act']; highlight: boolean; goPipeline: (id: string) => void }) {
  const a = s.accounts[c.id];
  const opp = oppFor(s, c.id);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [highlight]);
  const reqs = requirements(s, c);
  const locked = a.status === 'locked';
  const customer = isCustomer(s, c.id);
  const cooldown = s.day < a.cooldownUntil;
  const full = s.opportunities.length >= capacity(s);
  return (
    <div ref={ref} className={`card account ${locked ? 'locked' : ''} ${customer ? 'customer' : ''} ${highlight ? 'highlight' : ''}`}>
      <div className="card-head">
        <div>
          <div className="card-title">{locked && <span className="lock">🔒</span>} {c.name}</div>
          <div className="muted small">{c.industry} · {c.region} · {c.employees.toLocaleString()} employees</div>
        </div>
        <div className="acv">{fmtEur(c.acv)}<span className="muted small"> ACV</span></div>
      </div>
      <div className="meta-row">
        <span title="Difficulty">Difficulty <Dots n={c.difficulty} /></span>
        <span>Cycle: <b>{c.cycle}</b></span>
        <span>Expansion: <b>{c.expansion}</b></span>
      </div>
      {c.tier > 1 && <div className="muted small">Stakeholders: {c.stakeholders.join(', ')}</div>}
      {locked && (
        <ul className="reqs">
          {reqs.map(r => <li key={r.label} className={r.met ? 'met' : ''}>{r.met ? '✓' : '○'} {r.label}</li>)}
        </ul>
      )}
      {customer && <div className="badge good">✓ Customer · {fmtEur(s.contracts.find(k => k.companyId === c.id)!.acv)} ACV</div>}
      {!locked && !customer && (
        <>
          {a.research > 0 && <div className="muted small blurb">{a.research >= 100 ? c.blurb : 'Partially researched.'}</div>}
          <div className="bar"><div style={{ width: `${a.research}%` }} /><span>Research {a.research}%</span></div>
          {opp ? (
            <button className="btn ghost" onClick={() => goPipeline(opp.id)}>In pipeline → {opp.stage}</button>
          ) : (
            <div className="actions">
              <button className="btn" disabled={a.research >= 100 || s.focus < 2} onClick={() => act(st => research(st, c.id))}>Research <span className="cost">2⚡</span></button>
              <button className="btn primary" disabled={s.focus < 3 || cooldown || full} onClick={() => act(st => prospect(st, c.id))}
                title={full ? 'Opportunity capacity full' : ''}>
                {cooldown ? `Come back in ${a.cooldownUntil - s.day}d` : full ? 'Capacity full' : `Prospect · ${Math.round(prospectChance(s, c) * 100)}%`} <span className="cost">3⚡</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

