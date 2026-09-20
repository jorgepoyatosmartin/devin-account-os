import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Dataset, PgRecord, PgStatus, SalesPlay, Task } from '../types';
import { convertToOpportunity, generateMessage, relevantUseCases, resolvePg, suggestPlay } from '../lib/pg';
import { AiBlock, Badge, PageHeader, Section } from '../components/ui';
import { useI18n } from '../i18n';

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
  const { tv } = useI18n();
  return <Badge tone={toneFor(value)}>{tv(value)}</Badge>;
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
  const { lang, t, tv } = useI18n();
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
  const records = useMemo(() => dataset.pg.map((record) => resolvePg(record, dataset, lang)), [dataset, lang]);
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
    onToast(`${t('toast.messageCopied')} · ${tv('OUTREACH')}`);
  };
  return <>
    <PageHeader eyebrow={t('pg.eyebrow')} title={t('pg.title')} subtitle={t('pg.subtitle')} action={<button className="button primary" onClick={() => setShowComposer((value) => !value)}>{t('pg.newTarget')}</button>} />
    <div className="pipeline-kpis pg-kpis">{[
      [t('pg.total'), records.length], [t('pg.highPriority'), records.filter((r) => r.priority === 'HIGH').length], [t('pg.ready'), records.filter((r) => r.status === 'READY').length],
      [t('pg.outreach'), records.filter((r) => r.status === 'OUTREACH').length], [t('pg.engaged'), records.filter((r) => r.status === 'ENGAGED').length],
      [t('pg.meetings'), records.filter((r) => r.status === 'MEETING').length], [t('pg.converted'), records.filter((r) => r.status === 'CONVERTED').length],
      [t('pg.pipelineGenerated'), `${records.filter((r) => r.status === 'CONVERTED').length} · € TBD`],
    ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {showComposer && <PgComposer dataset={dataset} initialStakeholderId={params.get('new') || ''} addPg={(record) => { addPg(record); setShowComposer(false); onToast(t('toast.pgCreated')); }} />}
    <Section title={t('pg.todayPriorities')} eyebrow={t('pg.topNextMoves')}>
      <div className="pg-priority-grid">{prioritiesToday.map((record) => <article className="pg-priority-card" key={record.id} onClick={() => navigate(`/pg/${record.id}`)}>
        <div className="card-top"><ResolvedBadge value={record.priority} /><span className="muted">{record.account.name}</span></div>
        <h3>{record.stakeholder.name}</h3><p className="muted">{record.initiative?.name || 'Initiative UNKNOWN'} · {record.salesPlay}</p>
        <div className="pg-copy"><span>{t('pg.whyHighTarget')}</span><p>{record.whyHighTarget.split(' · ')[0]}</p></div>
        <div className="pg-copy"><span>{t('pg.meetingPath')}</span><p>{record.howGetMeeting}</p></div>
        <div className="pg-copy ai-block"><span className="ai-block-label">{t('ai.hypothesis')}</span><span>{t('pg.action')}</span><p>{record.action}</p></div>
        <div className="card-top"><ResolvedBadge value={record.status} /><span className="muted">{record.message ? t('common.messageReady') : t('common.generateMessage')}</span></div>
        <div className="context-actions"><button onClick={(event) => { event.stopPropagation(); navigate(`/pg/${record.id}`); }}>{t('pg.contextGenerate')}</button><button onClick={(event) => { event.stopPropagation(); void send(record); }}>{t('pg.contextSend')}</button></div>
      </article>)}</div>
    </Section>
    <div className="filters pg-filters">
      <label>{t('pg.filters.account')}<select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">{t('common.all')}</option>{dataset.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>{t('pg.filters.level')}<select value={level} onChange={(e) => setLevel(e.target.value)}><option value="">{t('common.all')}</option>{['Board / CEO', 'Executive Committee', 'Senior Leadership', 'Director', 'Manager', 'Individual Contributor', 'Unknown'].map((x) => <option key={x} value={x}>{tv(x)}</option>)}</select></label>
      <label>{t('pg.filters.businessUnit')}<select value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)}><option value="">{t('common.all')}</option>{[...new Set(dataset.stakeholders.map((x) => x.businessUnit || x.functionArea))].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>{t('pg.filters.initiative')}<select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)}><option value="">{t('common.all')}</option>{dataset.accounts.flatMap((a) => a.initiatives).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>{t('pg.filters.salesPlay')}<select value={salesPlay} onChange={(e) => setSalesPlay(e.target.value)}><option value="">{t('common.all')}</option>{plays.map((x) => <option key={x} value={x}>{tv(x)}</option>)}</select></label>
      <label>{t('pg.filters.status')}<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('common.all')}</option>{statusOrder.map((x) => <option key={x} value={x}>{tv(x)}</option>)}</select></label>
      <label>{t('pg.filters.priority')}<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">{t('common.all')}</option>{priorities.map((x) => <option key={x} value={x}>{tv(x)}</option>)}</select></label>
      <label>{t('pg.filters.relationship')}<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option value="">{t('common.all')}</option>{['No contact', 'Identified', 'Contacted', 'Engaged', 'Champion'].map((x) => <option key={x} value={x}>{tv(x)}</option>)}</select></label>
      <label>{t('pg.filters.signal')}<select value={hasSignal} onChange={(e) => setHasSignal(e.target.value)}><option value="">{t('common.all')}</option><option value="yes">{t('common.yes')}</option><option value="no">{t('common.no')}</option></select></label>
      <label>{t('pg.filters.owner')}<select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">{t('common.all')}</option>{[...new Set(records.map((x) => x.owner))].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label>{t('pg.filters.person')}<input value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder={t('pg.filterSearchPerson')} /></label>
    </div>
    <Section title={`${t('pg.targetRegister')} · ${filtered.length}`} eyebrow={t('pg.accountExecution')}>
      <div className="table-wrap pg-table-wrap"><table><thead><tr>{['account', 'person', 'title', 'level', 'businessUnit', 'salesPlay', 'action', 'whyHighTarget', 'whyMeet', 'howMeeting', 'status', 'priority'].map((header) => <th key={header}>{t(`pg.table.${header}` as never)}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id} onClick={() => navigate(`/pg/${record.id}`)}><td>{record.account.name}</td><td><strong>{record.stakeholder.name}</strong>{record.origin === 'ORIGINAL EXCEL DATA' && <Badge tone="pg-source">{t('pg.originalExcelBadge')}</Badge>}</td><td title={record.stakeholder.title}>{truncate(record.stakeholder.title)}</td><td>{tv(record.stakeholder.level || 'Unknown')}</td><td>{record.stakeholder.businessUnit || record.stakeholder.functionArea || tv('UNKNOWN')}</td><td>{tv(record.salesPlay)}</td><td title={record.action}>{truncate(record.action)}</td><td title={record.whyHighTarget}>{truncate(record.whyHighTarget)}</td><td title={record.whyMeet}>{truncate(record.whyMeet)}</td><td title={record.howGetMeeting}>{truncate(record.howGetMeeting)}</td><td><ResolvedBadge value={record.status} /></td><td><ResolvedBadge value={record.priority} /></td></tr>)}</tbody></table></div>
    </Section>
  </>;
}

function PgComposer({ dataset, initialStakeholderId, addPg }: { dataset: Dataset; initialStakeholderId: string; addPg: (record: PgRecord) => void }) {
  const { t, tv } = useI18n();
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
  return <Section title={t('pg.composer')} eyebrow={t('pg.composerEyebrow')}><form className="pg-composer" onSubmit={create}>
    <label>{t('pg.composerAccount')}<select value={accountId} onChange={(e) => { setAccountId(e.target.value); setStakeholderId(''); }}>{dataset.accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>{t('pg.composerStakeholder')}<select value={stakeholderId} onChange={(e) => setStakeholderId(e.target.value)}><option value="">{t('common.select')}</option>{options.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.title}</option>)}</select></label>
    <label>{t('composer.initiative')}<select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)}><option value="">{t('common.select')}</option>{account?.initiatives.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>{t('pg.businessPain')}<textarea value={pain || (stakeholderId ? inferredPain : '')} onChange={(e) => setPain(e.target.value)} placeholder={tv('UNKNOWN')} /></label>
    <div><span className="mini-label">{t('pg.filters.salesPlay').toUpperCase()}</span><strong>{tv(suggestPlay(account || dataset.accounts[0], initiative, useCases))}</strong></div>
    <fieldset><legend>{t('pg.useCases')}</legend>{useCases.map((x) => <label key={x.id}><input type="checkbox" checked={selectedUseCases.includes(x.id)} onChange={() => setSelectedUseCases((current) => current.includes(x.id) ? current.filter((id) => id !== x.id) : [...current, x.id])} />{x.name}</label>)}</fieldset>
    <fieldset><legend>{t('pg.signals')}</legend>{dataset.signals.filter((x) => x.accountId === accountId).map((x) => <label key={x.id}><input type="checkbox" checked={selectedSignals.includes(x.id)} onChange={() => setSelectedSignals((current) => current.includes(x.id) ? current.filter((id) => id !== x.id) : [...current, x.id])} />{x.signal}</label>)}</fieldset>
    <button className="button primary" type="submit" disabled={!stakeholderId}>{t('pg.create')}</button>
  </form></Section>;
}

function PgDetail({ dataset, id, upsertPg, addOpportunity, addTask, onToast }: Props & { id: string }) {
  const { lang, t, tv } = useI18n();
  const navigate = useNavigate();
  const raw = dataset.pg.find((x) => x.id === id);
  const [language, setLanguage] = useState<'es' | 'en'>(raw?.messageLang || lang);
  if (!raw) return <div className="empty-state"><h1>{t('notFound.title')}</h1><Link to="/pg">{t('common.back')} {t('pg.title')}</Link></div>;
  const view = resolvePg(raw, dataset, lang);
  const via = view.accessViaStakeholderId ? dataset.stakeholders.find((x) => x.id === view.accessViaStakeholderId) : undefined;
  const linkedOps = dataset.opportunities.filter((x) => x.stakeholderIds.includes(view.stakeholderId));
  const set = (patch: Partial<PgRecord>) => upsertPg(raw.id, { ...patch, updatedAt: new Date().toISOString() });
  const generate = () => set({ message: generateMessage(view, { initiative: view.initiative, signal: view.signals[0], useCase: view.useCases[0], via }, language), messageLang: language });
  const markSent = () => { set({ messageSentAt: new Date().toISOString(), status: ['TARGET', 'READY'].includes(raw.status) ? 'OUTREACH' : raw.status }); onToast(t('toast.messageSent')); };
  const convert = () => { const opportunity = convertToOpportunity(view, dataset, lang); addOpportunity(opportunity); set({ status: 'CONVERTED', opportunityId: opportunity.id }); onToast(t('toast.opportunityCreated')); navigate(`/opportunities/${opportunity.id}?tab=3%20WHYS`); };
  const selectedInitiative = view.account.initiatives.find((x) => x.id === raw.initiativeId);
  return <>
    <PageHeader eyebrow={`${t('pg.target')} / ${view.account.name}`} title={view.stakeholder.name} subtitle={`${view.stakeholder.title} · ${tv(view.salesPlay)}`} action={<Link className="button secondary" to="/pg">← {t('pg.title')}</Link>} />
    <div className="pg-detail-grid">
      <Section title={t('pg.detail.account')} eyebrow={t('pg.detail.account')}><p className="lead">{view.account.overview}</p><Link to={`/accounts/${view.account.id}`}>{t('accounts.open')}</Link></Section>
      <Section title={t('pg.businessPain')} eyebrow={t('pg.detail.auto')}><textarea value={raw.businessPain} placeholder={tv('UNKNOWN')} onChange={(e) => set({ businessPain: e.target.value })} /></Section>
      <Section className="initiative-detail-section" title={t('pg.detail.strategy')} eyebrow={t('accounts.strategicInitiatives')}><select value={raw.initiativeId || ''} onChange={(e) => set({ initiativeId: e.target.value || undefined })}><option value="">{t('common.noInitiative')}</option>{view.account.initiatives.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{selectedInitiative && <div className="detail-grid compact-detail"><div className="detail-item"><span>{t('initiative.objective').toUpperCase()}</span><strong>{selectedInitiative.businessObjective}</strong></div><div className="detail-item"><span>{t('initiative.currentSituation').toUpperCase()}</span><strong>{selectedInitiative.currentSituation || tv('UNKNOWN — VALIDATION REQUIRED')}</strong></div><div className="detail-item"><span>{t('pg.businessPain').toUpperCase()}</span><strong>{selectedInitiative.potentialProblem || tv('UNKNOWN — VALIDATION REQUIRED')}</strong></div></div>}</Section>
    </div>
    <Section title={t('pg.detail.stakeholder')} eyebrow={t('common.buyingCommittee')}><div className="detail-grid"><div className="detail-item"><span>{t('pg.detail.nameTitle').toUpperCase()}</span><strong>{view.stakeholder.name}<br />{view.stakeholder.title}</strong></div><div className="detail-item"><span>{t('pg.detail.businessUnitLevel').toUpperCase()}</span><strong>{view.stakeholder.businessUnit || view.stakeholder.functionArea}<br />{tv(view.stakeholder.level || 'Unknown')}</strong></div><div className="detail-item"><span>{t('pg.detail.profile').toUpperCase()}</span><Link to={`/stakeholders/${view.stakeholder.id}`}>{t('common.open')} {t('pg.detail.profile').toLowerCase()} →</Link></div><div className="detail-item"><span>{t('pg.detail.relationship').toUpperCase()}</span><strong>{tv(view.stakeholder.relationshipStatus)}</strong></div><div className="detail-item"><span>{t('pg.detail.powerRole').toUpperCase()}</span><strong>{tv(view.stakeholder.powerRole || view.stakeholder.buyingRole || 'Unknown')}{view.stakeholder.roleIsHypothesis ? ' · HYP' : ''}</strong></div><div className="detail-item"><span>{t('pg.detail.championPotential').toUpperCase()}</span><strong>{tv(view.stakeholder.championPotential || 'Unknown')}</strong></div></div><div className="link-list">{view.useCases.map((x) => <Link key={x.id} to={`/use-cases?focus=${x.id}`}>{x.name}</Link>)}{linkedOps.map((x) => <Link key={x.id} to={`/opportunities/${x.id}`}>{x.name}</Link>)}</div></Section>
    <Section title={t('pg.detail.powerChart')} eyebrow={t('pg.accessRoute')}><div className="detail-grid"><div className="detail-item"><span>{t('pg.route')}</span><strong>{tv(view.accessRoute)}</strong></div><div className="detail-item"><span>{t('pg.explanation')}</span><strong>{view.accessExplanation}</strong></div><div className="detail-item"><span>{t('pg.accessVia')}</span>{via ? <Link to={`/stakeholders/${via.id}`}>{via.name}</Link> : <strong>{t('pg.accessNoOne')}</strong>}</div></div></Section>
    <Section title={t('pg.detail.salesPlay')} eyebrow={t('pg.detail.salesPlay')}><select value={raw.salesPlay} onChange={(e) => set({ salesPlay: e.target.value as SalesPlay })}>{plays.map((x) => <option key={x}>{tv(x)}</option>)}</select><div className="checkbox-grid">{relevantUseCases(view.account, raw.salesPlay, raw.initiativeId).map((x) => <label key={x.id}><input type="checkbox" checked={raw.useCaseIds.includes(x.id)} onChange={() => set({ useCaseIds: raw.useCaseIds.includes(x.id) ? raw.useCaseIds.filter((id) => id !== x.id) : [...raw.useCaseIds, x.id] })} />{x.name}</label>)}</div></Section>
    <Section title={t('pg.detail.whyHigh')} eyebrow={t('pg.qualification')}>{raw.whyHighTarget ? <div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.whyHighTarget}</div> : <AiBlock kind="hypothesis"><div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.whyHighTarget}</div></AiBlock>}<textarea value={raw.whyHighTarget} placeholder={t('pg.autoInference')} onChange={(e) => set({ whyHighTarget: e.target.value })} /><button className="button secondary" onClick={() => set({ whyHighTarget: '' })}>{t('pg.detail.resetAuto')}</button></Section>
    <Section title={t('pg.detail.whyMeet')} eyebrow={t('pg.qualification')}>{raw.whyMeet ? <div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.whyMeet}</div> : <AiBlock kind="hypothesis"><div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.whyMeet}</div></AiBlock>}<textarea value={raw.whyMeet} placeholder={t('pg.autoInference')} onChange={(e) => set({ whyMeet: e.target.value })} /><button className="button secondary" onClick={() => set({ whyMeet: '' })}>{t('pg.detail.resetAuto')}</button></Section>
    <Section title={t('pg.detail.howMeeting')} eyebrow={t('pg.access')}>{raw.howGetMeeting ? <div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.howGetMeeting}</div> : <AiBlock kind="hypothesis"><div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.howGetMeeting}</div></AiBlock>}<select value={view.accessRoute} onChange={(e) => set({ accessRoute: e.target.value as PgRecord['accessRoute'] })}>{['Direct outreach', 'Internal introduction', 'Champion introduction', 'Executive introduction', 'Partner introduction', 'Event', 'Existing opportunity', 'Existing customer relationship'].map((x) => <option key={x}>{tv(x)}</option>)}</select></Section>
    <Section title={t('pg.detail.message')} eyebrow={t('pg.outreach')}><div className={raw.message ? '' : 'ai-block'}>{!raw.message && <span className="ai-block-label">{t('ai.generated')}</span>}<div className="language-toggle"><button className={language === 'es' ? 'selected' : ''} onClick={() => setLanguage('es')}>ES</button><button className={language === 'en' ? 'selected' : ''} onClick={() => setLanguage('en')}>EN</button><button className="button secondary" onClick={generate}>{t('pg.detail.generate')}</button><button className="button secondary" onClick={async () => { try { await navigator.clipboard?.writeText(view.message); onToast(t('toast.messageCopied')); } catch { onToast(t('pg.messageReady')); } }}>{t('pg.detail.copy')}</button><button className="button primary" onClick={markSent}>{t('pg.detail.markSent')}</button></div><textarea value={raw.message} placeholder={t('pg.detail.generatePlaceholder')} onChange={(e) => set({ message: e.target.value, messageLang: language })} /></div></Section>
    <Section title={t('pg.detail.action')} eyebrow={t('pg.nextMove')}>{raw.action ? <div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.action}</div> : <AiBlock kind="hypothesis"><div className="auto-line"><Badge>{t('pg.detail.auto')}</Badge>{view.action}</div></AiBlock>}<input value={raw.action} placeholder={t('pg.autoInference')} onChange={(e) => set({ action: e.target.value })} /><button className="button secondary" onClick={() => { addTask({ id: `task-${Date.now()}`, title: view.action, accountId: view.accountId, stakeholderId: view.stakeholderId, status: 'Open', createdAt: new Date().toISOString(), source: 'pg' }); onToast(t('toast.actionAdded')); }}>{t('pg.detail.addTask')}</button></Section>
    <Section title={t('pg.detail.signalsEngagement')} eyebrow={t('pg.operatingState')}><div className="checkbox-grid">{dataset.signals.filter((x) => x.accountId === view.accountId).map((signal) => <label key={signal.id}><input type="checkbox" checked={raw.signalIds.includes(signal.id)} onChange={() => set({ signalIds: raw.signalIds.includes(signal.id) ? raw.signalIds.filter((sid) => sid !== signal.id) : [...raw.signalIds, signal.id] })} />{signal.signal}<small>{signal.cognitionRelevance} → {signal.salesAction}</small></label>)}</div><div className="detail-grid compact-detail"><label>{t('common.status')}<select value={raw.status} onChange={(e) => set({ status: e.target.value as PgStatus })}>{statusOrder.map((x) => <option key={x}>{tv(x)}</option>)}</select></label><label>{t('common.owner')}<input value={raw.owner} onChange={(e) => set({ owner: e.target.value })} /></label><label>{t('common.comments')}<textarea value={raw.comments} onChange={(e) => set({ comments: e.target.value })} /></label></div></Section>
    <Section title={t('pg.detail.conversion')} eyebrow={t('pg.pipeline')}><div className="conversion-row"><label>{t('pg.detail.priority')} {raw.priorityIsAuto && <Badge>{t('pg.detail.auto')}</Badge>}<select value={raw.priority} onChange={(e) => set({ priority: e.target.value as PgRecord['priority'], priorityIsAuto: false })}>{priorities.map((x) => <option key={x}>{tv(x)}</option>)}</select></label>{raw.opportunityId ? <Link className="button secondary" to={`/opportunities/${raw.opportunityId}?tab=3%20WHYS`}>{t('common.open')} {t('common.opportunity')} →</Link> : <button className="button primary" onClick={convert}>{t('pg.detail.convert')}</button>}</div></Section>
    {view.stakeholder.excel && <Section title={t('pg.originalExcel')} eyebrow={t('pg.sourceRegister')}><div className="table-wrap"><table><thead><tr>{(['common.excelPerson', 'common.excelTitle', 'common.excelLevel', 'common.excelBusinessUnit', 'common.excelSalesPlay', 'common.excelAction', 'common.excelWhyHighTarget'] as const).map((key) => <th key={key}>{t(key)}</th>)}</tr></thead><tbody><tr>{Object.values(view.stakeholder.excel).map((x, index) => <td key={index}>{x || tv('UNKNOWN')}</td>)}</tr></tbody></table></div></Section>}
  </>;
}
