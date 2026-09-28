import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { dump as yamlDump } from 'js-yaml'
import { ACCOUNT, MAPFRE } from './data/mapfre'
import { autoLayout, NODE_H, NODE_W } from './layout'
import { PersonNode, type PersonNodeType } from './PersonNode'
import { SidePanel } from './SidePanel'
import {
  ATTITUDE_COLOR,
  ATTITUDE_LABEL,
  computeGaps,
  descendants,
  isAncestor,
  ROLE_COLOR,
  ROLE_LABEL,
  SALES_PLAYS,
  type Gap,
  type SalesPlay,
  type Stakeholder,
} from './model'
import './App.css'

const nodeTypes = { person: PersonNode }
const STORAGE_KEY = 'power-chart:mapfre'

type Positions = Record<string, { x: number; y: number }>

function loadInitial(): { people: Stakeholder[]; positions: Positions | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return { people: MAPFRE, positions: null }
}

function Chart() {
  const init = useRef(loadInitial())
  const [people, setPeopleRaw] = useState<Stakeholder[]>(init.current.people)
  const [positions, setPositions] = useState<Positions>(() => init.current.positions ?? autoLayout(init.current.people))
  const [history, setHistory] = useState<{ people: Stakeholder[]; positions: Positions }[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [gapsMode, setGapsMode] = useState(false)
  const [playFilter, setPlayFilter] = useState<SalesPlay | 'all'>('all')
  const [showInfluence, setShowInfluence] = useState(true)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { fitView, getIntersectingNodes } = useReactFlow()

  const commit = useCallback(
    (nextPeople: Stakeholder[], nextPositions?: Positions, record = true) => {
      if (record) setHistory((h) => [...h.slice(-30), { people, positions }])
      setPeopleRaw(nextPeople)
      if (nextPositions) setPositions(nextPositions)
    },
    [people, positions],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, positions }))
  }, [people, positions])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setPeopleRaw(last.people)
    setPositions(last.positions)
  }

  const relayout = () => {
    setHistory((h) => [...h.slice(-30), { people, positions }])
    setPositions(autoLayout(people))
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 30)
  }

  const reset = () => {
    if (!confirm('¿Restaurar los datos originales del Account Plan?')) return
    localStorage.removeItem(STORAGE_KEY)
    setPeopleRaw(MAPFRE)
    setPositions(autoLayout(MAPFRE))
    setHistory([])
    setCollapsed(new Set())
  }

  const gaps: Gap[] = useMemo(() => computeGaps(people), [people])
  const gapByNode = useMemo(() => {
    const m = new Map<string, 'critical' | 'warning'>()
    for (const g of gaps) if (g.nodeId) m.set(g.nodeId, m.get(g.nodeId) === 'critical' ? 'critical' : g.kind)
    return m
  }, [gaps])

  const hidden = useMemo(() => {
    const s = new Set<string>()
    for (const id of collapsed) for (const d of descendants(id, people)) if (d.id !== id) s.add(d.id)
    return s
  }, [collapsed, people])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const nodes: PersonNodeType[] = useMemo(
    () =>
      people
        .filter((p) => !hidden.has(p.id))
        .map((p) => {
          const filteredOut = playFilter !== 'all' && p.salesPlay !== playFilter
          const gap = gapByNode.get(p.id) ?? null
          const dimmed = filteredOut || (gapsMode && !gap)
          return {
            id: p.id,
            type: 'person',
            position: positions[p.id] ?? { x: 0, y: 0 },
            width: NODE_W,
            height: NODE_H,
            selected: p.id === selectedId,
            data: {
              person: p,
              childCount: people.filter((c) => c.reportsTo === p.id).length,
              collapsed: collapsed.has(p.id),
              dimmed,
              gap: gapsMode ? gap : null,
              dropTarget: dropTarget === p.id,
              onToggle: toggleCollapse,
            },
          }
        }),
    [people, positions, hidden, playFilter, gapsMode, gapByNode, selectedId, collapsed, dropTarget, toggleCollapse],
  )

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = []
    const visible = new Set(nodes.map((n) => n.id))
    for (const p of people) {
      if (p.reportsTo && visible.has(p.id) && visible.has(p.reportsTo)) {
        const hyp = p.reportsToConfidence === 'hypothesis'
        out.push({
          id: `r-${p.id}`,
          source: p.reportsTo,
          target: p.id,
          type: 'smoothstep',
          style: { stroke: hyp ? '#94a3b8' : '#334155', strokeWidth: 1.5, strokeDasharray: hyp ? '6 4' : undefined },
          label: hyp ? '?' : undefined,
          labelStyle: { fill: '#94a3b8', fontSize: 10 },
          labelBgStyle: { fill: '#fff' },
          labelBgPadding: [2, 1],
        })
      }
      if (showInfluence)
        for (const t of p.influences)
          if (visible.has(p.id) && visible.has(t))
            out.push({
              id: `i-${p.id}-${t}`,
              source: p.id,
              target: t,
              type: 'default',
              animated: true,
              style: { stroke: '#7c3aed', strokeWidth: 1.5, strokeDasharray: '5 4' },
              markerEnd: { type: 'arrowclosed' as never, color: '#7c3aed' },
            })
    }
    return out
  }, [people, nodes, showInfluence])

  const update = (id: string, patch: Partial<Stakeholder>) => {
    commit(people.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const reparent = (childId: string, parentId: string | null, record = true) => {
    if (childId === parentId) return
    if (parentId && isAncestor(childId, parentId, people)) {
      setToast('No puedes colgar a alguien de su propio subordinado.')
      return
    }
    const child = people.find((p) => p.id === childId)!
    const parent = parentId ? people.find((p) => p.id === parentId) : null
    const next = people.map((p) => (p.id === childId ? { ...p, reportsTo: parentId, reportsToConfidence: 'confirmed' as const } : p))
    commit(next, autoLayout(next), record)
    setToast(parent ? `${child.name} ahora reporta a ${parent.name}` : `${child.name} pasa a ser raíz`)
  }

  const removePerson = (id: string) => {
    const p = people.find((x) => x.id === id)!
    if (!confirm(`¿Eliminar a ${p.name} del chart?`)) return
    const next = people
      .filter((x) => x.id !== id)
      .map((x) => ({ ...x, reportsTo: x.reportsTo === id ? p.reportsTo : x.reportsTo, influences: x.influences.filter((i) => i !== id) }))
    commit(next, autoLayout(next))
    setSelectedId(null)
  }

  const addPerson = () => {
    const name = prompt('Nombre de la persona')
    if (!name) return
    const title = prompt('Cargo') ?? ''
    const id = `p${Date.now().toString(36)}`
    const parent = selectedId
    const np: Stakeholder = {
      id, name, title, level: '3rd', unit: parent ? people.find((p) => p.id === parent)!.unit : 'Sin asignar',
      salesPlay: 'Agentic Readiness', role: 'None', attitude: 'unknown', influence: 1, status: 'No contact',
      owner: 'Jorge', lastTouch: null, reportsTo: parent, reportsToConfidence: 'hypothesis', influences: [], notes: '',
    }
    const next = [...people, np]
    commit(next, autoLayout(next))
    setSelectedId(id)
  }

  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    setHistory((h) => [...h.slice(-30), { people, positions }])
  }, [people, positions])

  const onNodeDrag: OnNodeDrag = useCallback(
    (_e, node) => {
      setPositions((pos) => ({ ...pos, [node.id]: node.position }))
      const hits = getIntersectingNodes(node).filter((n) => n.id !== node.id)
      setDropTarget(hits[0]?.id ?? null)
    },
    [getIntersectingNodes],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      const target = dropTarget
      setDropTarget(null)
      if (target) {
        reparent(node.id, target, false)
        return
      }
      setPositions((pos) => ({ ...pos, [node.id]: node.position }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dropTarget, people, positions],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      const src = people.find((p) => p.id === c.source)!
      if (src.influences.includes(c.target)) return
      update(c.source, { influences: [...src.influences, c.target] })
      setToast(`${src.name} influye en ${people.find((p) => p.id === c.target)!.name}`)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people],
  )

  const onNodeClick: NodeMouseHandler<Node> = (_e, n) => setSelectedId(n.id)

  const exportYaml = () => {
    const doc = {
      account: ACCOUNT,
      updated: new Date().toISOString().slice(0, 10),
      schema: 'stakeholders/v1',
      stakeholders: people.map(({ id, name, title, level, unit, salesPlay, role, attitude, influence, status, owner, lastTouch, reportsTo, reportsToConfidence, influences, notes, external }) => ({
        id, name, title, level, unit, sales_play: salesPlay, role, attitude, influence, status, owner,
        last_touch: lastTouch, reports_to: reportsTo, reports_to_confidence: reportsToConfidence, influences,
        ...(external ? { source: 'research' } : {}), ...(notes ? { notes } : {}),
      })),
    }
    const text = `# Fuente de verdad de stakeholders de ${ACCOUNT.toUpperCase()}. Editar aquí o desde apps/power-chart (Exportar YAML).\n` + yamlDump(doc, { lineWidth: 120, noRefs: true })
    const blob = new Blob([text], { type: 'text/yaml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stakeholders.yaml'
    a.click()
    setToast('stakeholders.yaml descargado — sustituye accounts/mapfre/stakeholders.yaml y abre PR.')
  }

  const selected = people.find((p) => p.id === selectedId) ?? null
  const covered = people.filter((p) => p.status !== 'No contact').length
  const critical = gaps.filter((g) => g.kind === 'critical').length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <div className="acct">MAPFRE · Power Chart</div>
            <div className="sub">
              {people.length} personas · {covered} con contacto · {gaps.length} gaps ({critical} críticos)
            </div>
          </div>
        </div>
        <div className="tools">
          <select value={playFilter} onChange={(e) => setPlayFilter(e.target.value as SalesPlay | 'all')}>
            <option value="all">Todos los sales plays</option>
            {SALES_PLAYS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="chk">
            <input type="checkbox" checked={showInfluence} onChange={(e) => setShowInfluence(e.target.checked)} /> Influencia
          </label>
          <button className={gapsMode ? 'primary' : ''} onClick={() => setGapsMode((g) => !g)}>
            Modo Gaps {gapsMode ? 'ON' : 'OFF'}
          </button>
          <button onClick={addPerson}>+ Persona</button>
          <button onClick={relayout}>Reordenar</button>
          <button onClick={undo} disabled={!history.length}>Deshacer</button>
          <button onClick={exportYaml}>Exportar YAML</button>
          <button className="ghost" onClick={reset}>Reset</button>
        </div>
      </header>

      <div className="body">
        <div className="canvas" onClick={(e) => e.target === e.currentTarget && setSelectedId(null)}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedId(null)}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            connectionLineStyle={{ stroke: '#7c3aed', strokeDasharray: '5 4' }}
          >
            <Background gap={24} color="#e2e8f0" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => ROLE_COLOR[(n as PersonNodeType).data.person.role]} />
          </ReactFlow>

          <div className="legend">
            <div className="lg-title">Leyenda</div>
            <div className="lg-row"><b>Badge</b> rol MEDDPICC</div>
            <div className="lg-chips">
              {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).filter((r) => r !== 'None').map((r) => (
                <span key={r} className="chip" style={{ background: ROLE_COLOR[r] }}>{r} · {ROLE_LABEL[r]}</span>
              ))}
            </div>
            <div className="lg-row"><b>Borde</b> actitud (grosor = influencia)</div>
            <div className="lg-chips">
              {(Object.keys(ATTITUDE_LABEL) as (keyof typeof ATTITUDE_LABEL)[]).map((a) => (
                <span key={a} className="chip outline" style={{ borderColor: ATTITUDE_COLOR[a], borderStyle: a === 'unknown' ? 'dashed' : 'solid' }}>{ATTITUDE_LABEL[a]}</span>
              ))}
            </div>
            <div className="lg-row"><b>Punto</b> último touch: <i className="sw" style={{ background: '#16a34a' }} />≤14 d <i className="sw" style={{ background: '#f59e0b' }} />≤45 d <i className="sw" style={{ background: '#dc2626' }} />&gt;45 d <i className="sw" style={{ background: '#e2e8f0' }} />nunca</div>
            <div className="lg-row"><span className="line solid" /> reporta a &nbsp; <span className="line hyp" /> hipótesis (?) &nbsp; <span className="line inf" /> influye en</div>
            <div className="lg-hint">Arrastra una tarjeta <b>sobre otra</b> para cambiar a quién reporta. Arrastra desde el punto inferior a otra tarjeta para añadir influencia.</div>
          </div>

          {toast && <div className="toast">{toast}</div>}
        </div>

        <aside className="side">
          {selected ? (
            <SidePanel
              person={selected}
              people={people}
              onChange={(patch) => update(selected.id, patch)}
              onReparent={(pid) => reparent(selected.id, pid)}
              onRemove={() => removePerson(selected.id)}
              onFocus={(id) => setSelectedId(id)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <GapsPanel gaps={gaps} onFocus={(id) => setSelectedId(id)} people={people} />
          )}
        </aside>
      </div>
    </div>
  )
}

function GapsPanel({ gaps, onFocus, people }: { gaps: Gap[]; onFocus: (id: string) => void; people: Stakeholder[] }) {
  const byRole = (r: Stakeholder['role']) => people.filter((p) => p.role === r).length
  return (
    <div className="panel">
      <h2>Gaps MEDDPICC</h2>
      <p className="muted">Lo que falta para trabajar la cuenta. Haz clic para ir a la persona.</p>
      <div className="kpis">
        <div><b>{byRole('EB')}</b><span>EB</span></div>
        <div><b>{byRole('Champion')}</b><span>Champion</span></div>
        <div><b>{byRole('Coach')}</b><span>Coach</span></div>
        <div><b>{byRole('Blocker')}</b><span>Blocker</span></div>
      </div>
      <ul className="gaps">
        {gaps.map((g, i) => (
          <li key={i} className={g.kind} onClick={() => g.nodeId && onFocus(g.nodeId)} style={{ cursor: g.nodeId ? 'pointer' : 'default' }}>
            <span className="pill">{g.kind === 'critical' ? 'Crítico' : 'Aviso'}</span> {g.text}
          </li>
        ))}
        {gaps.length === 0 && <li className="ok">Sin gaps. Cuenta cubierta.</li>}
      </ul>
      <h3>Cómo se conecta con Devin</h3>
      <ul className="devin">
        <li><b>Exportar YAML</b> → `accounts/mapfre/stakeholders.yaml` (commit/PR).</li>
        <li>Skill <b>power-map-review</b>: lee este YAML y propone el camino al EB.</li>
        <li>Desde una persona: <i>Generar cadencia</i> / <i>Brief</i> lanzan los playbooks con su contexto.</li>
      </ul>
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Chart />
    </ReactFlowProvider>
  )
}
