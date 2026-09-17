import { PARTNERS, ROLES } from '../game/data';
import { capacity, count, fmtEur, focusRegen, hire, investPartner, monthlyBurn } from '../game/engine';
import type { ActionResult } from '../game/engine';
import type { GameState, RoleId } from '../game/types';
import { Kpi } from './Pipeline';

interface Props { s: GameState; act: (fn: (s: GameState) => ActionResult | void) => void }

export function Team({ s, act }: Props) {
  const roles: RoleId[] = ['sdr', 'ae', 'se'];
  const locked = s.level < 2;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Headcount" value={String(s.employees.length + 1)} />
        <Kpi label="Monthly payroll" value={fmtEur(monthlyBurn(s))} />
        <Kpi label="Focus / day" value={`${focusRegen(s)}⚡`} />
        <Kpi label="Deal capacity" value={`${s.opportunities.length} / ${capacity(s)}`} />
      </div>
      {locked && <div className="empty">Hiring unlocks at <b>Level 2</b>. Close your first 2 customers.</div>}
      <div className="grid">
        <div className="card person founder">
          <div className="card-title">You · Founder & AE</div>
          <div className="muted small">Salary €0 · does everything · 1⚡ / day</div>
        </div>
        {s.employees.map(e => (
          <div key={e.id} className="card person">
            <div className="card-title">{e.name}</div>
            <div className="muted small">{ROLES[e.role].name} · {fmtEur(e.salary)}/mo · joined day {e.hiredDay}</div>
          </div>
        ))}
      </div>
      <h3 className="section-title">Open roles</h3>
      <div className="grid">
        {roles.map(r => {
          const def = ROLES[r];
          const n = count(s, r);
          return (
            <div key={r} className={`card role ${locked ? 'locked' : ''}`}>
              <div className="card-head">
                <div className="card-title">{def.name} {n > 0 && <span className="badge">×{n}</span>}</div>
                <div className="acv">{fmtEur(def.salary)}<span className="muted small">/mo</span></div>
              </div>
              <div className="muted small">{def.desc}</div>
              <ul className="effects">{def.effects.map(e => <li key={e}>+ {e}</li>)}</ul>
              <button className="btn primary" disabled={locked || s.cash < def.hireCost} onClick={() => act(st => hire(st, r))}>
                Hire · {fmtEur(def.hireCost)} signing
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Partners({ s, act }: Props) {
  const locked = s.level < 2;
  return (
    <div className="stack">
      {locked && <div className="empty">Partners unlock at <b>Level 2</b>.</div>}
      <div className="muted small">Active partners introduce you to enterprise accounts with warm executive relationships every ~25 days, and generate reputation. Some accounts only buy through partners.</div>
      <div className="grid">
        {PARTNERS.map(p => {
          const st = s.partners.find(x => x.id === p.id)!;
          return (
            <div key={p.id} className={`card role ${locked ? 'locked' : ''} ${st.active ? 'customer' : ''}`}>
              <div className="card-head">
                <div><div className="card-title">{p.name}</div><div className="muted small">{p.kind}</div></div>
                <div className="acv">{fmtEur(p.cost)}</div>
              </div>
              <div className="muted small">{p.desc}</div>
              <ul className="effects"><li>+ Warm introductions to enterprise accounts</li><li>+ Reputation</li><li>○ Requires reputation {p.repReq}</li></ul>
              {st.active ? <div className="badge good">✓ Active partnership</div> : (
                <button className="btn primary" disabled={locked || s.cash < p.cost || s.reputation < p.repReq} onClick={() => act(x => investPartner(x, p.id))}>
                  {s.reputation < p.repReq ? `Needs reputation ${p.repReq}` : `Invest ${fmtEur(p.cost)}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
