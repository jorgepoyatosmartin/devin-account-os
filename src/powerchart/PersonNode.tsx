import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { ATTITUDE_COLOR, FRESHNESS_COLOR, ROLE_COLOR, daysSince, freshness, type Stakeholder } from './model'

export type PersonNodeData = {
  person: Stakeholder
  childCount: number
  collapsed: boolean
  dimmed: boolean
  gap: 'critical' | 'warning' | null
  dropTarget: boolean
  onToggle: (id: string) => void
  managerStub?: string
  onManagerClick?: (id: string) => void
}
export type PersonNodeType = Node<PersonNodeData, 'person'>

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person: p, childCount, collapsed, dimmed, gap, dropTarget, managerStub } = data
  const f = freshness(p.lastTouch)
  const d = daysSince(p.lastTouch)
  const border = ATTITUDE_COLOR[p.attitude]
  const width = 2 + p.influence
  return (
    <div
      className={`person ${dimmed ? 'dimmed' : ''} ${selected ? 'selected' : ''} ${dropTarget ? 'drop' : ''} ${gap ? `gap-${gap}` : ''}`}
      style={{ borderColor: border, borderWidth: width, borderStyle: p.attitude === 'unknown' ? 'dashed' : 'solid' }}
    >
      <Handle type="target" position={Position.Top} className="handle" />
      <div className="row">
        <span className="badge" style={{ background: ROLE_COLOR[p.role], color: p.role === 'None' ? '#334155' : '#fff' }}>
          {p.role === 'None' ? '—' : p.role}
        </span>
        <span className="name">{p.name}</span>
        <span
          className="fresh"
          style={{ background: FRESHNESS_COLOR[f] }}
          title={d === null ? 'Sin contacto' : `Último touch hace ${d} días`}
        />
      </div>
      <div className="title">{p.title}</div>
      <div className="meta">
        <span>{p.level}</span>
        <span className="dot">·</span>
        <span>{p.businessUnit || p.unit}</span>
        {p.external && <span className="ext">research</span>}
      </div>
      {managerStub && p.reportsTo && (
        <button
          className="pc-manager-stub nodrag"
          onClick={(e) => {
            e.stopPropagation()
            data.onManagerClick?.(p.reportsTo!)
          }}
        >
          ↑ {managerStub}
        </button>
      )}
      {childCount > 0 && (
        <button
          className="toggle"
          onClick={(e) => {
            e.stopPropagation()
            data.onToggle(p.id)
          }}
          title={collapsed ? 'Expandir equipo' : 'Colapsar equipo'}
        >
          {collapsed ? `+${childCount}` : '−'}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} className="handle" />
    </div>
  )
}
