// the draft graph as the designer edits it: pure functions, no react. every edit returns a new graph and
// keeps the keys it does not know, so a draft round-trips what the server stored
import type { Condition, ConditionOp, LeafOp, Operand, Step, StepType, Trigger, TriggerType, Violation, WorkflowGraph, WriteOperation } from './types'

export const TRIGGER_TYPES: TriggerType[] = ['manual', 'event', 'webhook', 'schedule']
export const STEP_TYPES: StepType[] = ['action', 'condition', 'branch', 'parallel', 'delay', 'approval', 'end']
export const WRITE_OPERATIONS: WriteOperation[] = ['create', 'update', 'upsert', 'delete']
export const LEAF_OPS: LeafOp[] = ['equals', 'notEquals', 'exists', 'in', 'gt', 'lt']
export const CONDITION_OPS: ConditionOp[] = [...LEAF_OPS, 'and', 'or', 'not']

// the trigger's node. step ids start with a letter, so this one can never clash
export const TRIGGER_NODE = '@trigger'
export const STEP_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

// the outgoing edges each type may have, in the order the panel shows them. 'branches' is a list
export type EdgeField = 'next' | 'then' | 'else' | 'rejected' | 'join' | 'onError' | 'branches'

export const EDGE_FIELDS: Record<StepType, EdgeField[]> = {
  action: ['next', 'onError'],
  condition: ['next', 'onError'],
  branch: ['then', 'else', 'onError'],
  parallel: ['branches', 'join', 'onError'],
  delay: ['next', 'onError'],
  approval: ['next', 'rejected', 'onError'],
  end: []
}

export interface GraphEdge {
  // `${source}:${field}`, branches indexed: 'fan:branches[1]'
  id: string
  source: string
  target: string
  field: EdgeField
}

export const stepsOf = (graph: WorkflowGraph): Step[] => (Array.isArray(graph.steps) ? graph.steps : [])

export function edgesOf(graph: WorkflowGraph): GraphEdge[] {
  const edges: GraphEdge[] = []
  if (graph.trigger?.next) edges.push({ id: `${TRIGGER_NODE}:next`, source: TRIGGER_NODE, target: graph.trigger.next, field: 'next' })
  for (const step of stepsOf(graph)) {
    for (const field of EDGE_FIELDS[step.type] ?? []) {
      if (field === 'branches') {
        const branches = step.branches ?? []
        branches.forEach((target, index) => edges.push({ id: `${step.id}:branches[${index}]`, source: step.id, target, field }))
      } else {
        const target = step[field]
        if (typeof target === 'string' && target) edges.push({ id: `${step.id}:${field}`, source: step.id, target, field })
      }
    }
  }
  return edges
}

// a free id for a new step: action1, action2, ...
export function freeId(graph: WorkflowGraph, type: StepType): string {
  const taken = new Set(stepsOf(graph).map((step) => step.id))
  let n = 1
  while (taken.has(`${type}${n}`)) n++
  return `${type}${n}`
}

export function blankStep(type: StepType, id: string): Step {
  switch (type) {
    case 'action':
      return { id, type, connectionId: '', action: '', input: {} }
    case 'condition':
    case 'branch':
      return { id, type, condition: { op: 'exists', ref: 'trigger.payload' } }
    case 'parallel':
      return { id, type, branches: [] }
    case 'delay':
      return { id, type, duration: 'PT5M' }
    case 'approval':
      return { id, type, title: '' }
    case 'end':
      return { id, type }
  }
}

// the first step also becomes where the trigger goes, so a new workflow is connected from the start
export function addStep(graph: WorkflowGraph, step: Step): WorkflowGraph {
  const steps = [...stepsOf(graph), step]
  const trigger = graph.trigger && !graph.trigger.next ? { ...graph.trigger, next: step.id } : graph.trigger
  return { ...graph, trigger, steps }
}

export function updateStep(graph: WorkflowGraph, id: string, patch: Partial<Step>): WorkflowGraph {
  return { ...graph, steps: stepsOf(graph).map((step) => (step.id === id ? dropEmpty({ ...step, ...patch }) : step)) }
}

export function updateTrigger(graph: WorkflowGraph, patch: Partial<Trigger>): WorkflowGraph {
  return { ...graph, trigger: dropEmpty({ ...(graph.trigger ?? {}), ...patch }) }
}

// a new trigger type keeps only where it goes: the other keys belong to the old type
export function setTriggerType(graph: WorkflowGraph, type: TriggerType): WorkflowGraph {
  return { ...graph, trigger: dropEmpty({ type, next: graph.trigger?.next }) }
}

// every edge into the removed step goes too: no edge names a step that is not there
export function removeStep(graph: WorkflowGraph, id: string): WorkflowGraph {
  const trigger = graph.trigger?.next === id ? dropEmpty({ ...graph.trigger, next: undefined }) : graph.trigger
  const steps = stepsOf(graph)
    .filter((step) => step.id !== id)
    .map((step) => retarget(step, id, undefined))
  return { ...graph, trigger, steps }
}

// edges follow a renamed step. refs to its output (steps.<id>...) are left to validate: they are text
export function renameStep(graph: WorkflowGraph, from: string, to: string): WorkflowGraph {
  const trigger = graph.trigger?.next === from ? { ...graph.trigger, next: to } : graph.trigger
  const steps = stepsOf(graph).map((step) => retarget(step.id === from ? { ...step, id: to } : step, from, to))
  return { ...graph, trigger, steps }
}

function retarget(step: Step, from: string, to: string | undefined): Step {
  const next: Step = { ...step }
  for (const field of ['next', 'then', 'else', 'rejected', 'join', 'onError'] as const) if (next[field] === from) next[field] = to
  if (next.branches) next.branches = to ? next.branches.map((b) => (b === from ? to : b)) : next.branches.filter((b) => b !== from)
  return dropEmpty(next)
}

// one edge set (target) or cleared (null). 'branches' appends; 'branches[i]' replaces or removes one
export function setEdge(graph: WorkflowGraph, source: string, field: string, target: string | null): WorkflowGraph {
  if (source === TRIGGER_NODE) return updateTrigger(graph, { next: target ?? undefined })
  const step = stepsOf(graph).find((candidate) => candidate.id === source)
  if (!step) return graph
  const indexed = /^branches\[(\d+)\]$/.exec(field)
  if (field === 'branches' || indexed) {
    const branches = [...(step.branches ?? [])]
    if (!indexed) {
      if (target && !branches.includes(target)) branches.push(target)
    } else if (target) branches[Number(indexed[1])] = target
    else branches.splice(Number(indexed[1]), 1)
    return updateStep(graph, source, { branches })
  }
  return updateStep(graph, source, { [field]: target ?? undefined })
}

// absent, not "": a cleared field is not sent
function dropEmpty<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== '')) as T
}

export interface XY {
  x: number
  y: number
}

const COLUMN = 260
const ROW = 120

// columns by distance from the trigger, rows in graph order. steps the trigger cannot reach go last
export function layout(graph: WorkflowGraph): Record<string, XY> {
  const depth = new Map<string, number>([[TRIGGER_NODE, 0]])
  const edges = edgesOf(graph)
  const queue = [TRIGGER_NODE]
  while (queue.length > 0) {
    const node = queue.shift()!
    for (const edge of edges.filter((candidate) => candidate.source === node)) {
      // longest path: a join sits right of every branch. cycles stop at the step count
      const d = depth.get(node)! + 1
      if (d > stepsOf(graph).length + 1) continue
      if ((depth.get(edge.target) ?? -1) < d) {
        depth.set(edge.target, d)
        queue.push(edge.target)
      }
    }
  }
  const last = Math.max(0, ...depth.values()) + 1
  const rows = new Map<number, number>()
  const place = (column: number): XY => {
    const row = rows.get(column) ?? 0
    rows.set(column, row + 1)
    return { x: column * COLUMN, y: row * ROW }
  }
  const positions: Record<string, XY> = { [TRIGGER_NODE]: place(0) }
  for (const step of stepsOf(graph)) positions[step.id] = place(depth.get(step.id) ?? last)
  return positions
}

// the server's violations, by node: graph.steps[2].input.email -> steps' id 2, field 'input.email'.
// placed by id when they arrive, so they stay on their node while the draft moves on
export interface PlacedViolations {
  nodes: Record<string, Violation[]>
  rest: Violation[]
}

const STEP_PATH = /^graph\.steps\[(\d+)\](?:\.(.+))?$/
const TRIGGER_PATH = /^graph\.trigger(?:\.(.+))?$/

export function placeViolations(violations: Violation[], graph: WorkflowGraph): PlacedViolations {
  const placed: PlacedViolations = { nodes: {}, rest: [] }
  const steps = stepsOf(graph)
  for (const violation of violations) {
    const step = STEP_PATH.exec(violation.field)
    const trigger = TRIGGER_PATH.exec(violation.field)
    const node = step ? steps[Number(step[1])]?.id : trigger ? TRIGGER_NODE : undefined
    if (node) (placed.nodes[node] ??= []).push({ field: (step ? step[2] : trigger?.[1]) ?? '', message: violation.message })
    else placed.rest.push(violation)
  }
  return placed
}

// the messages under one field: 'input' gets 'input.email' too, 'branches' gets 'branches[1]'
export function messagesAt(violations: Violation[] | undefined, field: string): string | undefined {
  const found = (violations ?? []).filter(
    (violation) => violation.field === field || violation.field.startsWith(`${field}.`) || violation.field.startsWith(`${field}[`)
  )
  return found.length > 0 ? found.map((violation) => violation.message).join('; ') : undefined
}

// an operand as two inputs: a reference, or a literal written as json (plain text is a string)
export type OperandKind = 'ref' | 'value'

export function operandKind(operand: Operand | undefined): OperandKind {
  return operand && 'value' in operand ? 'value' : 'ref'
}

export function operandText(operand: Operand | undefined): string {
  if (!operand) return ''
  if ('ref' in operand) return operand.ref
  return literalText(operand.value)
}

export function operandOf(kind: OperandKind, text: string): Operand {
  return kind === 'ref' ? { ref: text.trim() } : { value: literalOf(text) }
}

export function literalText(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value)
}

export function literalOf(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// a leaf keeps its ref when the op changes; a group starts empty
export function conditionWithOp(condition: Condition | undefined, op: ConditionOp): Condition {
  if (op === 'and' || op === 'or') return { op, conditions: condition?.conditions ?? [] }
  if (op === 'not') return { op, condition: condition?.condition ?? { op: 'exists', ref: '' } }
  const ref = condition?.ref ?? ''
  if (op === 'exists') return { op, ref }
  if (op === 'in') return { op, ref, values: condition?.values ?? [] }
  return { op, ref, value: condition?.value ?? '' }
}
