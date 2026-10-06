import {
  ATTITUDES,
  ATTITUDE_LABEL,
  LEVELS,
  ROLES,
  ROLE_LABEL,
  SALES_PLAYS,
  STATUSES,
  daysSince,
  isAncestor,
  type Stakeholder,
} from './model'
import { launchPlaybook } from './playbooks'

interface Props {
  account: string
  person: Stakeholder
  people: Stakeholder[]
  onChange: (patch: Partial<Stakeholder>) => void
  onReparent: (parentId: string | null) => void
  onRemove: () => void
  onFocus: (id: string) => void
  onClose: () => void
  onLaunched: (prompt: string) => void
}

export function SidePanel({ account, person: p, people, onChange, onReparent, onRemove, onFocus, onClose, onLaunched }: Props) {
  const launch = (a: 'cadence' | 'brief' | 'team') => launchPlaybook(a, account, p).then(onLaunched)
  const d = daysSince(p.lastTouch)
  const reports = people.filter((x) => x.reportsTo === p.id)
  const manager = people.find((x) => x.id === p.reportsTo)
  const candidates = people.filter((x) => x.id !== p.id && !isAncestor(p.id, x.id, people))
  const influencedBy = people.filter((x) => x.influences.includes(p.id))

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <input className="name-input" value={p.name} onChange={(e) => onChange({ name: e.target.value })} />
          <input className="title-input" value={p.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <button className="ghost" onClick={onClose}>✕</button>
      </div>

      <div className="grid">
        <Field label="Rol MEDDPICC">
          <select value={p.role} onChange={(e) => onChange({ role: e.target.value as Stakeholder['role'] })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Actitud">
          <select value={p.attitude} onChange={(e) => onChange({ attitude: e.target.value as Stakeholder['attitude'] })}>
            {ATTITUDES.map((a) => <option key={a} value={a}>{ATTITUDE_LABEL[a]}</option>)}
          </select>
        </Field>
        <Field label="Influencia">
          <div className="seg">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={p.influence === n ? 'on' : ''} onClick={() => onChange({ influence: n })}>{['Baja', 'Media', 'Alta'][n - 1]}</button>
            ))}
          </div>
        </Field>
        <Field label="Nivel">
          <select value={p.level} onChange={(e) => onChange({ level: e.target.value as Stakeholder['level'] })}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Estado PG">
          <select value={p.status} onChange={(e) => onChange({ status: e.target.value as Stakeholder['status'] })}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Sales play">
          <select value={p.salesPlay} onChange={(e) => onChange({ salesPlay: e.target.value as Stakeholder['salesPlay'] })}>
            {SALES_PLAYS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Unidad">
          <input value={p.unit} onChange={(e) => onChange({ unit: e.target.value })} />
        </Field>
        <Field label="Owner">
          <input value={p.owner} onChange={(e) => onChange({ owner: e.target.value })} />
        </Field>
        <Field label={`Último touch${d !== null ? ` · hace ${d} d` : ''}`}>
          <div className="inline">
            <input type="date" value={p.lastTouch ?? ''} onChange={(e) => onChange({ lastTouch: e.target.value || null })} />
            <button onClick={() => onChange({ lastTouch: '2026-09-27', status: p.status === 'No contact' ? 'In contact' : p.status })}>Hoy</button>
          </div>
        </Field>
        <Field label="Reporta a">
          <div className="inline">
            <select value={p.reportsTo ?? ''} onChange={(e) => onReparent(e.target.value || null)}>
              <option value="">— (raíz)</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={p.reportsToConfidence}
              onChange={(e) => onChange({ reportsToConfidence: e.target.value as Stakeholder['reportsToConfidence'] })}
              title="¿Línea de reporte confirmada o hipótesis?"
            >
              <option value="confirmed">Confirmado</option>
              <option value="hypothesis">Hipótesis</option>
            </select>
          </div>
        </Field>
      </div>

      <Field label="Notas / plan">
        <textarea rows={4} value={p.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Qué sabemos, qué le duele, plan de acción…" />
      </Field>

      <div className="rel">
        {manager && <div><span className="muted">Jefe:</span> <a onClick={() => onFocus(manager.id)}>{manager.name}</a></div>}
        {reports.length > 0 && (
          <div><span className="muted">Equipo:</span> {reports.map((r, i) => <span key={r.id}>{i ? ', ' : ''}<a onClick={() => onFocus(r.id)}>{r.name}</a></span>)}</div>
        )}
        {p.influences.length > 0 && (
          <div>
            <span className="muted">Influye en:</span>{' '}
            {p.influences.map((id) => {
              const t = people.find((x) => x.id === id)
              return t ? (
                <span key={id} className="tag">
                  <a onClick={() => onFocus(id)}>{t.name}</a>
                  <button title="Quitar" onClick={() => onChange({ influences: p.influences.filter((i) => i !== id) })}>×</button>
                </span>
              ) : null
            })}
          </div>
        )}
        {influencedBy.length > 0 && (
          <div><span className="muted">Le influyen:</span> {influencedBy.map((r, i) => <span key={r.id}>{i ? ', ' : ''}<a onClick={() => onFocus(r.id)}>{r.name}</a></span>)}</div>
        )}
      </div>

      <div className="actions">
        <button className="primary" title="!pg_activation para esta persona" onClick={() => launch('cadence')}>Generar cadencia</button>
        <button title="!meeting_brief para esta persona" onClick={() => launch('brief')}>Brief</button>
        <button title="stakeholder-mapping: buscar el equipo" onClick={() => launch('team')}>Buscar equipo</button>
        <button className="danger" onClick={onRemove}>Eliminar</button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
