import { useEffect, useRef, useState } from 'react';
import { STAGE_META, STAKEHOLDER_ICON } from '../game/data';
import { company, displayProbability, engage, fmtEur, hasRole, meetingWait, pipelineTotals, respondDemand, runStage, stageList, winProbability } from '../game/engine';
import type { ActionResult } from '../game/engine';
import type { GameState, Opportunity } from '../game/types';

interface Props { s: GameState; act: (fn: (s: GameState) => ActionResult | void) => void; selected?: string }

export function Pipeline({ s, act, selected }: Props) {
  const t = pipelineTotals(s);
  const [openState, setOpen] = useState<{ id: string | null; forSel?: string }>({ id: selected ?? s.opportunities[0]?.id ?? null, forSel: selected });
  const open = selected && openState.forSel !== selected ? selected : openState.id;
  const toggleFor = (id: string) => setOpen({ id: open === id ? null : id, forSel: selected });
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Pipeline" value={fmtEur(t.pipeline)} />
        <Kpi label="Weighted" value={fmtEur(t.weighted)} />
        <Kpi label="Closed Won" value={fmtEur(t.closedWon)} accent />
        <Kpi label="Forecast (Q)" value={fmtEur(t.forecast)} />
      </div>
      {s.opportunities.length === 0 && (
        <div className="empty">No open opportunities. Go to <b>Accounts</b> and prospect a company to book your first meeting.</div>
      )}
      {s.opportunities.map(o => (
        <OppCard key={o.id} o={o} s={s} act={act} open={open === o.id} toggle={() => toggleFor(o.id)} />
      ))}
    </div>
  );
}

export function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: boolean; sub?: string }) {
  return <div className={`kpi ${accent ? 'accent' : ''}`}><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{sub && <div className="kpi-sub">{sub}</div>}</div>;
}

function relColor(r: number) { return r >= 60 ? 'strong' : r >= 30 ? 'neutral' : 'unknown'; }
function relLabel(r: number) { return r >= 60 ? 'Strong' : r >= 30 ? 'Neutral' : 'Unknown'; }

function OppCard({ o, s, act, open, toggle }: { o: Opportunity; s: GameState; act: Props['act']; open: boolean; toggle: () => void }) {
  const c = company(o.companyId);
  const stages = stageList(o);
  const prob = displayProbability(s, o);
  const meta = STAGE_META[o.stage];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [open]);
  const owner = s.employees.find(e => e.id === o.ownerId);
  const needsSE = o.stage === 'Security Review' && !hasRole(s, 'se');
  const nextLabel = o.stage === 'Negotiation' ? (o.demand ? 'Respond below' : meta.action) : meta.action;
  const wait = meetingWait(s, o);
  const disabled = s.focus < meta.cost || needsSE || !!o.demand || wait > 0;
  return (
    <div ref={ref} className={`card opp ${open ? 'open' : ''} tier${c.tier}`}>
      <div className="opp-head" onClick={toggle}>
        <div>
          <div className="card-title">{c.name} <span className={`lvl-pill l${c.tier}`}>L{c.tier}</span> <span className="muted small">{o.source}{owner ? ` · owned by ${owner.name}` : ''}</span></div>
          <div className="muted small">{c.industry} · day {o.daysOpen} in cycle · {o.termYears}y term{o.reference ? ' · reference' : ''}</div>
        </div>
        <div className="opp-nums">
          <div className="acv">{fmtEur(o.value)}{o.value < o.baseValue && <span className="muted small"> (was {fmtEur(o.baseValue)})</span>}</div>
          <div className={`prob ${prob > 0.5 ? 'hi' : prob > 0.25 ? 'mid' : 'lo'}`}>{Math.round(prob * 100)}%</div>
        </div>
      </div>
      <div className="stages">
        {stages.map((st, i) => (
          <div key={st} className={`stage ${i < o.stageIdx ? 'done' : i === o.stageIdx ? 'current' : ''}`}>
            <div className="stage-fill" style={{ width: i < o.stageIdx ? '100%' : i === o.stageIdx ? `${Math.min(100, o.progress)}%` : '0%' }} />
            <span>{st}</span>
          </div>
        ))}
      </div>
      <div className="opp-next">
        <div><span className="muted small">Next action</span><br /><b>{nextLabel}</b> <span className="muted small">— {meta.desc}</span></div>
        {!o.demand && (
          <button className={`btn ${o.stage === 'Closing' ? 'success' : 'primary'}`} disabled={disabled} onClick={() => act(st => runStage(st, o.id))}
            title={needsSE ? 'Hire a Sales Engineer' : ''}>
            {wait > 0 ? `Next meeting in ${wait}d` : o.stage === 'Closing' ? `Close · ${Math.round(winProbability(s, o) * 100)}%` : meta.action} <span className="cost">{meta.cost}⚡</span>
          </button>
        )}
      </div>
      {needsSE && <div className="warn">Security reviews require a Sales Engineer. Hire one in Team.</div>}
      {o.demand && (
        <div className="demand">
          <div className="demand-quote">💬 {o.demand.text}</div>
          <div className="demand-choices">
            <button className="btn" onClick={() => act(st => respondDemand(st, o.id, 'accept'))}>
              <b>Accept</b><span>Higher win chance · {o.demand.kind === 'discount' ? `−${o.demand.amount}% ACV` : `−${o.demand.amount}% ACV (cost)`}</span>
            </button>
            <button className="btn" onClick={() => act(st => respondDemand(st, o.id, 'reject'))}>
              <b>Reject</b><span>Keep ACV · risk annoying them</span>
            </button>
            <button className="btn primary" disabled={o.traded} onClick={() => act(st => respondDemand(st, o.id, 'trade'))}>
              <b>Trade</b><span>{o.traded ? 'Already traded on this deal' : 'Half concession for 3-year contract + reference'}</span>
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="opp-detail">
          <div className="detail-cols">
            <div>
              <div className="muted small">Deal health</div>
              <Meter label="Pain clarity" v={o.pain} />
              <Meter label="Technical confidence" v={o.technical} />
              <Meter label="Win probability at close" v={winProbability(s, o) * 100} />
              <div className="muted small" style={{ marginTop: 8 }}>{c.blurb}</div>
            </div>
            {o.stakeholders.length > 0 && (
              <div>
                <div className="muted small">Stakeholder map · engage to build relationships (2⚡)</div>
                <div className="stakeholders">
                  {o.stakeholders.map(st => (
                    <div key={st.role} className={`stk ${relColor(st.relationship)}`}>
                      <div className="stk-ico">{STAKEHOLDER_ICON[st.role]}</div>
                      <div className="stk-body">
                        <div><b>{st.role}</b> <span className="muted small">{st.name}</span></div>
                        <div className="stk-rel"><span className="dot" /> {relLabel(st.relationship)} · {st.relationship}</div>
                      </div>
                      <button className="btn small" disabled={s.focus < 2 || st.relationship >= 100} onClick={() => act(x => engage(x, o.id, st.role))}>Engage</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {o.log.length > 0 && <ul className="opp-log">{o.log.slice(0, 5).map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}

function Meter({ label, v }: { label: string; v: number }) {
  return <div className="meter"><div className="meter-label"><span>{label}</span><span>{Math.round(v)}%</span></div><div className="bar thin"><div style={{ width: `${Math.min(100, v)}%` }} /></div></div>;
}
