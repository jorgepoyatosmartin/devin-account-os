import { useState } from 'react';
import { Accounts } from './components/Accounts';
import { Modal } from './components/Modals';
import { Kpi, Pipeline } from './components/Pipeline';
import { Partners, Team } from './components/Team';
import { ACHIEVEMENTS, LEVEL_INFO } from './game/data';
import { fmtEur, focusRegen, monthlyBurn, pipelineTotals, recommendations } from './game/engine';
import { loadSave, useGame } from './game/store';
import type { GameState } from './game/types';

type Tab = 'accounts' | 'pipeline' | 'team' | 'partners' | 'log';

export default function App() {
  const game = useGame(loadSave());
  const [tab, setTab] = useState<Tab>('accounts');
  const [selected, setSelected] = useState<string | undefined>();
  const { state: s, act, start, reset, toasts } = game;

  if (!s) return <Start onStart={start} />;

  const go = (t: string, id?: string) => { setTab(t as Tab); setSelected(id); };
  const modal = s.modals[0];
  const recs = recommendations(s);
  const t = pipelineTotals(s);
  const month = Math.floor((s.day - 1) / 30) + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const lvl = LEVEL_INFO[s.level];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">▲</div>
          <div><div className="company">{s.companyName}</div><div className="muted small">Day {s.day} · Month {month} · Q{quarter}</div></div>
        </div>
        <div className={`level-badge l${s.level}`}>LEVEL {s.level} · {lvl.name}<span>{lvl.goal}</span></div>
        <div className="focus" title="Focus: your sales time. Actions cost focus; it regenerates every day.">
          <div className="focus-bar"><div style={{ width: `${(s.focus / s.focusMax) * 100}%` }} /></div>
          <span>⚡ {s.focus}/{s.focusMax} <small>+{focusRegen(s)}/day</small></span>
        </div>
        <div className="speed">
          {([0, 1, 2, 4] as const).map(sp => (
            <button key={sp} className={s.speed === sp ? 'on' : ''} onClick={() => act(st => { st.speed = sp; }, false)}>{sp === 0 ? '❚❚' : `${sp}×`}</button>
          ))}
        </div>
        <button className="btn ghost small" onClick={() => { if (confirm('Reset the game and start over?')) reset(); }}>Reset</button>
      </header>

      <section className="kpis top">
        <Kpi label="Cash" value={fmtEur(s.cash)} accent sub={monthlyBurn(s) ? `−${fmtEur(monthlyBurn(s))}/mo payroll` : 'no payroll yet'} />
        <Kpi label="Revenue" value={fmtEur(s.stats.revenue)} sub={`${s.stats.won} deals won`} />
        <Kpi label="Customers" value={String(s.contracts.length)} />
        <Kpi label="Employees" value={String(s.employees.length + 1)} />
        <Kpi label="Reputation" value={String(s.reputation)} />
        <div className="kpi-sep" />
        <Kpi label="Quota (Q)" value={fmtEur(lvl.quota)} />
        <Kpi label="Closed Won (Q)" value={fmtEur(s.quarterClosed)} sub={`${Math.min(100, Math.round(s.quarterClosed / lvl.quota * 100))}% of quota`} />
        <Kpi label="Pipeline" value={fmtEur(t.pipeline)} />
        <Kpi label="Forecast" value={fmtEur(t.forecast)} />
      </section>

      <div className="body">
        <aside className="side">
          <div className="panel">
            <h3>What should I do next?</h3>
            {recs.length === 0 && <div className="muted small">You're on top of everything. Let time run.</div>}
            {recs.map((r, i) => (
              <button key={i} className={`rec ${r.color}`} onClick={() => r.target && go(r.target.tab, r.target.id)}>
                <span className="rec-dot" />{r.text}
              </button>
            ))}
          </div>
          <Progression s={s} />
          <div className="panel">
            <h3>Achievements <span className="muted small">{s.achievements.length}/{ACHIEVEMENTS.length}</span></h3>
            <div className="ach-list">
              {ACHIEVEMENTS.map(a => <div key={a.id} className={`ach ${s.achievements.includes(a.id) ? 'on' : ''}`} title={a.desc}>🏆 {a.name}</div>)}
            </div>
          </div>
        </aside>

        <main className="main">
          <nav className="tabs">
            {(['accounts', 'pipeline', 'team', 'partners', 'log'] as Tab[]).map(tb => (
              <button key={tb} className={tab === tb ? 'on' : ''} onClick={() => { setTab(tb); setSelected(undefined); }}>
                {tb === 'pipeline' && s.opportunities.length > 0 ? `Pipeline (${s.opportunities.length})` : tb[0].toUpperCase() + tb.slice(1)}
                {tb === 'team' && s.level >= 2 && s.employees.length === 0 && <span className="pip" />}
              </button>
            ))}
          </nav>
          {tab === 'accounts' && <Accounts s={s} act={act} selected={selected} goPipeline={id => go('pipeline', id)} />}
          {tab === 'pipeline' && <Pipeline s={s} act={act} selected={selected} />}
          {tab === 'team' && <Team s={s} act={act} />}
          {tab === 'partners' && <Partners s={s} act={act} />}
          {tab === 'log' && <Log s={s} />}
        </main>
      </div>

      <div className="toasts">{toasts.map(tt => <div key={tt.id} className={`toast ${tt.good ? 'good' : 'bad'}`}>{tt.text}</div>)}</div>

      {modal && (
        <Modal s={s} m={modal} close={() => act(st => { st.modals.shift(); }, false)}
          onRestart={reset}
          onContinue={() => act(st => { st.modals.shift(); st.continued = true; }, false)} />
      )}
    </div>
  );
}

function Progression({ s }: { s: GameState }) {
  const steps = [
    { label: 'Level 1 · Startup', done: true },
    { label: 'First 2 customers', done: s.stats.won >= 2, sub: `${Math.min(2, s.stats.won)}/2` },
    { label: 'Level 2 · Enterprise', done: s.level >= 2 },
    { label: 'Hire your team', done: s.employees.length > 0, sub: `${s.employees.length} hired` },
    { label: 'Enterprise deal (€50K+)', done: s.level >= 3 },
    { label: 'Level 3 · Strategic', done: s.level >= 3 },
    { label: 'Strategic deal (€250K+)', done: s.completed },
    { label: 'Company built', done: s.completed },
  ];
  return (
    <div className="panel">
      <h3>Progression</h3>
      <ol className="progression">
        {steps.map((st, i) => <li key={i} className={st.done ? 'done' : ''}>{st.done ? '✓' : '○'} {st.label} {st.sub && !st.done && <span className="muted small">{st.sub}</span>}</li>)}
      </ol>
    </div>
  );
}

function Log({ s }: { s: GameState }) {
  return <ul className="log">{s.log.map(l => <li key={l.id} className={l.kind}><span className="muted small">D{l.day}</span> {l.text}</li>)}</ul>;
}

function Start({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState('Nimbus Software');
  return (
    <div className="start">
      <div className="start-card">
        <div className="eyebrow">B2B Software Sales Tycoon · Demo</div>
        <h1>Build a software company,<br />one deal at a time.</h1>
        <p className="muted">You have €100K, one basic product, five small prospects in Spain — and yourself. Prospect, run meetings, negotiate, close, hire, and unlock bigger enterprise accounts until you sign a strategic deal.</p>
        <label>Company name<input value={name} onChange={e => setName(e.target.value)} maxLength={28} /></label>
        <button className="btn primary big" onClick={() => onStart(name.trim() || 'Nimbus Software')}>Start company</button>
        <div className="how">
          <div><b>1 · Startup</b><span>Close your first 2 customers</span></div>
          <div><b>2 · Enterprise</b><span>Hire a team, win a €50K+ deal</span></div>
          <div><b>3 · Strategic</b><span>Multithread five stakeholders, sign €250K+</span></div>
        </div>
      </div>
    </div>
  );
}
