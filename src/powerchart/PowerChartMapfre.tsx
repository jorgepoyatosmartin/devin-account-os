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
import { useSearchParams } from 'react-router-dom'
import { ACCOUNT, MAPFRE } from './data/mapfre'
import { LaneNode, type LaneNodeType } from './LaneNode'
import { autoLayout, NODE_H, NODE_W } from './layout'
import { PersonNode, type PersonNodeType } from './PersonNode'
import { PersonSheet } from './PersonSheet'
import { ATTITUDE_COLOR, ATTITUDE_LABEL, computeGaps, descendants, isAncestor, ROLE_COLOR, ROLE_LABEL, SALES_PLAYS, daysSince, type Gap, type SalesPlay, type Stakeholder, todayISO } from './model'
import { buildRepoSavePrompt } from './repoSave'
import { DEVIN_URL } from './playbooks'
import { getMapfreSnapshot, resetMapfre, setMapfreLayout, setMapfreSnapshot, subscribeMapfre, type Positions } from './store'
import { toYamlRecord, toYamlText } from './yaml'
import './powerchart.css'

type Group = 'none' | 'unit' | 'country'
type View = { country: string | 'all' | '__none__'; unit: string | 'all'; group: Group }
type ChartNode = PersonNodeType | LaneNodeType
type HistoryEntry = { people: Stakeholder[]; viewKey: string; positions: Positions }
type HoverCardState = { id: string; left: number; top: number } | null

const nodeTypes = { person: PersonNode, lane: LaneNode }
const emptyPositions: Positions = {}
const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es'))
const viewKeyFor = (view: View) => `${view.country}|${view.unit}|${view.group}`

function groupedLayout(people: Stakeholder[], group: Group): Positions {
  if (group === 'none') return autoLayout(people)
  const keyFor = (p: Stakeholder) => group === 'unit' ? (p.businessUnit || p.unit || 'Sin asignar') : (p.country || 'Sin país')
  const groups = new Map<string, Stakeholder[]>()
  for (const p of people) groups.set(keyFor(p), [...(groups.get(keyFor(p)) ?? []), p])
  const positions: Positions = {}
  let offset = 20
  for (const [label, members] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    const lane = autoLayout(members)
    const xs = members.map((p) => lane[p.id].x)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    members.forEach((p) => { positions[p.id] = { x: lane[p.id].x + offset - minX, y: lane[p.id].y } })
    offset += maxX - minX + NODE_W + 120
    void label
  }
  return positions
}

function Chart() {
  const [params, setParams] = useSearchParams()
  const snapshot = getMapfreSnapshot()
  const [people, setPeople] = useState<Stakeholder[]>(snapshot.people)
  const allCountries = useMemo(() => sorted(people.flatMap((p) => p.country ? [p.country] : [])), [people])
  const allUnits = useMemo(() => sorted(people.map((p) => p.businessUnit || p.unit).filter(Boolean)), [people])
  const hasNoCountry = people.some((p) => !p.country)
  const requestedCountry = params.get('pcCountry') ?? 'all'
  const requestedUnit = params.get('pcUnit') ?? 'all'
  const requestedGroup = params.get('pcGroup') ?? 'none'
  const view: View = {
    country: requestedCountry === 'all' || (requestedCountry === '__none__' && hasNoCountry) || allCountries.includes(requestedCountry) ? requestedCountry : 'all',
    unit: requestedUnit === 'all' || allUnits.includes(requestedUnit) ? requestedUnit : 'all',
    group: requestedGroup === 'unit' || requestedGroup === 'country' ? requestedGroup : 'none',
  }
  const viewKey = viewKeyFor(view)
  const viewPeople = useMemo(
    () => people.filter((p) => (view.country === 'all' || (view.country === '__none__' ? !p.country : p.country === view.country)) && (view.unit === 'all' || (p.businessUnit || p.unit) === view.unit)),
    [people, view.country, view.unit],
  )
  const [positions, setPositions] = useState<Positions>(() => snapshot.layouts[viewKey] ?? emptyPositions)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Stakeholder | null>(null)
  const [draftTouched, setDraftTouched] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [gapsMode, setGapsMode] = useState(false)
  const [playFilter, setPlayFilter] = useState<SalesPlay | 'all'>('all')
  const [showInfluence, setShowInfluence] = useState(true)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [hoverCard, setHoverCard] = useState<HoverCardState>(null)
  const [repoOpen, setRepoOpen] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const [countryText, setCountryText] = useState('')
  const [countryResult, setCountryResult] = useState<{ matches: { id: string; name: string; country: string }[]; unmatched: string[] } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const confidenceExplicitRef = useRef(false)
  const { fitView, getIntersectingNodes } = useReactFlow()
  const selected = people.find((p) => p.id === selectedId) ?? null
  const dirty = Boolean(draftTouched && selected && draft && JSON.stringify(selected) !== JSON.stringify(draft))
  const pending = useMemo(() => pendingPeople(people), [people])

  const updateSearch = useCallback((next: Partial<View>) => {
    setParams((previous) => {
      const currentCountry = previous.get('pcCountry') ?? 'all'
      const currentUnit = previous.get('pcUnit') ?? 'all'
      const currentGroup = previous.get('pcGroup') ?? 'none'
      previous.set('pcCountry', String(next.country ?? currentCountry))
      previous.set('pcUnit', String(next.unit ?? currentUnit))
      previous.set('pcGroup', String(next.group ?? currentGroup))
      return previous
    }, { replace: true })
  }, [setParams])

  const dismissHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setHoverCard(null)
  }, [])

  const commit = useCallback((nextPeople: Stakeholder[], nextPositions: Positions = positions, record = true, targetViewKey = viewKey) => {
    if (record) setHistory((h) => [...h.slice(-30), { people, viewKey: targetViewKey, positions }])
    setMapfreSnapshot(nextPeople, { ...getMapfreSnapshot().layouts, [targetViewKey]: nextPositions })
    setPeople(nextPeople)
    if (targetViewKey === viewKey) setPositions(nextPositions)
  }, [people, positions, viewKey])

  useEffect(() => {
    const saved = getMapfreSnapshot().layouts[viewKey]
    const hasAll = Boolean(saved && viewPeople.every((p) => saved[p.id] !== undefined))
    const next = hasAll ? saved! : groupedLayout(viewPeople, view.group)
    setPositions(next)
    if (!hasAll) setMapfreLayout(viewKey, next)
  }, [viewKey, view.group, viewPeople])

  useEffect(() => subscribeMapfre(() => {
    const next = getMapfreSnapshot().people
    setPeople((current) => current === next ? current : next)
  }), [])

  useEffect(() => {
    if (selected && !draftTouched) setDraft(selected)
  }, [selected, draftTouched])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedId) requestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const requestOpen = (id: string) => {
    dismissHover()
    if (id === selectedId) return
    if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    const person = people.find((p) => p.id === id)
    if (!person) return
    setSelectedId(id)
    setDraft(person)
    setDraftTouched(false)
    confidenceExplicitRef.current = false
  }

  const requestClose = () => {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    setSelectedId(null)
    setDraft(null)
    setDraftTouched(false)
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    const layouts = { ...getMapfreSnapshot().layouts, [last.viewKey]: last.positions }
    setMapfreSnapshot(last.people, layouts)
    setPeople(last.people)
    if (last.viewKey === viewKey) setPositions(last.positions)
  }

  const relayout = () => {
    const next = groupedLayout(viewPeople, view.group)
    setHistory((h) => [...h.slice(-30), { people, viewKey, positions }])
    setPositions(next)
    setMapfreLayout(viewKey, next)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 30)
  }

  const reset = () => {
    if (!confirm('¿Restaurar los datos originales del Account Plan?')) return
    resetMapfre()
    setPeople(MAPFRE)
    setPositions(groupedLayout(MAPFRE, view.group))
    setHistory([])
    setCollapsed(new Set())
  }

  const gapsAll = useMemo(() => computeGaps(people), [people])
  const visibleIds = useMemo(() => new Set(viewPeople.map((p) => p.id)), [viewPeople])
  const isGlobal = view.country === 'all' && view.unit === 'all' && view.group === 'none'
  const gaps = useMemo(
    () => gapsAll.filter((g) => g.nodeId ? visibleIds.has(g.nodeId) : isGlobal),
    [gapsAll, visibleIds, isGlobal],
  )
  const gapByNode = useMemo(() => {
    const m = new Map<string, 'critical' | 'warning'>()
    for (const g of gapsAll) if (g.nodeId) m.set(g.nodeId, m.get(g.nodeId) === 'critical' ? 'critical' : g.kind)
    return m
  }, [gapsAll])
  const hidden = useMemo(() => {
    const result = new Set<string>()
    for (const id of collapsed) for (const d of descendants(id, people)) if (d.id !== id) result.add(d.id)
    return result
  }, [collapsed, people])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const nodePeople = useMemo(() => viewPeople.filter((p) => !hidden.has(p.id)), [viewPeople, hidden])
  const personNodes = useMemo(() => nodePeople.map((p) => {
    const filteredOut = playFilter !== 'all' && p.salesPlay !== playFilter
    const gap = gapByNode.get(p.id) ?? null
    const dimmed = filteredOut || (gapsMode && !gap)
    const manager = p.reportsTo ? people.find((item) => item.id === p.reportsTo) : undefined
    const managerVisible = manager && nodePeople.some((item) => item.id === manager.id) &&
      (view.group === 'none' || laneFor(manager, view.group) === laneFor(p, view.group))
    const managerDimension = view.country !== 'all' ? manager?.country || 'Sin país' :
      view.unit !== 'all' ? manager?.businessUnit || manager?.unit || 'Sin asignar' :
        view.group === 'country' ? manager?.country || 'Sin país' : manager?.businessUnit || manager?.unit || 'Sin asignar'
    return {
      id: p.id,
      type: 'person' as const,
      position: positions[p.id] ?? { x: 0, y: 0 },
      width: NODE_W,
      height: NODE_H,
      selected: p.id === selectedId,
      data: {
        person: p,
        childCount: viewPeople.filter((child) => child.reportsTo === p.id).length,
        collapsed: collapsed.has(p.id),
        dimmed,
        gap: gapsMode ? gap : null,
        dropTarget: dropTarget === p.id,
        onToggle: toggleCollapse,
        managerStub: p.reportsTo && !managerVisible ? `${manager?.name ?? p.reportsTo} · ${managerDimension}` : undefined,
        onManagerClick: requestOpen,
      },
    }
  }), [nodePeople, viewPeople, positions, selectedId, people, view, playFilter, gapByNode, gapsMode, collapsed, dropTarget, toggleCollapse, requestOpen])

  const laneNodes = useMemo(() => {
    if (view.group === 'none') return []
    const groups = new Map<string, Stakeholder[]>()
    for (const p of nodePeople) {
      const label = laneFor(p, view.group)
      groups.set(label, [...(groups.get(label) ?? []), p])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([label, members]) => {
      const xs = members.map((p) => positions[p.id]?.x ?? 0)
      const ys = members.map((p) => positions[p.id]?.y ?? 0)
      return {
        id: `lane-${label}`,
        type: 'lane' as const,
        position: { x: Math.min(...xs), y: Math.min(...ys) - 42 },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        data: { label: `${label} · ${members.length}` },
      }
    })
  }, [view.group, nodePeople, positions])
  const nodes: ChartNode[] = [...personNodes, ...laneNodes]
  const fitSignature = `${viewKey}:${nodePeople.map((p) => p.id).join(',')}`
  const layoutReady = nodePeople.every((p) => positions[p.id] !== undefined)

  useEffect(() => {
    if (!layoutReady) return
    const timer = window.setTimeout(() => fitView({ padding: 0.15, duration: 0 }), 50)
    return () => window.clearTimeout(timer)
  }, [fitView, fitSignature, layoutReady])

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = []
    const visible = new Set(personNodes.map((n) => n.id))
    const laneIds = new Map(nodePeople.map((p) => [p.id, view.group === 'none' ? '' : laneFor(p, view.group)]))
    for (const p of people) {
      if (p.reportsTo && visible.has(p.id) && visible.has(p.reportsTo) && laneIds.get(p.id) === laneIds.get(p.reportsTo)) {
        const hyp = p.reportsToConfidence === 'hypothesis'
        out.push({
          id: `r-${p.id}`, source: p.reportsTo, target: p.id, type: 'smoothstep',
          style: { stroke: hyp ? '#94a3b8' : '#334155', strokeWidth: 1.5, strokeDasharray: hyp ? '6 4' : undefined },
          label: hyp ? '?' : undefined, labelStyle: { fill: '#94a3b8', fontSize: 10 }, labelBgStyle: { fill: '#fff' }, labelBgPadding: [2, 1],
        })
      }
      if (showInfluence) for (const target of p.influences) {
        if (visible.has(p.id) && visible.has(target)) out.push({
          id: `i-${p.id}-${target}`, source: p.id, target, type: 'default', animated: true,
          style: { stroke: '#7c3aed', strokeWidth: 1.5, strokeDasharray: '5 4' },
          markerEnd: { type: 'arrowclosed' as never, color: '#7c3aed' },
        })
      }
    }
    return out
  }, [people, personNodes, nodePeople, view.group, showInfluence])

  const saveDraft = () => {
    if (!selected || !draft || !dirty) return
    if (draft.reportsTo && (draft.reportsTo === selected.id || isAncestor(selected.id, draft.reportsTo, people))) {
      setToast('No puedes colgar a alguien de su propio subordinado.')
      return
    }
    const parentChanged = draft.reportsTo !== selected.reportsTo
    const saved = {
      ...draft,
      reportsToConfidence: parentChanged && !(confidenceExplicitRef.current && draft.reportsToConfidence === 'confirmed')
        ? 'hypothesis' as const
        : draft.reportsToConfidence,
      ...(draft.status !== selected.status ? { appStatus: undefined } : {}),
    }
    const next = people.map((p) => p.id === saved.id ? saved : p)
    const nextPositions = parentChanged ? groupedLayout(viewPeople.map((p) => p.id === saved.id ? saved : p), view.group) : positions
    commit(next, nextPositions)
    setDraft(saved)
    setDraftTouched(false)
    confidenceExplicitRef.current = false
    setToast(`Guardado en este navegador · ${pendingPeople(next).length} cambios pendientes de guardar en repo`)
    if (parentChanged) setMapfreLayout(viewKey, nextPositions)
  }

  const cancelDraft = () => {
    if (selected) setDraft(selected)
    setDraftTouched(false)
    confidenceExplicitRef.current = false
  }

  const markDeparted = () => {
    if (!selected || !draft) return
    if (!confirm(`¿Marcar a ${draft.name} como baja? Se conserva en el YAML con status "No contact".`)) return
    const note = `Salió en ${todayISO()}`
    const saved = { ...draft, status: 'No contact' as const, appStatus: undefined, role: 'None' as const, attitude: 'unknown' as const, departed: true, notes: draft.notes ? `${note}. ${draft.notes}` : note }
    const next = people.map((p) => p.id === saved.id ? saved : p)
    commit(next, positions)
    setDraft(saved)
    setDraftTouched(false)
    confidenceExplicitRef.current = false
    setToast(`${saved.name} marcado como baja`)
  }

  const addPerson = () => {
    const name = prompt('Nombre de la persona')
    if (!name) return
    const title = prompt('Cargo') ?? ''
    const id = `p${Date.now().toString(36)}`
    const parent = selectedId ? people.find((p) => p.id === selectedId) : undefined
    const np: Stakeholder = {
      id, name, title, level: '3rd',
      unit: parent?.unit ?? (view.unit !== 'all' ? view.unit : 'Sin asignar'),
      businessUnit: parent?.businessUnit ?? (view.unit !== 'all' ? view.unit : 'Sin asignar'),
      country: parent ? parent.country : (view.country === '__none__' ? null : view.country !== 'all' ? view.country : null),
      responsibilities: '', priorities: '',
      salesPlay: 'Agentic Readiness', role: 'None', attitude: 'unknown', influence: 1, status: 'No contact',
      owner: 'Jorge', lastTouch: null, reportsTo: parent?.id ?? null, reportsToConfidence: 'hypothesis', influences: [], notes: '',
    }
    const next = [...people, np]
    const nextViewPeople = [...viewPeople, ...(view.country === 'all' || (view.country === '__none__' ? !np.country : np.country === view.country) ? (view.unit === 'all' || np.businessUnit === view.unit ? [np] : []) : [])]
    const nextPositions = groupedLayout(nextViewPeople, view.group)
    commit(next, nextPositions)
    requestOpen(id)
  }

  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    dismissHover()
    setHistory((h) => [...h.slice(-30), { people, viewKey, positions }])
  }, [dismissHover, people, viewKey, positions])

  const onNodeDrag: OnNodeDrag = useCallback((_event, node) => {
    setPositions((current) => ({ ...current, [node.id]: node.position }))
    const hits = getIntersectingNodes(node).filter((n) => n.id !== node.id && n.type === 'person')
    setDropTarget(hits[0]?.id ?? null)
  }, [getIntersectingNodes])

  const onNodeDragStop: OnNodeDrag = (_event, node) => {
    const target = dropTarget
    setDropTarget(null)
    if (target) {
      reparentFromDrag(node.id, target)
      return
    }
    const next = { ...positions, [node.id]: node.position }
    setPositions(next)
    setMapfreLayout(viewKey, next)
  }

  const reparentFromDrag = (childId: string, parentId: string) => {
    if (childId === parentId || isAncestor(childId, parentId, people)) {
      if (childId !== parentId) setToast('No puedes colgar a alguien de su propio subordinado.')
      return
    }
    const child = people.find((p) => p.id === childId)!
    const parent = people.find((p) => p.id === parentId)
    const next = people.map((p) => p.id === childId ? { ...p, reportsTo: parentId, reportsToConfidence: 'hypothesis' as const } : p)
    const nextViewPeople = viewPeople.map((p) => p.id === childId ? { ...p, reportsTo: parentId } : p)
    const nextPositions = groupedLayout(nextViewPeople, view.group)
    commit(next, nextPositions, false)
    setToast(`${child.name} ahora reporta a ${parent?.name ?? parentId}`)
  }

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    const source = people.find((p) => p.id === connection.source)!
    if (source.influences.includes(connection.target)) return
    commit(people.map((p) => p.id === source.id ? { ...p, influences: [...p.influences, connection.target!] } : p))
    setToast(`${source.name} influye en ${people.find((p) => p.id === connection.target)?.name}`)
  }, [people, commit])

  const onNodeClick: NodeMouseHandler<Node> = (_event, node) => {
    if (node.type === 'person') requestOpen(node.id)
  }

  const onNodeMouseEnter: NodeMouseHandler<Node> = (event, node) => {
    if (node.type !== 'person' || selectedId) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    const target = event.target instanceof Element ? event.target.closest('.react-flow__node') : null
    const canvas = document.querySelector('.pc-app .canvas')
    if (!target || !canvas) return
    hoverTimer.current = setTimeout(() => {
      const rect = target.getBoundingClientRect()
      const parent = canvas.getBoundingClientRect()
      const width = 320
      let left = rect.right - parent.left + 12
      if (left + width > parent.width) left = rect.left - parent.left - width - 12
      left = Math.max(8, Math.min(left, parent.width - width - 8))
      const cardHeight = Math.min(560, parent.height - 16)
      const top = Math.max(8, Math.min(rect.top - parent.top, parent.height - cardHeight - 8))
      setHoverCard({ id: node.id, left, top })
    }, 300)
  }

  const onNodeMouseLeave: NodeMouseHandler<Node> = () => dismissHover()

  const viewName = getViewName(view)
  const covered = viewPeople.filter((p) => p.status !== 'No contact').length
  const critical = gaps.filter((g) => g.kind === 'critical').length
  const hoverPerson = hoverCard ? people.find((p) => p.id === hoverCard.id) : null

  const beginCountryPreview = () => setCountryResult(parseCountryImport(countryText, people))
  const applyCountries = () => {
    if (!countryResult?.matches.length) return
    const updates = new Map(countryResult.matches.map((row) => [row.id, row.country]))
    const next = people.map((p) => updates.has(p.id) ? { ...p, country: updates.get(p.id)! } : p)
    commit(next, positions)
    setCountryOpen(false)
    setCountryText('')
    setCountryResult(null)
    setToast(`${updates.size} países actualizados`)
  }

  const copyRepoPrompt = async () => {
    const summary = pending.map((p) => `- ${p.person.name} (${p.person.id}): ${p.label}`).join('\n')
    const prompt = buildRepoSavePrompt(ACCOUNT, pending.map((x) => x.person), summary)
    try {
      await navigator.clipboard.writeText(prompt)
      window.open(DEVIN_URL, '_blank', 'noopener')
      setToast('Prompt copiado al portapapeles — Devin se ha abierto en otra pestaña.')
    } catch {
      setToast('No se pudo copiar el prompt (portapapeles no disponible).')
    }
  }

  const downloadYaml = () => {
    const blob = new Blob([toYamlText(people, ACCOUNT)], { type: 'text/yaml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stakeholders.yaml'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="pc-app">
      <header className="topbar">
        <div className="pc-brand">
          <span className="logo">◆</span>
          <div>
            <div className="acct">MAPFRE · Power Chart</div>
            <div className="sub">{viewName}</div>
            <div className="sub">{viewPeople.length} personas · {covered} con contacto · {gaps.length} gaps ({critical} críticos)</div>
          </div>
        </div>
        <div className="tools">
          <select aria-label="País" value={view.country} onChange={(e) => updateSearch({ country: e.target.value })}>
            <option value="all">Todos los países</option>
            {allCountries.map((x) => <option key={x} value={x}>{x}</option>)}
            {hasNoCountry && <option value="__none__">Sin país</option>}
          </select>
          <select aria-label="Unidad" value={view.unit} onChange={(e) => updateSearch({ unit: e.target.value })}>
            <option value="all">Todas las unidades</option>{allUnits.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <div className="pc-group-control"><span>Agrupar:</span>{(['none', 'unit', 'country'] as const).map((x) => <button key={x} className={view.group === x ? 'pc-group-active' : ''} onClick={() => updateSearch({ group: x })}>{x === 'none' ? 'Ninguno' : x === 'unit' ? 'Unidad' : 'País'}</button>)}</div>
          <button onClick={() => updateSearch({ country: 'all', unit: 'all', group: 'none' })}>Global</button>
          <select aria-label="Sales play" value={playFilter} onChange={(e) => setPlayFilter(e.target.value as SalesPlay | 'all')}>
            <option value="all">Todos los sales plays</option>{SALES_PLAYS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="chk"><input type="checkbox" checked={showInfluence} onChange={(e) => setShowInfluence(e.target.checked)} /> Influencia</label>
          <button className={gapsMode ? 'primary' : ''} onClick={() => setGapsMode((g) => !g)}>Modo Gaps {gapsMode ? 'ON' : 'OFF'}</button>
          <button onClick={addPerson}>+ Persona</button>
          <button onClick={relayout}>Reordenar</button>
          <button onClick={undo} disabled={!history.length}>Deshacer</button>
          <button disabled={!pending.length} onClick={() => setRepoOpen(true)}>Guardar en repo ({pending.length})</button>
          <button onClick={() => { setCountryOpen(true); setCountryResult(null) }}>Importar países</button>
          <button className="ghost" onClick={reset}>Reset</button>
        </div>
      </header>

      <div className="body">
        <div className="canvas" onClick={(e) => { if (e.target === e.currentTarget) requestClose() }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneClick={requestClose}
            onMoveStart={dismissHover}
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
            <MiniMap pannable zoomable nodeColor={(node) => node.type === 'person' ? ROLE_COLOR[(node as PersonNodeType).data.person.role] : '#cbd5e1'} />
          </ReactFlow>
          <div className="legend">
            <div className="lg-title">Leyenda</div>
            <div className="lg-row"><b>Badge</b> rol MEDDPICC</div>
            <div className="lg-chips">{(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).filter((r) => r !== 'None').map((r) => <span key={r} className="chip" style={{ background: ROLE_COLOR[r] }}>{r} · {ROLE_LABEL[r]}</span>)}</div>
            <div className="lg-row"><b>Borde</b> actitud (grosor = influencia)</div>
            <div className="lg-chips">{(Object.keys(ATTITUDE_LABEL) as (keyof typeof ATTITUDE_LABEL)[]).map((a) => <span key={a} className="chip outline" style={{ borderColor: ATTITUDE_COLOR[a], borderStyle: a === 'unknown' ? 'dashed' : 'solid' }}>{ATTITUDE_LABEL[a]}</span>)}</div>
            <div className="lg-row"><span className="line solid" /> reporta a &nbsp; <span className="line hyp" /> hipótesis (?) &nbsp; <span className="line inf" /> influye en</div>
            <div className="lg-hint">Arrastra una tarjeta sobre otra para cambiar a quién reporta. Arrastra desde el punto inferior a otra tarjeta para añadir influencia.</div>
          </div>
          {hoverPerson && hoverCard && !selected && (
            <HoverCard person={hoverPerson} people={people} gaps={gapsAll.filter((g) => g.nodeId === hoverPerson.id)} style={{ left: hoverCard.left, top: hoverCard.top }} />
          )}
          {toast && <div className="pc-toast">{toast}</div>}
          {repoOpen && <RepoSaveDialog pending={pending} onClose={() => setRepoOpen(false)} onCopy={copyRepoPrompt} onDownload={downloadYaml} />}
          {countryOpen && <CountryImportDialog
            text={countryText}
            result={countryResult}
            onText={(value) => { setCountryText(value); setCountryResult(null) }}
            onPreview={beginCountryPreview}
            onApply={applyCountries}
            onClose={() => setCountryOpen(false)}
          />}
        </div>
        <aside className="side"><GapsPanel gaps={gaps} onFocus={requestOpen} people={viewPeople} /></aside>
        {selected && draft && (
          <PersonSheet
            account={ACCOUNT}
            person={selected}
            draft={draft}
            people={people}
            gaps={gapsAll.filter((g) => g.nodeId === selected.id)}
            businessUnits={allUnits}
            countries={allCountries}
            dirty={dirty}
            onChange={(patch) => { setDraftTouched(true); setDraft((current) => current ? { ...current, ...patch } : current) }}
            onConfidenceExplicit={() => { confidenceExplicitRef.current = true }}
            onSave={saveDraft}
            onCancel={cancelDraft}
            onClose={requestClose}
            onMarkDeparted={markDeparted}
            onFocus={requestOpen}
            onLaunched={(copied) => setToast(copied ? 'Prompt copiado al portapapeles — pégalo en la nueva sesión de Devin.' : 'No se pudo copiar el prompt (portapapeles no disponible). Inténtalo de nuevo.')}
          />
        )}
      </div>
    </div>
  )
}

function laneFor(person: Stakeholder, group: Group) {
  return group === 'country' ? (person.country || 'Sin país') : (person.businessUnit || person.unit || 'Sin asignar')
}

function getViewName(view: View) {
  let name: string
  if (view.country === 'all' && view.unit === 'all') name = 'Global consolidado'
  else if (view.country === 'all') name = `${view.unit} · Global`
  else if (view.unit === 'all') name = `${view.country === '__none__' ? 'Sin país' : view.country} · Todas las unidades`
  else name = `${view.country === '__none__' ? 'Sin país' : view.country} · ${view.unit}`
  if (view.group === 'unit') name += ' · por unidad'
  if (view.group === 'country') name += ' · por país'
  return name
}

function pendingPeople(people: Stakeholder[]) {
  const bundled = new Map(MAPFRE.map((p) => [p.id, JSON.stringify(toYamlRecord(p))]))
  return people.flatMap((person) => {
    const record = toYamlRecord(person)
    const original = MAPFRE.find((p) => p.id === person.id)
    const originalRecord = original ? toYamlRecord(original) : null
    if (original && JSON.stringify(record) === bundled.get(person.id)) return []
    const label = !original ? 'Nueva persona' : person.departed && !original.departed ? 'Baja' : changedYamlFields(originalRecord ?? {}, record)
    return [{ person, label, original: originalRecord, record }]
  })
}

function changedYamlFields(before: object, after: object) {
  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>
  return [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].filter((key) => JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key]))
}

function compact(value: unknown) {
  if (value === undefined || value === null || value === '') return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 88 ? `${text.slice(0, 85)}…` : text
}

function RepoSaveDialog({ pending, onClose, onCopy, onDownload }: {
  pending: ReturnType<typeof pendingPeople>
  onClose: () => void
  onCopy: () => void
  onDownload: () => void
}) {
  return (
    <div className="pc-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="pc-modal" role="dialog" aria-modal="true" aria-label="Guardar en repo">
        <header><h2>Guardar en repo</h2><button className="ghost" onClick={onClose}>✕</button></header>
        <div className="pc-change-list">
          {pending.map(({ person, label, original, record }) => (
            <article key={person.id}>
              <b>{person.name} ({person.id})</b>
              <div>{label === 'Nueva persona' || label === 'Baja' ? label : changedYamlFields(original ?? {}, record).map((key) => <div key={key}><code>{key}</code>: {compact(original?.[key])} → {compact(record[key])}</div>)}</div>
            </article>
          ))}
        </div>
        <p className="pc-modal-note">Devin abrirá un PR que actualiza accounts/mapfre/stakeholders.yaml. Hasta que se mergee y se vuelva a publicar la app, los cambios siguen solo en este navegador.</p>
        <footer><button className="primary" onClick={onCopy}>Copiar prompt y abrir Devin</button><button onClick={onDownload}>Descargar YAML completo</button></footer>
      </section>
    </div>
  )
}

function parseCountryImport(text: string, people: Stakeholder[]) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const matches: { id: string; name: string; country: string }[] = []
  const unmatched: string[] = []
  for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    const sep = line.match(/[;,\t]/)?.[0]
    if (!sep) { unmatched.push(line); continue }
    const index = line.indexOf(sep)
    const identity = line.slice(0, index).trim()
    const country = line.slice(index + 1).trim()
    const person = people.find((p) => p.id === identity) ?? people.find((p) => normalize(p.name) === normalize(identity))
    if (!person || !country) unmatched.push(line)
    else matches.push({ id: person.id, name: person.name, country })
  }
  return { matches, unmatched }
}

function CountryImportDialog({ text, result, onText, onPreview, onApply, onClose }: {
  text: string
  result: { matches: { id: string; name: string; country: string }[]; unmatched: string[] } | null
  onText: (value: string) => void
  onPreview: () => void
  onApply: () => void
  onClose: () => void
}) {
  return (
    <div className="pc-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="pc-modal" role="dialog" aria-modal="true" aria-label="Importar países">
        <header><h2>Importar países</h2><button className="ghost" onClick={onClose}>✕</button></header>
        <label className="pc-field"><span>Una persona por línea: id o nombre;país</span><textarea rows={7} value={text} onChange={(e) => onText(e.target.value)} placeholder="Santiago Wiznez;España" /></label>
        <button onClick={onPreview}>Vista previa</button>
        {result && <div className="pc-import-preview">
          <b>{result.matches.length} coincidencias</b>
          {result.matches.map((row, i) => <div key={`${row.id}-${i}`}>{row.name} → {row.country}</div>)}
          {result.unmatched.length > 0 && <div className="pc-import-unmatched"><b>Sin coincidencia ({result.unmatched.length})</b>{result.unmatched.map((line, i) => <div key={`${line}-${i}`}>{line}</div>)}</div>}
        </div>}
        <footer><button disabled={!result?.matches.length} className="primary" onClick={onApply}>Aplicar</button><button onClick={onClose}>Cancelar</button></footer>
      </section>
    </div>
  )
}

function HoverCard({ person: p, people, gaps, style }: { person: Stakeholder; people: Stakeholder[]; gaps: Gap[]; style: React.CSSProperties }) {
  const manager = people.find((x) => x.id === p.reportsTo)
  const team = people.filter((x) => x.reportsTo === p.id)
  const influences = p.influences.map((id) => people.find((x) => x.id === id)).filter((x): x is Stakeholder => Boolean(x))
  const influencedBy = people.filter((x) => x.influences.includes(p.id))
  const elapsed = daysSince(p.lastTouch)
  return (
    <div className="pc-hover-card" style={style}>
      <div className="pc-hover-head"><b>{p.name}</b><span className="pc-role-badge">{ROLE_LABEL[p.role]}</span>{p.departed && <span className="pc-departed-badge">Baja</span>}{p.external && <span className="pc-research-badge">research</span>}</div>
      <div className="pc-hover-title">{p.title}</div>
      <div className="pc-hover-meta">{p.businessUnit || p.unit} · {p.unit} · {p.country || 'Sin país'} · {p.level}</div>
      <div>Actitud: {ATTITUDE_LABEL[p.attitude]} · Influencia: {['', 'Baja', 'Media', 'Alta'][p.influence]} · Estado PG: {p.status}</div>
      <div>Owner: {p.owner} · Último touch: {elapsed === null ? 'nunca' : `hace ${elapsed} d`}</div>
      <div>Reporta a: {manager ? `${manager.name} · ${p.reportsToConfidence === 'confirmed' ? 'confirmado' : 'hipótesis'}` : '—'}</div>
      <div>Equipo ({team.length}): {team.slice(0, 5).map((x) => x.name).join(', ')}{team.length > 5 ? `, +${team.length - 5}` : ''}</div>
      <div>Influye en: {influences.map((x) => x.name).join(', ') || '—'}</div>
      <div>Le influyen: {influencedBy.map((x) => x.name).join(', ') || '—'}</div>
      {p.responsibilities && <div><b>Responsabilidades:</b> {p.responsibilities}</div>}
      {p.priorities && <div><b>Prioridades:</b> {p.priorities}</div>}
      {p.notes && <div><b>Notas:</b> {p.notes.length > 280 ? `${p.notes.slice(0, 277)}…` : p.notes}</div>}
      {gaps.length > 0 && <div className="pc-hover-gaps"><b>Gaps:</b> {gaps.map((g) => g.text).join(' ')}</div>}
    </div>
  )
}

function GapsPanel({ gaps, onFocus, people }: { gaps: Gap[]; onFocus: (id: string) => void; people: Stakeholder[] }) {
  const byRole = (role: Stakeholder['role']) => people.filter((p) => p.role === role).length
  return (
    <div className="panel">
      <h2>Gaps MEDDPICC</h2>
      <p className="pc-muted">Lo que falta para trabajar la cuenta. Haz clic para ir a la persona.</p>
      <div className="kpis">{(['EB', 'Champion', 'Coach', 'Blocker'] as const).map((role) => <div key={role}><b>{byRole(role)}</b><span>{role}</span></div>)}</div>
      <ul className="gaps">
        {gaps.map((gap, i) => <li key={i} className={gap.kind} onClick={() => gap.nodeId && onFocus(gap.nodeId)} style={{ cursor: gap.nodeId ? 'pointer' : 'default' }}><span className="pill">{gap.kind === 'critical' ? 'Crítico' : 'Aviso'}</span> {gap.text}</li>)}
        {gaps.length === 0 && <li className="ok">Sin gaps. Cuenta cubierta.</li>}
      </ul>
      <h3>Cómo se conecta con Devin</h3>
      <ul className="devin">
        <li><b>Guardar en repo</b> → PR que actualiza accounts/mapfre/stakeholders.yaml.</li>
        <li>Skill <b>power-map-review</b>: lee este YAML y propone el camino al EB.</li>
        <li>Desde una persona: <i>Generar cadencia</i> / <i>Brief</i> / <i>Buscar equipo</i> copian el prompt del playbook con su contexto y abren Devin.</li>
      </ul>
    </div>
  )
}

export default function PowerChartMapfre() {
  return <ReactFlowProvider><Chart /></ReactFlowProvider>
}
