import type { Node, NodeProps } from '@xyflow/react'

export type LaneNodeData = { label: string }
export type LaneNodeType = Node<LaneNodeData, 'lane'>

export function LaneNode({ data }: NodeProps<LaneNodeType>) {
  return <div className="pc-lane-label">{data.label}</div>
}
