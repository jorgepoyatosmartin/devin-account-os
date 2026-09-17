import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Dataset, PgRecord, PgStatus, SalesPlay, Task } from '../types';
import { convertToOpportunity, generateMessage, relevantUseCases, resolvePg, suggestPlay } from '../lib/pg';
import { Badge, PageHeader, Section } from '../components/ui';

const statusOrder: PgStatus[] = ['TARGET', 'READY', 'OUTREACH', 'ENGAGED', 'MEETING', 'QUALIFIED', 'CONVERTED', 'NURTURE', 'DISQUALIFIED'];
const plays: SalesPlay[] = ['Developer Productivity', 'AI Engineering', 'Legacy Modernization', 'Cloud Migration', 'Quality & Regulatory Delivery', 'Data & AI Product Engineering', 'UNKNOWN'];
const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
const truncate = (text: string, length = 90) => text.length > length ? `${text.slice(0, length - 1)}…` : text;
const toneFor = (value: string) => value === 'CONVERTED' || value === 'ENGAGED' ? 'pg-green' : value === 'DISQUALIFIED' ? 'pg-red' : value === 'UNKNOWN' ? 'pg-grey' : 'pg-yellow';

type Props = {
  dataset: Dataset;
  upsertPg: (id: string, patch: Partial<PgRecord>) => void;
  addPg: (record: PgRecord) => void;
  addOpportunity: (opportunity: import('../types').Opportunity) => void;
  addTask: (task: Task) => void;
  onToast: (message: string) => void;
};

function ResolvedBadge({ value }: { value: string }) {
  return <Badge tone={toneFor(value)}>{value}</Badge>;
}

function prioritySort(a: ReturnType<typeof resolvePg>, b: ReturnType<typeof resolvePg>) {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const statusRank: Record<string, number> = { TARGET: 0, READY: 1, OUTREACH: 2 };
  return rank[a.priority] - rank[b.priority] || (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
}

export default function PgPage(props: Props) {
  const { id } = useParams();
  return id ? <PgDetail {...props} id={id} /> : <PgDashboard {...props} />;
}

function PgDashboard({ dataset, upsertPg, addPg, addOpportunity, onToast }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [accountId, setAccountId] = useState('');
  const [level, setLevel] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [initiativeId, setInitiativeId] = useState('');
  const [salesPlay, setSalesPlay] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [relationship, setRelationship] = useState('');
  const [hasSignal, setHasSignal] = useState('');
  const [owner, setOwner] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showComposer, setShowComposer] = useState(Boolean(params.get('new')));
  const records = useMemo(() => dataset.pg.map((record) => resolvePg(record, dataset)), [dataset]);
  const filtered = records.filter((record) => {
    const personText = `${record.stakeholder.name} ${record.stakeholder.title}`.toLowerCase();
    return (!accountId || record.accountId === accountId) && (!level || (record.stakeholder.level || '') === level) &&
      (!businessUnit || (record.stakeholder.businessUnit || record.stakeholder.functionArea) === businessUnit) &&
      (!initiativeId || record.initiativeId === initiativeId) && (!salesPlay || record.salesPlay === salesPlay) &&
      (!status || record.status === status) && (!priority || record.priority === priority) &&
      (!relationship || record.stakeholder.relationshipStatus === relationship) &&
      (!hasSignal || (hasSignal === 'yes' ? record.signalIds.length > 0 : record.signalIds.length === 0)) &&
      (!owner || record.owner === owner) && (!personSearch || personText.includes(personSearch.toLowerCase()));
  });
  const prioritiesToday = records.filter((record) => !['CONVERTED', 'DISQUALIFIED', 'NURTURE'].includes(record.status)).sort(prioritySort).slice(0, 5);
  const send = async (record: ReturnType<typeof resolvePg>) => {
    try { await navigator.clipboard?.writeText(record.message); } catch { /* clipboard may be unavailable in local browser */ }
    upsertPg(record.id, { message: record.message, messageSentAt: new Date().toISOString(), status: 'OUTREACH' });
    onToast('Message copied and marked OUTREACH');
  };
  return <>
    <PageHeader eyebrow="PIPELINE GENERATION / PG" title="PG — Pipeline Generation" subtitle="Turn account intelligence into evidence-led target conversations without creating new contacts." action={<button className="button primary" onClick={() => setShowComposer((value) => !value)}>+ New PG target</button>} />
    <div className="pipeline-kpis pg-kpis">{[
      ['Total', records.length], ['High priority', records.filter((r) => r.priority === 'HIGH').length], ['Ready', records.filter((r) => r.status === 'READY').length],
      ['Outreach', records.filter((r) => r.status === 'OUTREACH').length], ['Engaged', records.filter((r) => r.status === 'ENGAGED').length],
      ['Meetings', records.filter((r) => r.status === 'MEETING').length], ['Converted', records.filter((r) => r.status === 'CONVERTED').length],
      ['Pipeline generated', `${records.filter((r) => r.status === 'CONVERTED').length} · € TBD`],
    ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {showComposer && <PgComposer dataset={dataset} initialStakeholderId={params.get('new') || ''} addPg={(record) => { addPg(record); setShowComposer(false); onToast('PG target created'); }} />}
    <Section title="Today's PG priorities" eyebrow="TOP 5 NEXT MOVES">
      <div className="pg-priority-grid">{prioritiesToday.map((record) => <article className="pg-priority-card" key={record.id} onClick={() => navigate(`/pg/${record.id}`)}>
        <div className="card-top"><ResolvedBadge value={record.priority} /><span className="muted">{record.account.name}</span></div>
        <h3>{record.stakeholder.name}</h3><p className="muted">{record.initiative?.name || 'Initiative UNKNOWN'} · {record.salesPlay}</p>
        <div className="pg-copy"><span>WHY HIGH TARGET</span><p>{record.whyHighTarget.split(' · ')[0]}</p></div>
        <div className="pg-copy"><span>MEETING PATH</span><p>{record.howGetMeeting}</p></div>
        <div className="pg-copy"><span>ACTION</span><p>{record.action}</p></div>
        <div className="card-top"><ResolvedBadge value={record.status} /><span className="muted">{record.message ? 'Message ready' : 'Generate message'}</span></div>
        <div className="context-actions"><button onClick={(event) => { event.stopPropagation(); navigate(`/pg/${record.id}`); }}>Generate Message</button><button onClick={(event) => { event.stopPropagation(); void send(record); }}>Send Message</button></div>
      </article>)}</div>
    </Section>
    <div className="filters pg-filters">
      <label>Account<select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">All</option>{dataset.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Level<select value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All</option>{['Board / CEO', 'Executive Committee', 'Senior Leadership', 'Director', 'Manager', 'Individual Contributor', 'Unknown'].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Business Unit<select value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)}><option value="">All</option>{[...new Set(dataset.stakeholders.map((x) => x.businessUnit || x.functionArea))].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Initiative<select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)}><option value="">All</option>{dataset.accounts.flatMap((a) => a.initiatives).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>Sales Play<select value={salesPlay} onChange={(e) => setSalesPlay(e.target.value)}><option value="">All</option>{plays.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{statusOrder.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All</option>{priorities.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Relationship<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option value="">All</option>{['No contact', 'Identified', 'Contacted', 'Engaged', 'Champion'].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Signal linked<select value={hasSignal} onChange={(e) => setHasSignal(e.target.value)}><option value="">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>Owner<select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">All</option>{[...new Set(records.map((x) => x.owner))].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>Person<input value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Search name or title" /></label>
    </div>
    <Section title={`PG target register · ${filtered.length}`} eyebrow="ACCOUNT-LEVEL EXECUTION">
      <div className="table-wrap pg-table-wrap"><table><thead><tr>{['Account', 'Person', 'Title', 'Level', 'Business Unit', 'Sales Play', 'Action', 'Why High Target?', 'Why would they meet?', 'How we get the meeting?', 'Status', 'Priority'].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id} onClick={() => navigate(`/pg/${record.id}`)}><td>{record.account.name}</td><td><strong>{record.stakeholder.name}</strong>{record.origin === 'ORIGINAL EXCEL DATA' && <Badge tone="pg-source">ORIGINAL EXCEL DATA</Badge>}</td><td title={record.stakeholder.title}>{truncate(record.stakeholder.title)}</td><td>{record.stakeholder.level || 'Unknown'}</td><td>{record.stakeholder.businessUnit || record.stakeholder.functionArea || 'UNKNOWN'}</td><td>{record.salesPlay}</td><td title={record.action}>{truncate(record.action)}</td><td title={record.whyHighTarget}>{truncate(record.whyHighTarget)}</td><td title={record.whyMeet}>{truncate(record.whyMeet)}</td><td title={record.howGetMeeting}>{truncate(record.howGetMeeting)}</td><td><ResolvedBadge value={record.status} /></td><td><ResolvedBadge value={record.priority} /></td></tr>)}</tbody></table></div>
    </Section>
  </>;
}

function PgComposer({ dataset, initialStakeholderId, addPg }: { dataset: Dataset; initialStakeholderId: string; addPg: (record: PgRecord) => void }) {
  const [accountId, setAccountId] = useState(initialStakeholderId ? dataset.stakeholders.find((s) => s.id === initialStakeholderId)?.accountId || '' : 'acciona');
  const existing = dataset.pg.filter((x) => !['DISQUALIFIED'].includes(x.status)).map((x) => x.stakeholderId);
  const options = dataset.stakeholders.filter((x) => x.accountId === accountId && (!existing.includes(x.id) || x.id === initialStakeholderId));
  const [stakeholderId, setStakeholderId] = useState(initialStakeholderId || options[0]?.id || '');
  const account = dataset.accounts.find((x) => x.id === accountId);
  const stakeholder = dataset.stakeholders.find((x) => x.id === stakeholderId);
  const [initiativeId, setInitiativeId] = useState('');
  const initiative = account?.initiatives.find((x) => x.id === initiativeId);
  const [pain, setPain] = useState('');
  const useCases = account ? relevantUseCases(account, suggestPlay(account, initiative), initiativeId) : [];
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const inferredPain = stakeholder?.potentialPain && stakeholder.potentialPain !== 'UNKNOWN' ? stakeholder.potentialPain : initiative?.potentialProblem || 'UNKNOWN';
  const create = (event: React.FormEvent) => {
    event.preventDefault();
    if (!account || !stakeholder) return;
    const now = new Date().toISOString();
    addPg({ id: `pg-${stakeholder.id}-${Date.now()}`, accountId, stakeholderId: stakeholder.id, initiativeId: initiativeId || undefined, useCaseIds: selectedUseCases, signalIds: selectedSignals, salesPlay: suggestPlay(account, initiative, useCases.filter((x) => selectedUseCases.includes(x.id))), businessPain: pain || inferredPain, action: '', whyHighTarget: '', whyMeet: '', howGetMeeting: '', accessRoute: 'Direct outreach', comments: '', message: '', messageLang: 'es', status: 'TARGET', priority: 'LOW', priorityIsAuto: true, owner: 'Jorge Poyatos', origin: 'SALES HYPOTHESIS', createdAt: now, updatedAt: now });
  };
  return <Section title="New PG target" eyebrow="COMPOSER"><form className="pg-composer" onSubmit={create}>
    <label>Account<select value={accountId} onChange={(e) => { setAccountId(e.target.value); setStakeholderId(''); }}>{dataset.accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Existing stakeholder<select value={stakeholderId} onChange={(e) => setStakeholderId(e.target.value)}><option value="">Select…</option>{options.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.title}</option>)}</select></label>
    <label>Initiative<select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)}><option value="">Select…</option>{account?.initiatives.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>Business pain<textarea value={pain || (stakeholderId ? inferredPain : '')} onChange={(e) => setPain(e.target.value)} placeholder="UNKNOWN" /></label>
    <div><span className="mini-label">SALES PLAY</span><strong>{suggestPlay(account || dataset.accounts[0], initiative, useCases)}</strong></div>
    <fieldset><legend>Use cases</legend>{useCases.map((x) => <label key={x.id}><input type="checkbox" checked={selectedUseCases.includes(x.id)} onChange={() => setSelectedUseCases((current) => current.includes(x.id) ? current.filter((id) => id !== x.id) : [...current, x.id])} />{x.name}</label>)}</fieldset>
    <fieldset><legend>Signals</legend>{dataset.signals.filter((x) => x.accountId === accountId).map((x) => <label key={x.id}><input type="checkbox" checked={selectedSignals.includes(x.id)} onChange={() => setSelectedSignals((current) => current.includes(x.id) ? current.filter((id) => id !== x.id) : [...current, x.id])} />{x.signal}</label>)}</fieldset>
    <button className="button primary" type="submit" disabled={!stakeholderId}>Create target</button>
  </form></Section>;
}

function PgDetail({ dataset, id, upsertPg, addOpportunity, addTask, onToast }: Props & { id: string }) {
  const navigate = useNavigate();
  const raw = dataset.pg.find((x) => x.id === id);
  const [language, setLanguage] = useState<'es' | 'en'>(raw?.messageLang || 'es');
  if (!raw) return <div className="empty-state"><h1>PG target not found</h1><Link to="/pg">Back to PG</Link></div>;
  const view = resolvePg(raw, dataset);
  const via = view.accessViaStakeholderId ? dataset.stakeholders.find((x) => x.id === view.accessViaStakeholderId) : undefined;
  const linkedOps = dataset.opportunities.filter((x) => x.stakeholderIds.includes(view.stakeholderId));
  const set = (patch: Partial<PgRecord>) => upsertPg(raw.id, { ...patch, updatedAt: new Date().toISOString() });
  const generate = () => set({ message: generateMessage(view, { initiative: view.initiative, signal: view.signals[0], useCase: view.useCases[0], via }, language), messageLang: language });
  const markSent = () => { set({ messageSentAt: new Date().toISOString(), status: ['TARGET', 'READY'].includes(raw.status) ? 'OUTREACH' : raw.status }); onToast('Message marked sent'); };
  const convert = () => { const opportunity = convertToOpportunity(view, dataset); addOpportunity(opportunity); set({ status: 'CONVERTED', opportunityId: opportunity.id }); onToast('Opportunity created from PG target'); navigate(`/opportunities/${opportunity.id}?tab=3%20WHYS`); };
  const selectedInitiative = view.account.initiatives.find((x) => x.id === raw.initiativeId);
  return <>
    <PageHeader eyebrow={`PG TARGET / ${view.account.name}`} title={view.stakeholder.name} subtitle={`${view.stakeholder.title} · ${view.salesPlay}`} action={<Link className="button secondary" to="/pg">← PG dashboard</Link>} />
    <div className="pg-detail-grid">
      <Section title="Account" eyebrow="ACCOUNT"><p className="lead">{view.account.overview}</p><Link to={`/accounts/${view.account.id}`}>Open account plan →</Link></Section>
      <Section title="Strategic initiative" eyebrow="STRATEGY"><select value={raw.initiativeId || ''} onChange={(e) => set({ initiativeId: e.target.value || undefined })}><option value="">No initiative</option>{view.account.initiatives.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{selectedInitiative && <div className="detail-grid compact-detail"><div className="detail-item"><span>OBJECTIVE</span><strong>{selectedInitiative.businessObjective}</strong></div><div className="detail-item"><span>CURRENT SITUATION</span><strong>{selectedInitiative.currentSituation || 'UNKNOWN'}</strong></div></div>}</Section>
      <Section title="Business pain" eyebrow="HYPOTHESIS"><textarea value={raw.businessPain} placeholder="UNKNOWN" onChange={(e) => set({ businessPain: e.target.value })} /></Section>
    </div>
    <Section title="Stakeholder" eyebrow="BUYING COMMITTEE"><div className="detail-grid"><div className="detail-item"><span>NAME / TITLE</span><strong>{view.stakeholder.name}<br />{view.stakeholder.title}</strong></div><div className="detail-item"><span>BUSINESS UNIT / LEVEL</span><strong>{view.stakeholder.businessUnit || view.stakeholder.functionArea}<br />{view.stakeholder.level || 'Unknown'}</strong></div><div className="detail-item"><span>PROFILE</span><Link to={`/stakeholders/${view.stakeholder.id}`}>Open profile →</Link></div><div className="detail-item"><span>RELATIONSHIP</span><strong>{view.stakeholder.relationshipStatus}</strong></div><div className="detail-item"><span>POWER ROLE</span><strong>{view.stakeholder.powerRole || view.stakeholder.buyingRole || 'Unknown'}{view.stakeholder.roleIsHypothesis ? ' · HYP' : ''}</strong></div><div className="detail-item"><span>CHAMPION POTENTIAL</span><strong>{view.stakeholder.championPotential || 'Unknown'}</strong></div></div><div className="link-list">{view.useCases.map((x) => <Link key={x.id} to={`/use-cases?focus=${x.id}`}>{x.name}</Link>)}{linkedOps.map((x) => <Link key={x.id} to={`/opportunities/${x.id}`}>{x.name}</Link>)}</div></Section>
    <Section title="Power chart access" eyebrow="ACCESS ROUTE"><div className="detail-grid"><div className="detail-item"><span>ROUTE</span><strong>{view.accessRoute}</strong></div><div className="detail-item"><span>EXPLANATION</span><strong>{view.accessExplanation}</strong></div><div className="detail-item"><span>ACCESS VIA</span>{via ? <Link to={`/stakeholders/${via.id}`}>{via.name}</Link> : <strong>No one engaged yet — map a champion</strong>}</div></div></Section>
    <Section title="Sales play & use cases" eyebrow="VALUE HYPOTHESIS"><select value={raw.salesPlay} onChange={(e) => set({ salesPlay: e.target.value as SalesPlay })}>{plays.map((x) => <option key={x}>{x}</option>)}</select><div className="checkbox-grid">{relevantUseCases(view.account, raw.salesPlay, raw.initiativeId).map((x) => <label key={x.id}><input type="checkbox" checked={raw.useCaseIds.includes(x.id)} onChange={() => set({ useCaseIds: raw.useCaseIds.includes(x.id) ? raw.useCaseIds.filter((id) => id !== x.id) : [...raw.useCaseIds, x.id] })} />{x.name}</label>)}</div></Section>
    <Section title="Why high target" eyebrow="QUALIFICATION"><div className="auto-line"><Badge>auto</Badge>{view.whyHighTarget}</div><textarea value={raw.whyHighTarget} placeholder="Leave empty to use auto inference" onChange={(e) => set({ whyHighTarget: e.target.value })} /><button className="button secondary" onClick={() => set({ whyHighTarget: '' })}>Reset to auto</button></Section>
    <Section title="Why would they meet?" eyebrow="QUALIFICATION"><div className="auto-line"><Badge>auto</Badge>{view.whyMeet}</div><textarea value={raw.whyMeet} placeholder="Leave empty to use auto inference" onChange={(e) => set({ whyMeet: e.target.value })} /><button className="button secondary" onClick={() => set({ whyMeet: '' })}>Reset to auto</button></Section>
    <Section title="How we get the meeting" eyebrow="ACCESS"><div className="auto-line"><Badge>auto</Badge>{view.howGetMeeting}</div><select value={view.accessRoute} onChange={(e) => set({ accessRoute: e.target.value as PgRecord['accessRoute'] })}>{['Direct outreach', 'Internal introduction', 'Champion introduction', 'Executive introduction', 'Partner introduction', 'Event', 'Existing opportunity', 'Existing customer relationship'].map((x) => <option key={x}>{x}</option>)}</select></Section>
    <Section title="Message" eyebrow="OUTREACH"><div className="language-toggle"><button className={language === 'es' ? 'selected' : ''} onClick={() => setLanguage('es')}>ES</button><button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')}>EN</button><button className="button secondary" onClick={generate}>Generate</button><button className="button secondary" onClick={async () => { try { await navigator.clipboard?.writeText(view.message); onToast('Message copied'); } catch { onToast('Message ready to copy'); } }}>Copy</button><button className="button primary" onClick={markSent}>Mark Sent</button></div><textarea value={raw.message} placeholder="Generate or write a message" onChange={(e) => set({ message: e.target.value, messageLang: language })} /></Section>
    <Section title="Action" eyebrow="NEXT MOVE"><div className="auto-line"><Badge>auto</Badge>{view.action}</div><input value={raw.action} placeholder="Leave empty to use auto inference" onChange={(e) => set({ action: e.target.value })} /><button className="button secondary" onClick={() => { addTask({ id: `task-${Date.now()}`, title: view.action, accountId: view.accountId, stakeholderId: view.stakeholderId, status: 'Open', createdAt: new Date().toISOString(), source: 'pg' }); onToast('PG action added to Next Actions'); }}>+ Add to Next Actions</button></Section>
    <Section title="Signals & engagement" eyebrow="OPERATING STATE"><div className="checkbox-grid">{dataset.signals.filter((x) => x.accountId === view.accountId).map((signal) => <label key={signal.id}><input type="checkbox" checked={raw.signalIds.includes(signal.id)} onChange={() => set({ signalIds: raw.signalIds.includes(signal.id) ? raw.signalIds.filter((sid) => sid !== signal.id) : [...raw.signalIds, signal.id] })} />{signal.signal}<small>{signal.cognitionRelevance} → {signal.salesAction}</small></label>)}</div><div className="detail-grid compact-detail"><label>Status<select value={raw.status} onChange={(e) => set({ status: e.target.value as PgStatus })}>{statusOrder.map((x) => <option key={x}>{x}</option>)}</select></label><label>Owner<input value={raw.owner} onChange={(e) => set({ owner: e.target.value })} /></label><label>Comments<textarea value={raw.comments} onChange={(e) => set({ comments: e.target.value })} /></label></div></Section>
    <Section title="Conversion" eyebrow="PIPELINE"><div className="conversion-row"><label>Priority {raw.priorityIsAuto && <Badge>auto</Badge>}<select value={raw.priority} onChange={(e) => set({ priority: e.target.value as PgRecord['priority'], priorityIsAuto: false })}>{priorities.map((x) => <option key={x}>{x}</option>)}</select></label>{raw.opportunityId ? <Link className="button secondary" to={`/opportunities/${raw.opportunityId}?tab=3%20WHYS`}>View converted opportunity →</Link> : <button className="button primary" onClick={convert}>Convert to Opportunity</button>}</div></Section>
    {view.stakeholder.excel && <Section title="Original Excel data" eyebrow="SOURCE REGISTER"><div className="table-wrap"><table><thead><tr>{['Person', 'Title', 'Level', 'Business Unit', 'Sales Play', 'Action', 'Why High Target'].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody><tr>{Object.values(view.stakeholder.excel).map((x, index) => <td key={index}>{x || 'UNKNOWN'}</td>)}</tr></tbody></table></div></Section>}
  </>;
}
