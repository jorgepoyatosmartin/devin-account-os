import type { Evidence, Opportunity } from '../types';
import { threeWhysStatus } from '../lib/threeWhys';

export function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Section({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`section ${className}`}>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{children}</section>;
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{action}</header>;
}

export function Editable({ value, onChange, multiline = false, placeholder = 'Add note…' }: { value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
  return multiline ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export function EvidenceList({ evidence }: { evidence?: Evidence[] }) {
  if (!evidence?.length) return <div className="muted">No evidence captured yet.</div>;
  return <div className="evidence-list">{evidence.map((item, index) => <div className="evidence-row" key={`${item.claim}-${index}`}><div><strong>{item.claim}</strong><div className="muted">{item.source}</div></div><Badge tone={`category-${item.category}`}>{item.category}</Badge><span className="confidence">{item.confidence}</span><span>{item.date || '—'}</span>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open ↗</a> : <span className="muted">No URL</span>}</div>)}</div>;
}

export function Traffic({ op }: { op: Opportunity }) {
  const status = threeWhysStatus(op);
  return <Badge tone={`traffic-${status.tone}`}>{status.emoji} {status.label}</Badge>;
}

export function Inconsistent({ op }: { op: Opportunity }) {
  return (['Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] as string[]).includes(op.stage) && threeWhysStatus(op).tone !== 'green' ? <Badge tone="warning">Stage inconsistent with 3 Whys validation</Badge> : null;
}

export function Flow({ title, text }: { title: string; text: string }) {
  return <div className="flow-card"><span>{title}</span><p>{text || 'UNKNOWN'}</p></div>;
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast" role="status">{message}<button onClick={onClose}>×</button></div>;
}

export function OptionalValue({ value }: { value?: string | number | null }) {
  return <>{value || 'UNKNOWN'}</>;
}
