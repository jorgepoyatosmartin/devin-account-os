import { useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Account, Evidence, MeetingNote, Opportunity, Stakeholder, ValidationStatus } from './types';
import { accountById, dataset as sourceDataset, opportunitiesForAccount, signalsForAccount, stakeholderById, stakeholdersForAccount } from './data';
import { isFullyQualified, threeWhysStatus, validationKeys } from './lib/threeWhys';
import { mergeDataset, mergeOverrides, useOverrides } from './store';

const tabs = ['Overview', '3 WHYS', 'MEDDPICC', 'Meeting Prep', 'Post-Meeting Update'];
const statusOptions: ValidationStatus[] = ['Confirmed', 'Validated', 'Partially validated', 'Hypothesis'];

function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return <div className="muted">No evidence captured yet.</div>;
  return <div className="evidence-list">{evidence.map((item, index) => (
    <div className="evidence-row" key={`${item.claim}-${index}`}>
      <div><strong>{item.claim}</strong><div className="muted">{item.source}</div></div>
      <Badge tone={`category-${item.category}`}>{item.category}</Badge>
      <span className="confidence">{item.confidence}</span>
      <span>{item.date || '—'}</span>
      {item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open ↗</a> : <span className="muted">No URL</span>}
    </div>
  ))}</div>;
}

function Section({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`section ${className}`}>
    {eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{children}
  </section>;
}

function Editable({ value, onChange, multiline = false, placeholder = 'Add note…' }: { value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
  return multiline
    ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

function Layout({ children, dataset, reset, exportData }: { children: React.ReactNode; dataset: typeof sourceDataset; reset: () => void; exportData: () => void }) {
  const nav = [
    ['/', 'Daily Cockpit', '⌂'],
    ['/accounts', 'Accounts', '▦'],
    ['/opportunities', 'Opportunities', '◇'],
    ['/signals', 'Signals', '◌'],
    ['/stakeholders', 'Stakeholders', '◎'],
    ['/weekly-review', 'Weekly Review', '◷'],
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">C</div><div><strong>COGNITION</strong><span>PIPELINE OS</span></div></div>
      <div className="workspace"><span className="status-dot" /> LOCAL WORKSPACE <span className="chevron">⌄</span></div>
      <nav>{nav.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</nav>
      <div className="sidebar-bottom">
        <div className="data-status"><span className="status-dot" />{dataset.accounts.length} account loaded</div>
        <button className="sidebar-button" onClick={exportData}>⇩ Export data (JSON)</button>
        <button className="sidebar-button muted-button" onClick={reset}>↺ Reset local edits</button>
        <div className="version">v0.1 • Local first</div>
      </div>
    </aside>
    <main className="main-content">{children}</main>
  </div>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{action}</header>;
}

function Traffic({ op }: { op: Opportunity }) {
  const status = threeWhysStatus(op);
  return <Badge tone={`traffic-${status.tone}`}>{status.emoji} {status.label}</Badge>;
}

function Inconsistent({ op }: { op: Opportunity }) {
  return (['Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] as string[]).includes(op.stage) && !isFullyQualified(op)
    ? <Badge tone="warning">Stage inconsistent with 3 Whys validation</Badge> : null;
}

function Cockpit({ dataset }: { dataset: typeof sourceDataset }) {
  const actions = [...dataset.cockpitActions].sort((a, b) => a.priority - b.priority).slice(0, 5);
  return <><PageHeader eyebrow="DAILY COCKPIT / MONDAY 08:42" title="WHAT SHOULD I DO TODAY?" subtitle="A focused operating view of the accounts and actions that move pipeline forward." />
    <div className="metric-row"><div className="metric"><span>Open pipeline</span><strong>{dataset.opportunities.length}</strong><small>active opportunities</small></div><div className="metric"><span>Validation health</span><strong>{dataset.opportunities.filter(isFullyQualified).length}<em>/{dataset.opportunities.length}</em></strong><small>fully qualified</small></div><div className="metric"><span>Actions due</span><strong>{actions.length}</strong><small>prioritized for today</small></div><div className="metric"><span>Accounts</span><strong>{dataset.accounts.length}</strong><small>in workspace</small></div></div>
    <Section eyebrow="PRIORITY QUEUE" title="Today's focus">
      <div className="action-grid">{actions.map((action) => {
        const account = accountById(action.accountId); const op = action.opportunityId ? dataset.opportunities.find((item) => item.id === action.opportunityId) : undefined;
        const stakeholder = action.stakeholderId ? stakeholderById(action.stakeholderId) : undefined;
        return <article className="action-card" key={action.id}><div className="card-top"><Badge tone="priority">P{action.priority}</Badge><span className="muted">{account?.name}</span></div><h3>{op?.name || action.signal}</h3><div className="entity-line">{stakeholder?.name || 'Stakeholder pending'} <span>·</span> {action.signal}</div><div className="mini-label">3 WHYS STATUS</div>{op && <Traffic op={op} />}<div className="action-block"><span>WHY THIS MATTERS</span><p>{action.whyThisMatters}</p></div><div className="action-block"><span>RECOMMENDED ACTION</span><p>{action.recommendedAction}</p></div><div className="message-block"><span>SUGGESTED MESSAGE <button onClick={() => navigator.clipboard?.writeText(action.suggestedMessage)}>COPY</button></span><code>{action.suggestedMessage}</code></div><div className="action-outcome"><span>EXPECTED OUTCOME</span><strong>{action.expectedOutcome}</strong></div></article>;
      })}</div>
    </Section>
    <Section eyebrow="PIPELINE SNAPSHOT" title="All opportunities">
      <PipelineTable opportunities={dataset.opportunities} dataset={dataset} />
    </Section>
  </>;
}

function PipelineTable({ opportunities, dataset }: { opportunities: Opportunity[]; dataset: typeof sourceDataset }) {
  return <div className="table-wrap"><table><thead><tr><th>Account</th><th>Opportunity</th><th>Stage</th><th>Potential value</th><th>3 Whys</th><th>Confidence</th><th>Next action</th></tr></thead><tbody>{opportunities.map((op) => <tr key={op.id}><td><Link to={`/accounts/${op.accountId}`}>{accountById(op.accountId)?.name}</Link></td><td><Link to={`/opportunities/${op.id}`}>{op.name}</Link></td><td><Badge>{op.stage}</Badge><Inconsistent op={op} /></td><td>{op.potentialValue}</td><td><Traffic op={op} /></td><td>{op.confidence}</td><td>{op.nextAction}</td></tr>)}</tbody></table></div>;
}

function AccountsPage({ dataset }: { dataset: typeof sourceDataset }) {
  return <><PageHeader eyebrow="ACCOUNTS / PORTFOLIO" title="Accounts" subtitle="Account intelligence, strategic priorities, and whitespace." /><div className="account-grid">{dataset.accounts.map((account) => <Link className="account-card" to={`/accounts/${account.id}`} key={account.id}><div className="account-avatar">{account.name.slice(0, 1)}</div><div><div className="eyebrow">{account.sector}</div><h2>{account.name}</h2><p>{account.overview}</p><div className="card-stats"><span>{opportunitiesForAccount(account.id).length} opportunities</span><span>{stakeholdersForAccount(account.id).length} stakeholders</span><span>{signalsForAccount(account.id).length} signals</span></div></div><span className="arrow">→</span></Link>)}</div></>;
}

function AccountDetail({ dataset, setOverride }: { dataset: typeof sourceDataset; setOverride: (id: string, path: string, value: unknown) => void }) {
  const { id = '' } = useParams(); const account = dataset.accounts.find((item) => item.id === id); const [tab, setTab] = useState('Company');
  if (!account) return <NotFound />;
  const tabs = ['Company', 'Strategic Initiatives', 'Signals', 'Stakeholders', 'Use Cases', 'Whitespace', 'Opportunities'];
  const accountStakeholders = dataset.stakeholders.filter((item) => item.accountId === account.id);
  return <><PageHeader eyebrow={`ACCOUNT PLAN / ${account.sector.toUpperCase()}`} title={account.name} subtitle={`${account.headquarters} · ${account.employees} employees · ${account.geographicFootprint}`} action={<Link className="button secondary" to="/accounts">← All accounts</Link>} />
    <div className="tab-bar">{tabs.map((item) => <button className={tab === item ? 'selected' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
    {tab === 'Company' && <><Section title="Company profile" eyebrow="OVERVIEW"><p className="lead">{account.overview}</p><div className="detail-grid">{[['Revenue', account.revenue], ['Employees', account.employees], ['Headquarters', account.headquarters], ['Geographic footprint', account.geographicFootprint], ['Financial performance', account.financialPerformance], ['Business units', account.businessUnits.join(', ')], ['Products & services', account.productsServices.join(', ')], ['Growth priorities', account.growthPriorities.join(', ')], ['Cost restructuring', account.costRestructuringInitiatives.join(', ')], ['M&A activity', account.mnaActivity.join(', ')]].map(([label, value]) => <div className="detail-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></Section><Section title="Company evidence" eyebrow="SOURCE REGISTER"><EvidenceList evidence={account.companyEvidence} /></Section></>}
    {tab === 'Strategic Initiatives' && <Section title="Strategic initiatives" eyebrow="WHAT THE ACCOUNT IS PRIORITISING"><div className="initiative-list">{account.initiatives.map((initiative) => <article className="initiative" key={initiative.id}><div className="initiative-heading"><div><Badge tone="category-SOURCE-BASED INTERPRETATION">{initiative.area}</Badge><h3>{initiative.name}</h3></div><p>{initiative.cognitionRelevance}</p></div><div className="flow-grid"><div><span>BUSINESS OBJECTIVE</span><p>{initiative.businessObjective}</p></div><div className="evidence-mini"><span>EVIDENCE</span><EvidenceList evidence={initiative.evidence} /></div></div></article>)}</div></Section>}
    {tab === 'Signals' && <Section title="Account signals" eyebrow="SIGNAL MONITOR"><div className="signal-list">{dataset.signals.filter((item) => item.accountId === account.id).map((signal) => <article className="signal-card" key={signal.id}><div className="card-top"><Badge tone={`category-${signal.category}`}>{signal.category}</Badge><span>{signal.date} · {signal.source}</span></div><h3>{signal.signal}</h3><div className="three-col"><div><span>BUSINESS RELEVANCE</span><p>{signal.businessRelevance}</p></div><div><span>COGNITION RELEVANCE</span><p>{signal.cognitionRelevance}</p></div><div><span>3 WHYS IMPACT / SALES ACTION</span><p>{signal.threeWhysImpact}</p><p>{signal.salesAction}</p></div></div>{signal.url && <a href={signal.url} target="_blank" rel="noreferrer">Source ↗</a>}</article>)}</div></Section>}
    {tab === 'Stakeholders' && <Section title="Stakeholder map" eyebrow="RELATIONSHIP COVERAGE"><StakeholderTable stakeholders={accountStakeholders} setOverride={setOverride} /></Section>}
    {tab === 'Use Cases' && <Section title="Use cases" eyebrow="VALUE HYPOTHESES"><div className="usecase-grid">{account.useCases.map((item) => <article className="card" key={item.id}><h3>{item.name}</h3><div className="three-col"><div><span>WHY ANYTHING</span><p>{item.whyAnything}</p></div><div><span>WHY NOW</span><p>{item.whyNow}</p></div><div><span>WHY COGNITION</span><p>{item.whyCognition}</p></div></div><div className="outcome"><span>BUSINESS OUTCOME</span>{item.businessOutcome}</div></article>)}</div></Section>}
    {tab === 'Whitespace' && <Section title="Whitespace" eyebrow="EXPANSION MAP"><div className="table-wrap"><table><thead><tr><th>Area</th><th>Current relationship</th><th>Existing use cases</th><th>Untapped areas</th><th>Potential opportunity</th></tr></thead><tbody>{account.whitespace.map((item) => <tr key={item.area}><td><strong>{item.area}</strong></td><td>{item.currentRelationship}</td><td>{item.existingUseCases}</td><td>{item.untappedAreas}</td><td>{item.potentialOpportunity}</td></tr>)}</tbody></table></div></Section>}
    {tab === 'Opportunities' && <Section title="Account opportunities" eyebrow="PIPELINE"><div className="opportunity-list">{dataset.opportunities.filter((item) => item.accountId === account.id).map((op) => <Link to={`/opportunities/${op.id}`} className="opportunity-row" key={op.id}><div><Badge>{op.stage}</Badge><h3>{op.name}</h3><p>{op.useCase}</p></div><div><Traffic op={op} /><strong>{op.potentialValue}</strong></div><span>→</span></Link>)}</div></Section>}
  </>;
}

function StakeholderTable({ stakeholders, setOverride }: { stakeholders: Stakeholder[]; setOverride: (id: string, path: string, value: unknown) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Person</th><th>Function</th><th>Relationship</th><th>Buying role</th><th>Priorities</th><th></th></tr></thead><tbody>{stakeholders.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.title}</small></td><td>{person.functionArea}</td><td><select value={person.relationshipStatus} onChange={(e) => setOverride(person.id, 'relationshipStatus', e.target.value)}>{['No contact', 'Identified', 'Contacted', 'Engaged', 'Champion'].map((x) => <option key={x}>{x}</option>)}</select></td><td><select value={person.buyingRole} onChange={(e) => setOverride(person.id, 'buyingRole', e.target.value)}>{['Economic Buyer', 'Champion', 'Influencer', 'Technical evaluator', 'Blocker', 'Unknown'].map((x) => <option key={x}>{x}</option>)}</select></td><td>{person.strategicPriorities}</td><td><details><summary>Details</summary><div className="details-popover"><p><b>Responsibilities:</b> {person.responsibilities}</p><p><b>Technology priorities:</b> {person.technologyPriorities}</p><p><b>Potential pain:</b> {person.potentialPain}</p><p><b>Recent activity:</b> {person.recentActivity}</p><p><b>Cognition relevance:</b> {person.cognitionRelevance}</p><EvidenceList evidence={[...person.publicStatements, ...person.sources]} /></div></details></td></tr>)}</tbody></table></div>;
}

function OpportunitiesPage({ dataset }: { dataset: typeof sourceDataset }) {
  return <><PageHeader eyebrow="OPPORTUNITIES / PIPELINE" title="Opportunities" subtitle="Every deal, its validation health, and the next move." /><div className="pipeline-kpis"><div><span>Identified</span><strong>{dataset.opportunities.filter((x) => x.stage === 'Identified').length}</strong></div><div><span>In discovery</span><strong>{dataset.opportunities.filter((x) => x.stage === 'Discovery').length}</strong></div><div><span>Qualified+</span><strong>{dataset.opportunities.filter((x) => ['Qualified', 'Proposal', 'Negotiation'].includes(x.stage)).length}</strong></div><div><span>Green 3 Whys</span><strong>{dataset.opportunities.filter(isFullyQualified).length}</strong></div></div><Section title="Pipeline register" eyebrow="ACTIVE DEALS"><PipelineTable opportunities={dataset.opportunities} dataset={dataset} /></Section></>;
}

function OpportunityDetail({ dataset, setOverride, meetingNotes, saveMeetingNote }: { dataset: typeof sourceDataset; setOverride: (id: string, path: string, value: unknown) => void; meetingNotes: MeetingNote[]; saveMeetingNote: (note: MeetingNote) => void }) {
  const { id = '' } = useParams(); const raw = dataset.opportunities.find((item) => item.id === id); const [tab, setTab] = useState(() => location.hash.replace('#', '') || 'Overview');
  if (!raw) return <NotFound />; const op = raw; const account = dataset.accounts.find((item) => item.id === op.accountId)!; const people = op.stakeholderIds.map((sid) => dataset.stakeholders.find((item) => item.id === sid)).filter(Boolean) as Stakeholder[];
  const selectTab = (next: string) => { setTab(next); window.history.replaceState({}, '', `${window.location.pathname}#${next}`); };
  return <><PageHeader eyebrow={`OPPORTUNITY / ${op.stage.toUpperCase()}`} title={op.name} subtitle={`${account.name} · ${op.businessUnit} · ${op.useCase}`} action={<Link className="button secondary" to="/opportunities">← Pipeline</Link>} /><div className="op-header-strip"><Badge>{op.stage}</Badge><Traffic op={op} /><Inconsistent op={op} /><span className="confidence">Confidence: {op.confidence}</span></div><div className="tab-bar opportunity-tabs">{tabs.map((item) => <button className={tab === item ? 'selected' : ''} onClick={() => selectTab(item)} key={item}>{item}</button>)}</div>
    {tab === 'Overview' && <OpportunityOverview op={op} people={people} setOverride={setOverride} dataset={dataset} />}
    {tab === '3 WHYS' && <ThreeWhysPanel op={op} setOverride={setOverride} />}
    {tab === 'MEDDPICC' && <MeddpiccPanel op={op} setOverride={setOverride} />}
    {tab === 'Meeting Prep' && <MeetingPrep op={op} account={account} people={people} dataset={dataset} />}
    {tab === 'Post-Meeting Update' && <PostMeeting op={op} meetingNotes={meetingNotes} saveMeetingNote={saveMeetingNote} setOverride={setOverride} />}
  </>;
}

function OpportunityOverview({ op, people, setOverride, dataset }: { op: Opportunity; people: Stakeholder[]; setOverride: (id: string, path: string, value: unknown) => void; dataset: typeof sourceDataset }) {
  const initiative = dataset.accounts.find((x) => x.id === op.accountId)?.initiatives.find((x) => x.id === op.initiativeId);
  return <><Section title="Deal overview" eyebrow="COMMERCIAL CONTEXT"><div className="detail-grid"><div className="detail-item"><span>Business unit</span><strong>{op.businessUnit}</strong></div><div className="detail-item"><span>Use case</span><strong>{op.useCase}</strong></div><div className="detail-item"><span>Potential value</span><strong>{op.potentialValue}</strong></div><div className="detail-item"><span>Initiative</span><strong>{initiative?.name || 'Not linked'}</strong></div><div className="detail-item"><span>Competition</span><strong>{op.competition}</strong></div><div className="detail-item"><span>Confidence</span><strong>{op.confidence}</strong></div></div><div className="edit-grid"><label>Stage<select value={op.stage} onChange={(e) => setOverride(op.id, 'stage', e.target.value)}>{['Identified', 'Discovery', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Next action<Editable value={op.nextAction} onChange={(value) => setOverride(op.id, 'nextAction', value)} /></label></div></Section><Section title="Buying committee" eyebrow="STAKEHOLDERS">{people.length ? <div className="people-grid">{people.map((person) => <div className="person-card" key={person.id}><div className="account-avatar">{person.name.slice(0, 1)}</div><div><strong>{person.name}</strong><span>{person.title} · {person.functionArea}</span><Badge>{person.buyingRole}</Badge><small>{person.relationshipStatus}</small></div></div>)}</div> : <div className="muted">No stakeholders linked.</div>}</Section><Section title="Deal evidence" eyebrow="SOURCE REGISTER"><EvidenceList evidence={op.evidence} /></Section></>;
}

function ThreeWhysPanel({ op, setOverride }: { op: Opportunity; setOverride: (id: string, path: string, value: unknown) => void }) {
  const status = threeWhysStatus(op); const rowLabels = { situation: 'Situation', problem: 'Problem', implication: 'Implication', whyNow: 'Why Now', whyCognition: 'Why Cognition' } as const;
  return <div className="three-whys"><div className="executive-summary"><div><div className="eyebrow">EXECUTIVE SUMMARY</div><h2>Why this opportunity exists</h2><div className="summary-lines"><p><b>WHY ANYTHING</b> {op.threeWhys.whyAnything.situation} → {op.threeWhys.whyAnything.problem} → {op.threeWhys.whyAnything.implication}</p><p><b>WHY NOW</b> {op.threeWhys.whyNow.urgency}</p><p><b>WHY COGNITION</b> {op.threeWhys.whyCognition.businessOutcome}</p></div></div><div className={`big-status ${status.tone}`}>{status.emoji}<strong>{status.label}</strong><span>validation status</span></div></div>
    <Section title="WHY ANYTHING" eyebrow="THE CUSTOMER'S CURRENT REALITY"><Flow title="Situation" text={op.threeWhys.whyAnything.situation} /><div className="flow-arrow">↓</div><Flow title="Problem" text={op.threeWhys.whyAnything.problem} /><div className="flow-arrow">↓</div><Flow title="Implication" text={op.threeWhys.whyAnything.implication} /></Section>
    <Section title="WHY NOW" eyebrow="THE CASE FOR ACTION"><div className="three-col flow-panels"><Flow title="Trigger" text={op.threeWhys.whyNow.trigger} /><Flow title="Timing" text={op.threeWhys.whyNow.timing} /><Flow title="Urgency" text={op.threeWhys.whyNow.urgency} /></div></Section>
    <Section title="WHY COGNITION" eyebrow="THE VALUE HYPOTHESIS"><div className="three-col flow-panels"><Flow title="Customer pain" text={op.threeWhys.whyCognition.customerPain} /><Flow title="Cognition capability" text={op.threeWhys.whyCognition.cognitionCapability} /><Flow title="Business outcome" text={op.threeWhys.whyCognition.businessOutcome} /></div></Section>
    <Section title="Validation" eyebrow="DISCIPLINE THE HYPOTHESIS"><div className="table-wrap validation-table"><table><thead><tr><th>Element</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{validationKeys().map((key) => <tr key={key}><td><strong>{rowLabels[key]}</strong></td><td><select value={op.threeWhys.validation[key].status} onChange={(e) => setOverride(op.id, `threeWhys.validation.${key}.status`, e.target.value)}>{statusOptions.map((x) => <option key={x}>{x}</option>)}</select></td><td><Editable value={op.threeWhys.validation[key].evidence} multiline onChange={(value) => setOverride(op.id, `threeWhys.validation.${key}.evidence`, value)} /></td></tr>)}</tbody></table></div></Section>
    <Section title="Discovery questions" eyebrow="WHAT TO LEARN NEXT"><div className="question-grid">{validationKeys().map((key) => <div key={key}><h3>{rowLabels[key]}</h3><ul>{op.threeWhys.discoveryQuestions[key].map((question) => <li key={question}>{question}</li>)}</ul></div>)}</div></Section>
  </div>;
}

function Flow({ title, text }: { title: string; text: string }) { return <div className="flow-card"><span>{title}</span><p>{text}</p></div>; }

function MeddpiccPanel({ op, setOverride }: { op: Opportunity; setOverride: (id: string, path: string, value: unknown) => void }) {
  const fields: [keyof Opportunity['meddpicc'], string][] = [['metrics', 'Metrics'], ['economicBuyer', 'Economic Buyer'], ['decisionCriteria', 'Decision Criteria'], ['decisionProcess', 'Decision Process'], ['paperProcess', 'Paper Process'], ['identifyPain', 'Identify Pain'], ['champion', 'Champion'], ['competition', 'Competition']];
  const painDiffers = Boolean((op as Opportunity & { painDiffers?: boolean }).painDiffers);
  const pain = op.threeWhys.whyAnything;
  return <Section title="MEDDPICC" eyebrow="QUALIFICATION FRAMEWORK"><div className="linked-box"><span>LINKED PAIN FROM 3 WHYS</span><strong>{pain.situation} → {pain.problem} → {pain.implication}</strong></div>{painDiffers && <div className="warning-banner">⚠ MEDDPICC pain inconsistent with 3 Whys — reconcile</div>}<label className="check-label"><input type="checkbox" checked={painDiffers} onChange={(e) => setOverride(op.id, 'painDiffers', e.target.checked)} /> Pain differs from 3 Whys</label><div className="meddpicc-grid">{fields.map(([key, label]) => <label key={key}>{label}<textarea value={op.meddpicc[key]} onChange={(e) => setOverride(op.id, `meddpicc.${key}`, e.target.value)} /></label>)}</div></Section>;
}

function MeetingPrep({ op, account, people, dataset }: { op: Opportunity; account: Account; people: Stakeholder[]; dataset: typeof sourceDataset }) {
  const missing = (Object.entries(op.meddpicc) as [string, string][]).filter(([, value]) => !value || /TBD|UNKNOWN/i.test(value)).map(([key]) => key);
  const unknown = validationKeys().filter((key) => op.threeWhys.validation[key].status === 'Hypothesis');
  return <div className="print-brief"><PageHeader eyebrow="MEETING PREP / READ ONLY" title="What do I need to learn to validate the 3 Whys?" action={<button className="button secondary" onClick={() => window.print()}>Print brief</button>} /><Section title="Validation agenda" eyebrow="HEADLINE"><div className="headline-list">{unknown.length ? unknown.map((x) => <Badge tone="traffic-red" key={x}>{x}</Badge>) : <Badge tone="traffic-green">All rows validated</Badge>}</div></Section><Section title="Account context" eyebrow="CONTEXT"><p>{account.overview}</p><h3>Strategic priorities</h3><ul>{account.strategicPriorities.map((x) => <li key={x}>{x}</li>)}</ul></Section><Section title="Stakeholder context" eyebrow="WHO IS IN THE ROOM"><div className="people-grid">{people.map((person) => <div className="person-card" key={person.id}><strong>{person.name}</strong><span>{person.title} · {person.functionArea}</span><Badge>{person.buyingRole}</Badge></div>)}</div></Section><Section title="Strategic initiative" eyebrow="LINKED MOTION"><p>{account.initiatives.find((x) => x.id === op.initiativeId)?.businessObjective || 'No strategic initiative linked.'}</p></Section><Section title="Existing opportunities in account" eyebrow="PORTFOLIO"><ul>{dataset.opportunities.filter((x) => x.accountId === account.id).map((x) => <li key={x.id}>{x.name} — {x.stage}</li>)}</ul></Section><Section title="3 Whys summary" eyebrow="VALUE HYPOTHESIS"><div className="three-col"><Flow title="Why Anything" text={op.threeWhys.whyAnything.problem} /><Flow title="Why Now" text={op.threeWhys.whyNow.urgency} /><Flow title="Why Cognition" text={op.threeWhys.whyCognition.businessOutcome} /></div></Section><Section title="MEDDPICC gaps" eyebrow="QUALIFICATION"><div className="headline-list">{missing.length ? missing.map((x) => <Badge tone="warning" key={x}>{x}</Badge>) : 'No gaps.'}</div></Section><Section title="Likely objections" eyebrow="REGULATED ENTERPRISE AI"><ul>{['Security and data residency risk', 'Regulatory compliance and auditability', 'Integration effort with existing systems', 'Change management and adoption', 'Build versus buy economics'].map((x) => <li key={x}>{x}</li>)}</ul><p><b>Desired outcome:</b> validate the rows currently Hypothesis.</p><p><b>Recommended next step:</b> {op.nextAction}</p></Section></div>;
}

function PostMeeting({ op, meetingNotes, saveMeetingNote, setOverride }: { op: Opportunity; meetingNotes: MeetingNote[]; saveMeetingNote: (note: MeetingNote) => void; setOverride: (id: string, path: string, value: unknown) => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), rawNotes: '', whatWeLearned: '', whatChanged: '', whatWasValidated: '', whatWasDisproved: '', whatRemainsUnknown: '', nextAction: '' });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const notes = meetingNotes.filter((note) => note.opportunityId === op.id);
  return <Section title="Post-meeting update" eyebrow="CAPTURE LEARNING"><form onSubmit={(e) => { e.preventDefault(); saveMeetingNote({ ...form, id: `note-${Date.now()}`, accountId: op.accountId, opportunityId: op.id }); if (form.nextAction) setOverride(op.id, 'nextAction', form.nextAction); setForm((current) => ({ ...current, rawNotes: '', whatWeLearned: '', whatChanged: '', whatWasValidated: '', whatWasDisproved: '', whatRemainsUnknown: '', nextAction: '' })); }}><div className="edit-grid"><label>Date<input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} /></label><label>Raw notes<textarea value={form.rawNotes} onChange={(e) => update('rawNotes', e.target.value)} /></label></div><div className="meddpicc-grid notes-grid">{[['whatWeLearned', 'WHAT WE LEARNED'], ['whatChanged', 'WHAT CHANGED'], ['whatWasValidated', 'WHAT WAS VALIDATED'], ['whatWasDisproved', 'WHAT WAS DISPROVED'], ['whatRemainsUnknown', 'WHAT REMAINS UNKNOWN'], ['nextAction', 'NEXT ACTION']].map(([key, label]) => <label key={key}>{label}<textarea value={form[key as keyof typeof form]} onChange={(e) => update(key as keyof typeof form, e.target.value)} /></label>)}</div><button className="button primary" type="submit">Save meeting note</button></form><div className="notes-history">{notes.map((note) => <article className="note-card" key={note.id}><div className="card-top"><Badge>{note.date}</Badge><span>{note.nextAction}</span></div><p>{note.rawNotes}</p><div className="three-col"><div><span>LEARNED</span><p>{note.whatWeLearned}</p></div><div><span>VALIDATED</span><p>{note.whatWasValidated}</p></div><div><span>UNKNOWN</span><p>{note.whatRemainsUnknown}</p></div></div></article>)}</div></Section>;
}

function SignalsPage({ dataset }: { dataset: typeof sourceDataset }) {
  const [account, setAccount] = useState('all'); const [type, setType] = useState('all'); const types = [...new Set(dataset.signals.map((x) => x.type))]; const signals = dataset.signals.filter((x) => (account === 'all' || x.accountId === account) && (type === 'all' || x.type === type));
  return <><PageHeader eyebrow="SIGNALS / MONITOR" title="Signals" subtitle="External evidence translated into sales action." /><div className="filters"><label>Account<select value={account} onChange={(e) => setAccount(e.target.value)}><option value="all">All accounts</option>{dataset.accounts.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{types.map((x) => <option value={x} key={x}>{x}</option>)}</select></label></div><div className="signal-list">{signals.map((signal) => <article className="signal-card" key={signal.id}><div className="card-top"><Badge tone={`category-${signal.category}`}>{signal.category}</Badge><span>{accountById(signal.accountId)?.name} · {signal.date} · {signal.source}</span></div><h3>{signal.signal}</h3><div className="three-col"><div><span>BUSINESS RELEVANCE</span><p>{signal.businessRelevance}</p></div><div><span>COGNITION RELEVANCE</span><p>{signal.cognitionRelevance}</p></div><div><span>SALES ACTION</span><p>{signal.salesAction}</p></div></div>{signal.url && <a href={signal.url} target="_blank" rel="noreferrer">Source ↗</a>}</article>)}</div></>;
}

function StakeholdersPage({ dataset, setOverride }: { dataset: typeof sourceDataset; setOverride: (id: string, path: string, value: unknown) => void }) {
  const [account, setAccount] = useState('all'); const people = dataset.stakeholders.filter((x) => account === 'all' || x.accountId === account); const isSingle = (accountId: string) => dataset.stakeholders.filter((x) => x.accountId === accountId && ['Engaged', 'Champion'].includes(x.relationshipStatus)).length <= 1;
  return <><PageHeader eyebrow="STAKEHOLDERS / COVERAGE" title="Stakeholders" subtitle="Map the committee before the committee maps the deal." /><div className="filters"><label>Account<select value={account} onChange={(e) => setAccount(e.target.value)}><option value="all">All accounts</option>{dataset.accounts.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label></div>{people.map((person) => <div className={`stakeholder-expanded ${isSingle(person.accountId) ? 'single-threaded' : ''}`} key={person.id}><div className="stakeholder-summary"><div className="account-avatar">{person.name.slice(0, 1)}</div><div><h3>{person.name}</h3><p>{person.title} · {person.functionArea} · {accountById(person.accountId)?.name}</p></div><Badge>{person.relationshipStatus}</Badge><Badge>{person.buyingRole}</Badge>{isSingle(person.accountId) && <Badge tone="warning">Single-threaded account</Badge>}</div><StakeholderTable stakeholders={[person]} setOverride={setOverride} /></div>)}</>;
}

function WeeklyReview({ dataset }: { dataset: typeof sourceDataset }) {
  const today = Date.now(); const days30 = 30 * 86400000; const accounts = dataset.accounts; const green = dataset.opportunities.filter(isFullyQualified); const red = dataset.opportunities.filter((x) => threeWhysStatus(x).tone === 'red'); const single = accounts.filter((a) => dataset.stakeholders.filter((x) => x.accountId === a.id && ['Engaged', 'Champion'].includes(x.relationshipStatus)).length <= 1);
  return <><PageHeader eyebrow="WEEKLY OPERATING RHYTHM" title="Weekly Account Review" subtitle="A concise review of coverage, validation, and where to place the next bet." /><div className="review-list">{accounts.map((account) => { const accountOpps = dataset.opportunities.filter((x) => x.accountId === account.id); const accountPeople = dataset.stakeholders.filter((x) => x.accountId === account.id); const newSignals = dataset.signals.filter((x) => x.accountId === account.id && today - new Date(x.date).getTime() <= days30); const gaps = accountOpps.reduce((sum, op) => sum + Object.values(op.meddpicc).filter((x) => !x || /TBD|UNKNOWN/i.test(x)).length, 0); return <article className="review-card" key={account.id}><div className="review-heading"><div className="account-avatar">{account.name.slice(0, 1)}</div><div><h2>{account.name}</h2><p>{account.overview}</p></div><Link to={`/accounts/${account.id}`}>Open account →</Link></div><div className="review-metrics"><div><span>Initiatives</span><strong>{account.initiatives.length}</strong></div><div><span>New signals</span><strong>{newSignals.length}</strong></div><div><span>Engaged stakeholders</span><strong>{accountPeople.filter((x) => ['Engaged', 'Champion'].includes(x.relationshipStatus)).length}</strong></div><div><span>Opportunities</span><strong>{accountOpps.length}</strong></div><div><span>MEDDPICC gaps</span><strong>{gaps}</strong></div></div><div className="review-bottom"><div><span>3 WHYS VALIDATION</span>{accountOpps.map((x) => <div key={x.id}><Link to={`/opportunities/${x.id}`}>{x.name}</Link> <Traffic op={x} /></div>)}</div><div><span>RISKS</span><p>{accountPeople.filter((x) => x.buyingRole === 'Economic Buyer').length ? 'Economic buyer identified' : 'No economic buyer'} · {accountOpps.some((x) => !isFullyQualified(x)) ? 'Stage / validation review' : 'No stage inconsistency'}</p></div><div><span>WHITESPACE</span><p>{account.whitespace.map((x) => x.area).join(', ')}</p></div><div><span>NEXT ACTIONS</span>{accountOpps.map((x) => <p key={x.id}>{x.nextAction}</p>)}</div></div></article>; })}</div><Section title="Executive summary" eyebrow="LEADERSHIP VIEW"><div className="summary-grid"><div><h3>Where did new pipeline emerge?</h3><p>{dataset.opportunities.filter((x) => x.stage === 'Identified').map((x) => x.name).join(', ') || 'No opportunities in Identified.'}</p></div><div><h3>Validated pain</h3><p>{green.map((x) => x.name).join(', ') || 'None yet.'}</p></div><div><h3>Still hypotheses</h3><p>{red.map((x) => x.name).join(', ') || 'None.'}</p></div><div><h3>Single-threaded</h3><p>{single.map((x) => x.name).join(', ') || 'None.'}</p></div><div><h3>Executive engagement</h3><p>{dataset.stakeholders.filter((x) => ['CEO', 'CIO', 'CTO', 'CDO'].includes(x.functionArea) && ['Engaged', 'Champion'].includes(x.relationshipStatus)).map((x) => x.name).join(', ') || 'None yet.'}</p></div><div><h3>Stronger Why Now</h3><p>{dataset.opportunities.filter((x) => x.threeWhys.validation.whyNow.status === 'Hypothesis').map((x) => x.name).join(', ') || 'No gaps.'}</p></div><div><h3>Weak Why Cognition</h3><p>{dataset.opportunities.filter((x) => x.threeWhys.validation.whyCognition.status === 'Hypothesis').map((x) => x.name).join(', ') || 'No gaps.'}</p></div><div><h3>What to do next week</h3><p>{dataset.cockpitActions.slice(0, 3).map((x) => x.recommendedAction).join(' · ')}</p></div></div></Section></>;
}

function NotFound() { return <div className="empty-state"><h1>Not found</h1><Link to="/">Return to cockpit</Link></div>; }

export default function App() {
  const { overrides, setOverride, meetingNotes, saveMeetingNote, reset } = useOverrides();
  const dataset = useMemo(() => mergeDataset(sourceDataset, overrides), [overrides]);
  const exportData = () => { const blob = new Blob([JSON.stringify({ ...dataset, meetingNotes }, null, 2)], { type: 'application/json' }); const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = `cognition-pipeline-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(href); };
  return <Layout dataset={dataset} reset={reset} exportData={exportData}><Routes><Route path="/" element={<Cockpit dataset={dataset} />} /><Route path="/accounts" element={<AccountsPage dataset={dataset} />} /><Route path="/accounts/:id" element={<AccountDetail dataset={dataset} setOverride={setOverride} />} /><Route path="/opportunities" element={<OpportunitiesPage dataset={dataset} />} /><Route path="/opportunities/:id" element={<OpportunityDetail dataset={dataset} setOverride={setOverride} meetingNotes={meetingNotes} saveMeetingNote={saveMeetingNote} />} /><Route path="/signals" element={<SignalsPage dataset={dataset} />} /><Route path="/stakeholders" element={<StakeholdersPage dataset={dataset} setOverride={setOverride} />} /><Route path="/weekly-review" element={<WeeklyReview dataset={dataset} />} /><Route path="*" element={<NotFound />} /></Routes></Layout>;
}
