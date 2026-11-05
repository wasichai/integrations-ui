/// <reference types="vite/client" />
// ts 7 checks side-effect imports; vite/client declares *.css
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react'
import type { Connection, Edge, Node, NodeChange, NodeProps } from '@xyflow/react'
import { cn } from '@wasichai/ui'
import { EDGE_FIELDS, edgesOf, stepsOf, TRIGGER_NODE, type EdgeField, type XY } from './graph'
import type { WorkflowGraph } from './types'
import '@xyflow/react/dist/style.css'

interface Props {
  graph: WorkflowGraph
  positions: Record<string, XY>
  selected: string | null
  // node id -> how many violations sit on it
  problems: Record<string, number>
  onSelect: (id: string) => void
  onMove: (id: string, at: XY) => void
  // handle is the edge field the drag started from: next, then, else, rejected, join, onError, branches
  onConnect: (source: string, handle: string, target: string) => void
}

interface NodeData extends Record<string, unknown> {
  label: string
  kind: string
  fields: EdgeField[]
  trigger: boolean
  problems: number
}

// failure and rejection edges read apart from the happy path without colour alone: dashed and labelled
const DASHED: EdgeField[] = ['onError', 'rejected', 'join']

// the canvas owns nothing: it draws the graph it is handed and reports what the pointer did
export function WorkflowCanvas({ graph, positions, selected, problems, onSelect, onMove, onConnect }: Props) {
  const { t } = useTranslation('integration-workflows')
  const refit = useRef<(() => void) | null>(null)

  const nodes = useMemo<Node<NodeData>[]>(
    () => [
      {
        id: TRIGGER_NODE,
        type: 'step',
        position: positions[TRIGGER_NODE] ?? { x: 0, y: 0 },
        data: {
          label: t('designer.trigger'),
          kind: graph.trigger?.type ? t(`triggerType.${graph.trigger.type}`) : '—',
          fields: ['next'],
          trigger: true,
          problems: problems[TRIGGER_NODE] ?? 0
        }
      },
      ...stepsOf(graph).map((step) => ({
        id: step.id,
        type: 'step',
        position: positions[step.id] ?? { x: 0, y: 0 },
        data: { label: step.id, kind: t(`stepType.${step.type}`), fields: EDGE_FIELDS[step.type] ?? [], trigger: false, problems: problems[step.id] ?? 0 }
      }))
    ],
    [graph, positions, problems, t]
  )

  const edges = useMemo<Edge[]>(
    () =>
      edgesOf(graph).map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.field,
        target: edge.target,
        label: edge.field === 'next' ? undefined : t(`edge.${edge.field}`),
        markerEnd: { type: MarkerType.ArrowClosed },
        style: DASHED.includes(edge.field) ? { strokeDasharray: '6 4' } : undefined
      })),
    [graph, t]
  )

  // a new step lands off screen as often as not: widen the view when the count changes
  useEffect(() => {
    refit.current?.()
  }, [nodes.length])

  const handleNodesChange = (changes: NodeChange[]) =>
    changes.forEach((change) => {
      // dragging fires a stream; only the final position is worth keeping
      if (change.type === 'position' && change.position && change.dragging === false) onMove(change.id, change.position)
    })

  return (
    <ReactFlow
      nodes={nodes.map((node) => ({ ...node, selected: node.id === selected }))}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onInit={(instance) => {
        refit.current = () => void instance.fitView({ duration: 200 })
      }}
      onNodesChange={handleNodesChange}
      onNodeClick={(_event, node) => onSelect(node.id)}
      onEdgeClick={(_event, edge) => onSelect(edge.source)}
      onConnect={(connection: Connection) => {
        if (connection.source && connection.target && connection.sourceHandle) onConnect(connection.source, connection.sourceHandle, connection.target)
      }}
      // removing is the panel's job: a stray Delete key must not drop a step
      deleteKeyCode={null}
      fitView
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

// a step box: id, type, a problem count, a target handle on the left and one source handle per edge it may have
function StepNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const { t } = useTranslation('integration-workflows')
  return (
    <div
      className={cn(
        'min-w-44 rounded-card border bg-surface px-4 py-2.5 shadow-sm',
        selected ? 'border-brand ring-2 ring-brand/40' : data.problems > 0 ? 'border-danger' : 'border-border'
      )}
    >
      {data.trigger ? null : <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-none !bg-ink-muted" />}
      <p className="text-sm font-medium text-ink">{data.label}</p>
      <p className="text-xs text-ink-muted">{data.kind}</p>
      {data.problems > 0 ? <p className="text-xs text-danger">{t('designer.problems', { count: data.problems })}</p> : null}
      {data.fields.map((field, index) => (
        <Handle
          key={field}
          id={field}
          type="source"
          position={field === 'onError' ? Position.Bottom : Position.Right}
          title={t(`edge.${field}`)}
          style={field === 'onError' ? undefined : { top: `${((index + 1) * 100) / (data.fields.filter((f) => f !== 'onError').length + 1)}%` }}
          className={cn('!h-2.5 !w-2.5 !border-none', field === 'onError' || field === 'rejected' ? '!bg-danger' : '!bg-ink-muted')}
        />
      ))}
    </div>
  )
}

// react flow reads this by identity: never rebuilt on render
const NODE_TYPES = { step: StepNode }
