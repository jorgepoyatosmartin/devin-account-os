import { ACHIEVEMENTS, LEVEL_INFO } from '../game/data';
import { company, fmtEur, pipelineTotals } from '../game/engine';
import type { GameState, ModalKind } from '../game/types';

interface Props { s: GameState; m: ModalKind; close: () => void; onRestart: () => void; onContinue: () => void }

export function Modal({ s, m, close, onRestart, onContinue }: Props) {
  let body: React.ReactNode;
  let cls = '';
  switch (m.type) {
    case 'contract': {
      const c = company(m.companyId);
      cls = 'contract';
      body = (
        <>
          <div className="eyebrow">Contract signed</div>
          <h1>{c.name}</h1>
          <div className="big-nums">
            <div><span>ACV</span><b>{fmtEur(m.acv)}</b></div>
            <div><span>Term</span><b>{m.term} year{m.term > 1 ? 's' : ''}</b></div>
            <div><span>TCV</span><b>{fmtEur(m.acv * m.term)}</b></div>
          </div>
          <ul className="gains">
            <li>+ {fmtEur(m.acv)} cash (year 1 upfront)</li>
            <li>+ {m.rep} reputation</li>
            <li>+ Customer reference in {c.industry}</li>
            {m.unlocked.length > 0 && <li className="hl">🔓 {m.unlocked.length} new account{m.unlocked.length > 1 ? 's' : ''} unlocked: {m.unlocked.map(id => company(id).name).join(', ')}</li>}
          </ul>
          <button className="btn primary big" onClick={close}>Celebrate 🎉</button>
        </>
      );
      break;
    }
    case 'unlock':
      cls = 'unlock';
      body = (
        <>
          <div className="eyebrow">New account{m.companyIds.length > 1 ? 's' : ''} unlocked</div>
          {m.companyIds.map(id => { const c = company(id); return <h2 key={id}>{c.name} <span className="muted">· {fmtEur(c.acv)} ACV</span></h2>; })}
          <p className="muted">Every major sale opens new possibilities.</p>
          <button className="btn primary big" onClick={close}>Let's go</button>
        </>
      );
      break;
    case 'level':
      cls = 'level';
      body = (
        <>
          <div className="eyebrow">Level {m.level} unlocked</div>
          <h1>{LEVEL_INFO[m.level].name}</h1>
          <p>{m.level === 2 ? 'You can now hire SDRs, Enterprise AEs and Sales Engineers, sign partners and chase enterprise accounts with multiple stakeholders.' : 'Strategic accounts are now visible. Five stakeholders, security reviews, procurement and the biggest contracts in the game.'}</p>
          <p className="goal">New goal: <b>{LEVEL_INFO[m.level].goal}</b></p>
          <button className="btn primary big" onClick={close}>Continue</button>
        </>
      );
      break;
    case 'lost': {
      const c = company(m.companyId);
      cls = 'lost';
      body = (
        <>
          <div className="eyebrow">Deal lost</div>
          <h2>{c.name}</h2>
          <p>{m.reason}</p>
          <p className="muted small">You can prospect them again after a cooldown. Build stronger relationships and technical confidence next time.</p>
          <button className="btn big" onClick={close}>Move on</button>
        </>
      );
      break;
    }
    case 'achievement': {
      const a = ACHIEVEMENTS.find(x => x.id === m.id)!;
      cls = 'achievement';
      body = (
        <>
          <div className="eyebrow">Achievement</div>
          <h2>🏆 {a.name}</h2>
          <p>{a.desc}</p>
          <button className="btn primary big" onClick={close}>Nice</button>
        </>
      );
      break;
    }
    case 'away':
      cls = 'away';
      body = (
        <>
          <div className="eyebrow">While you were away…</div>
          <h2>{m.days} days passed</h2>
          <ul className="gains">
            <li>{m.leads} meeting{m.leads !== 1 ? 's' : ''} booked by your team</li>
            <li>{fmtEur(Math.max(0, m.pipeline))} pipeline created</li>
            <li>{fmtEur(m.revenue)} revenue collected</li>
            <li>{m.meetings} meetings held</li>
          </ul>
          <button className="btn primary big" onClick={close}>Back to work</button>
        </>
      );
      break;
    case 'complete': {
      const t = pipelineTotals(s);
      cls = 'complete';
      body = (
        <>
          <div className="eyebrow">Demo complete</div>
          <h1>COMPANY BUILT</h1>
          <div className="compare">
            <div>
              <h4>You started with</h4>
              <ul><li>€100K</li><li>1 employee</li><li>0 customers</li><li>1 market</li></ul>
            </div>
            <div>
              <h4>You finished with</h4>
              <ul>
                <li>{fmtEur(s.stats.revenue)} revenue</li>
                <li>{s.employees.length + 1} employees</li>
                <li>{s.contracts.length} customers</li>
                <li>{fmtEur(t.pipeline)} pipeline</li>
                <li>3 levels unlocked · day {s.day}</li>
              </ul>
            </div>
          </div>
          <p className="muted">You started with €100K and one salesperson. You opened your first account, made your first sale, hired your first person, unlocked enterprise — and closed the strategic deal.</p>
          <div className="row">
            <button className="btn big" onClick={onRestart}>Play again</button>
            <button className="btn primary big" onClick={onContinue}>Continue development</button>
          </div>
        </>
      );
      break;
    }
  }
  return (
    <div className="modal-backdrop">
      <div className={`modal ${cls}`}>{body}</div>
    </div>
  );
}
