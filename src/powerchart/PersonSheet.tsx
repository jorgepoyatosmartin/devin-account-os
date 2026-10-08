import { useState } from 'react'
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
  todayISO,
  type Gap,
  type Stakeholder,
} from './model'
import { launchPlaybook } from './playbooks'

type Tab = 'Resumen' | 'Relaciones' | 'Notas y actividad' | 'Acciones'

interface Props {
  account: string
  person: Stakeholder
  draft: Stakeholder
  people: Stakeholder[]
  gaps: Gap[]
  businessUnits: string[]
  countries: string[]
  dirty: boolean
  onChange: (patch: Partial<Stakeholder>) => void
  onConfidenceExplicit: () => void
  onSave: () => void
  onCancel: () => void
  onClose: () => void
  onMarkDeparted: () => void
  onFocus: (id: string) => void
  onLaunched: (copied: boolean) => void
}

export function PersonSheet({
  account, person, draft: p, people, gaps, businessUnits, countries, dirty, onChange,
  onConfidenceExplicit, onSave, onCancel, onClose, onMarkDeparted, onFocus, onLaunched,
}: Props) {
  const [tab, setTab] = useState<Tab>('Resumen')
  const [addInfluence, setAddInfluence] = useState('')
  const launch = (action: 'cadence' | 'brief' | 'team') => launchPlaybook(action, account, p).then((r) => onLaunched(r.copied))
  const reports = people.filter((x) => x.reportsTo === person.id)
  const manager = people.find((x) => x.id === p.reportsTo)
  const candidates = people.filter((x) => x.id !== person.id && !isAncestor(person.id, x.id, people))
  const influencedBy = people.filter((x) => x.influences.includes(person.id))
  const influenceOptions = people.filter((x) => x.id !== person.id && !p.influences.includes(x.id))
  const tabs: Tab[] = ['Resumen', 'Relaciones', 'Notas y actividad', 'Acciones']

  return (
    <section className="pc-sheet" aria-label={`Ficha de ${person.name}`}>
      <header className="pc-sheet-head">
        <div>
          <h2>{p.name}</h2>
          <div className="pc-sheet-sub">{p.title}</div>
          <div className="pc-sheet-badges">
            <span className="pc-role-badge">{ROLE_LABEL[p.role]}</span>
            {p.departed && <span className="pc-departed-badge">Baja</span>}
          </div>
        </div>
        <button className="ghost" aria-label="Cerrar ficha" onClick={onClose}>✕</button>
      </header>
      <div className="pc-sheet-buttons">
        <button className="primary" disabled={!dirty} onClick={onSave}>Guardar</button>
        <button disabled={!dirty} onClick={onCancel}>Cancelar</button>
      </div>
      <nav className="pc-sheet-tabs">
        {tabs.map((item) => <button key={item} className={tab === item ? 'pc-tab-active' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </nav>
      <div className="pc-sheet-content">
        {tab === 'Resumen' && (
          <div className="pc-sheet-grid">
            <Field label="Nombre"><input value={p.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
            <Field label="Cargo"><input value={p.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
            <Field label="Unidad de negocio"><input list="pc-business-units" value={p.businessUnit} onChange={(e) => onChange({ businessUnit: e.target.value })} /><datalist id="pc-business-units">{businessUnits.map((x) => <option key={x} value={x} />)}</datalist></Field>
            <Field label="Unidad"><input value={p.unit} onChange={(e) => onChange({ unit: e.target.value })} /></Field>
            <Field label="País"><input list="pc-countries" value={p.country ?? ''} onChange={(e) => onChange({ country: e.target.value || null })} /><datalist id="pc-countries">{countries.map((x) => <option key={x} value={x} />)}</datalist></Field>
            <Field label="Nivel"><select value={p.level} onChange={(e) => onChange({ level: e.target.value as Stakeholder['level'] })}>{LEVELS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Rol"><select value={p.role} onChange={(e) => onChange({ role: e.target.value as Stakeholder['role'] })}>{ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</select></Field>
            <Field label="Actitud"><select value={p.attitude} onChange={(e) => onChange({ attitude: e.target.value as Stakeholder['attitude'] })}>{ATTITUDES.map((x) => <option key={x} value={x}>{ATTITUDE_LABEL[x]}</option>)}</select></Field>
            <Field label="Influencia"><select value={p.influence} onChange={(e) => onChange({ influence: Number(e.target.value) as Stakeholder['influence'] })}><option value={1}>Baja</option><option value={2}>Media</option><option value={3}>Alta</option></select></Field>
            <Field label="Estado PG"><select value={p.status} onChange={(e) => onChange({ status: e.target.value as Stakeholder['status'] })}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Sales play"><select value={p.salesPlay} onChange={(e) => onChange({ salesPlay: e.target.value as Stakeholder['salesPlay'] })}>{SALES_PLAYS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Owner"><input value={p.owner} onChange={(e) => onChange({ owner: e.target.value })} /></Field>
            <Field className="pc-field-wide" label="Responsabilidades"><textarea rows={4} value={p.responsibilities} onChange={(e) => onChange({ responsibilities: e.target.value })} /></Field>
            <Field className="pc-field-wide" label="Prioridades"><textarea rows={4} value={p.priorities} onChange={(e) => onChange({ priorities: e.target.value })} /></Field>
          </div>
        )}
        {tab === 'Relaciones' && (
          <div className="pc-sheet-section">
            <Field label="Reporta a">
              <select value={p.reportsTo ?? ''} onChange={(e) => onChange({ reportsTo: e.target.value || null, reportsToConfidence: 'hypothesis' })}>
                <option value="">— raíz —</option>
                {candidates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
            <Field label="Confianza de la relación">
              <select value={p.reportsToConfidence} onChange={(e) => { onConfidenceExplicit(); onChange({ reportsToConfidence: e.target.value as Stakeholder['reportsToConfidence'] }) }}>
                <option value="confirmed">Confirmado</option><option value="hypothesis">Hipótesis</option>
              </select>
            </Field>
            {manager && <RelationshipLine label="Reporta a" people={[manager]} onFocus={onFocus} />}
            <RelationshipLine label="Equipo" people={reports} onFocus={onFocus} />
            <div className="pc-sheet-relblock">
              <b>Influye en</b>
              <div className="pc-rel-list">
                {p.influences.map((id) => {
                  const target = people.find((x) => x.id === id)
                  return target ? <span className="pc-tag" key={id}><a onClick={() => onFocus(id)}>{target.name}</a><button aria-label={`Quitar ${target.name}`} onClick={() => onChange({ influences: p.influences.filter((x) => x !== id) })}>×</button></span> : null
                })}
                {p.influences.length === 0 && <span className="pc-muted">Sin relaciones añadidas</span>}
              </div>
              <div className="pc-inline">
                <select value={addInfluence} onChange={(e) => setAddInfluence(e.target.value)}>
                  <option value="">Añadir persona…</option>{influenceOptions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <button disabled={!addInfluence} onClick={() => { onChange({ influences: [...p.influences, addInfluence] }); setAddInfluence('') }}>Añadir</button>
              </div>
            </div>
            <RelationshipLine label="Le influyen" people={influencedBy} onFocus={onFocus} />
          </div>
        )}
        {tab === 'Notas y actividad' && (
          <div className="pc-sheet-section">
            <Field label={`Último touch${daysSince(p.lastTouch) !== null ? ` · hace ${daysSince(p.lastTouch)} d` : ' · nunca'}`}>
              <div className="pc-inline"><input type="date" value={p.lastTouch ?? ''} onChange={(e) => onChange({ lastTouch: e.target.value || null })} /><button onClick={() => onChange({ lastTouch: todayISO(), status: p.status === 'No contact' ? 'In contact' : p.status })}>Hoy</button></div>
            </Field>
            <Field label="Notas"><textarea rows={12} value={p.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Qué sabemos, qué le duele, plan de acción…" /></Field>
          </div>
        )}
        {tab === 'Acciones' && (
          <div className="pc-sheet-section">
            <div className="pc-actions">
              <button className="primary" onClick={() => launch('cadence')}>Generar cadencia</button>
              <button onClick={() => launch('brief')}>Brief</button>
              <button onClick={() => launch('team')}>Buscar equipo</button>
              <button className="danger" onClick={onMarkDeparted}>Marcar como baja</button>
            </div>
            {gaps.length > 0 && <div className="pc-sheet-gaps"><b>Gaps de esta persona</b>{gaps.map((g, i) => <div key={i}>{g.text}</div>)}</div>}
          </div>
        )}
      </div>
    </section>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`pc-field ${className}`}><span>{label}</span>{children}</label>
}

function RelationshipLine({ label, people, onFocus }: { label: string; people: Stakeholder[]; onFocus: (id: string) => void }) {
  return <div className="pc-sheet-relblock"><b>{label}</b><div className="pc-rel-list">{people.length ? people.map((x) => <a key={x.id} onClick={() => onFocus(x.id)}>{x.name}</a>) : <span className="pc-muted">Sin datos</span>}</div></div>
}
