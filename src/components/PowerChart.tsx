import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Account, Opportunity, Stakeholder } from '../types';
import { missingPowerRoles, singleThreaded } from '../lib/coverage';
import { Badge } from './ui';

const levels = ['Board / CEO', 'Executive Committee', 'Senior Leadership', 'Director', 'Manager', 'Individual Contributor', 'Unknown'];
const roles = ['Executive Sponsor', 'Economic Buyer', 'Champion', 'Technical Champion', 'Business Champion', 'Influencer', 'Technical Evaluator', 'Security', 'Procurement', 'Legal', 'Coach', 'Blocker', 'Unknown'];
const relationshipTone: Record<string, string> = { 'No contact': 'grey', Identified: 'yellow', Contacted: 'yellow', Engaged: 'green', Champion: 'green' };

type Props = { account: Account; stakeholders: Stakeholder[]; opportunities: Opportunity[]; onSelect: (stakeholderId: string) => void };

export default function PowerChart({ account, stakeholders, opportunities, onSelect }: Props) {
  const [search, setSearch] = useState(''); const [selectedRoles, setSelectedRoles] = useState<string[]>([]); const [relationship, setRelationship] = useState('all'); const [zoom, setZoom] = useState(1); const [collapsed, setCollapsed] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null); const nodeRefs = useRef<Record<string, HTMLElement | null>>({}); const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const filtered = useMemo(() => stakeholders.filter((item) => {
    const query = search.toLowerCase(); const role = item.powerRole || item.buyingRole || 'Unknown';
    return (!query || `${item.name} ${item.title}`.toLowerCase().includes(query)) && (!selectedRoles.length || selectedRoles.includes(role)) && (relationship === 'all' || item.relationshipStatus === relationship);
  }), [search, selectedRoles, relationship, stakeholders]);
  const byId = new Map(stakeholders.map((item) => [item.id, item]));
  const roleMissing = missingPowerRoles(stakeholders);

  useLayoutEffect(() => {
    const update = () => {
      const chart = chartRef.current; if (!chart) return;
      const rect = chart.getBoundingClientRect();
      setLines(filtered.flatMap((item) => {
        if (!item.reportsTo || !nodeRefs.current[item.id] || !nodeRefs.current[item.reportsTo]) return [];
        const from = nodeRefs.current[item.id]!.getBoundingClientRect(); const to = nodeRefs.current[item.reportsTo]!.getBoundingClientRect();
        return [{ x1: from.left + from.width / 2 - rect.left, y1: from.top + from.height / 2 - rect.top, x2: to.left + to.width / 2 - rect.left, y2: to.top + to.height / 2 - rect.top }];
      }));
    };
    update(); const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    if (chartRef.current && observer) observer.observe(chartRef.current);
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, [filtered, zoom, collapsed]);

  return <div className="power-chart-shell">
    <div className="power-toolbar"><input aria-label="Search stakeholders" placeholder="Search name or title…" value={search} onChange={(e) => setSearch(e.target.value)} /><div className="chip-row">{roles.map((role) => <button className={`filter-chip ${selectedRoles.includes(role) ? 'selected' : ''}`} key={role} onClick={() => setSelectedRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role])}>{role}</button>)}</div><select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option value="all">All relationships</option>{['No contact', 'Identified', 'Contacted', 'Engaged', 'Champion'].map((item) => <option key={item}>{item}</option>)}</select><div className="chart-controls"><button onClick={() => setZoom((value) => Math.max(.6, value - .1))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(1.4, value + .1))}>+</button><button onClick={() => setCollapsed((value) => !value)}>{collapsed ? 'Expand' : 'Collapse'}</button></div></div>
    <div className="power-chart-layout"><div className="power-chart" ref={chartRef}><svg className="chart-lines">{lines.map((line, index) => <line key={index} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />)}</svg><div className="chart-scale" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>{levels.map((level) => { const nodes = filtered.filter((item) => (item.level || 'Unknown') === level); if (!nodes.length) return null; return <div className="power-level" key={level}><div className="power-level-label">{level}</div><div className="power-level-nodes">{nodes.map((item) => { const role = item.powerRole || item.buyingRole || 'Unknown'; const linkedOps = opportunities.filter((op) => op.stakeholderIds.includes(item.id)).length; return <button className="power-node" key={item.id} ref={(node) => { nodeRefs.current[item.id] = node; }} onClick={() => onSelect(item.id)}><div className="node-dot"><i className={relationshipTone[item.relationshipStatus] || 'grey'} /></div><div className="node-body"><strong>{item.name}</strong>{!collapsed && <><small>{item.title.length > 74 ? `${item.title.slice(0, 71)}…` : item.title}</small><div><Badge tone="role-badge">{role}{item.roleIsHypothesis ? ' · HYP' : ''}</Badge><Badge tone="origin-badge">{item.dataOrigin || 'UNKNOWN'}</Badge></div><div className="node-meta"><span className="influence-bars">{[1, 2, 3].map((bar) => <i className={(item.influence === 'High' || (item.influence === 'Medium' && bar < 3) || (item.influence === 'Low' && bar === 1)) ? 'filled' : ''} key={bar} />)}</span><span>{linkedOps} opp · {item.useCaseIds?.length || 0} use cases</span></div></>}</div></button>; })}</div></div>; })}</div></div><aside className="power-side"><h3>Coverage</h3><div className="power-side-block"><span>MISSING ROLES</span>{roleMissing.length ? roleMissing.map((role) => <Badge tone="warning" key={role}>{role}</Badge>) : <Badge tone="traffic-green">Covered</Badge>}</div><div className="power-side-block">{singleThreaded(account.id, stakeholders) && <div className="warning-banner">⚠ Single-threaded account</div>}</div><div className="power-side-block"><span>ENGAGE NEXT</span>{stakeholders.filter((item) => item.championPotential === 'High' && !['Engaged', 'Champion'].includes(item.relationshipStatus)).map((item) => <button className="side-link" onClick={() => onSelect(item.id)} key={item.id}>{item.name}<small>{item.title}</small></button>)}</div></aside></div>
  </div>;
}
