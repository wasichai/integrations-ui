import { describe, expect, it } from 'vitest'
import {
  addStep,
  blankStep,
  edgesOf,
  freeId,
  layout,
  messagesAt,
  operandOf,
  operandText,
  placeViolations,
  removeStep,
  renameStep,
  setEdge,
  setTriggerType,
  TRIGGER_NODE
} from './graph'
import type { WorkflowGraph } from './types'

// the api.md example, trimmed
const graph = (): WorkflowGraph => ({
  trigger: { type: 'event', connectionId: 'c1', eventType: 'message.created', next: 'check' },
  steps: [
    { id: 'check', type: 'branch', condition: { op: 'exists', ref: 'trigger.payload.email' }, then: 'fan', else: 'done' },
    { id: 'fan', type: 'parallel', branches: ['a', 'b'], join: 'done', onError: 'done' },
    { id: 'a', type: 'action', connectionId: 'c1', action: 'send', input: { text: { ref: 'trigger.payload.id' } }, next: 'done' },
    { id: 'b', type: 'approval', title: 'Ok?', next: 'done', rejected: 'done' },
    { id: 'done', type: 'end' }
  ]
})

describe('graph', () => {
  it('lists every edge with its field, branches indexed', () => {
    expect(edgesOf(graph()).map((edge) => edge.id)).toEqual([
      `${TRIGGER_NODE}:next`,
      'check:then',
      'check:else',
      'fan:branches[0]',
      'fan:branches[1]',
      'fan:join',
      'fan:onError',
      'a:next',
      'b:next',
      'b:rejected'
    ])
  })

  it('removes a step with every edge into it', () => {
    const next = removeStep(graph(), 'done')
    expect(next.steps?.map((step) => step.id)).toEqual(['check', 'fan', 'a', 'b'])
    expect(next.steps?.[0]).not.toHaveProperty('else')
    expect(next.steps?.[1]).toEqual({ id: 'fan', type: 'parallel', branches: ['a', 'b'] })
    expect(removeStep(graph(), 'a').steps?.[1].branches).toEqual(['b'])
    expect(removeStep(graph(), 'check').trigger).not.toHaveProperty('next')
  })

  it('renames a step and the edges that name it', () => {
    const next = renameStep(graph(), 'done', 'finish')
    expect(next.steps?.map((step) => step.id)).toContain('finish')
    expect(edgesOf(next).filter((edge) => edge.target === 'finish')).toHaveLength(6)
  })

  it('sets, appends and clears edges', () => {
    expect(setEdge(graph(), TRIGGER_NODE, 'next', 'a').trigger?.next).toBe('a')
    expect(setEdge(graph(), 'fan', 'branches', 'done').steps?.[1].branches).toEqual(['a', 'b', 'done'])
    expect(setEdge(graph(), 'fan', 'branches[0]', null).steps?.[1].branches).toEqual(['b'])
    expect(setEdge(graph(), 'b', 'rejected', null).steps?.[3]).not.toHaveProperty('rejected')
  })

  it('adds a step under a free id and wires the trigger to the first one', () => {
    const empty: WorkflowGraph = { trigger: { type: 'manual' } }
    const next = addStep(empty, blankStep('delay', freeId(empty, 'delay')))
    expect(next).toEqual({ trigger: { type: 'manual', next: 'delay1' }, steps: [{ id: 'delay1', type: 'delay', duration: 'PT5M' }] })
    expect(freeId(next, 'delay')).toBe('delay2')
  })

  it('keeps only where the trigger goes when its type changes', () => {
    expect(setTriggerType(graph(), 'schedule').trigger).toEqual({ type: 'schedule', next: 'check' })
  })

  it('lays the graph out by distance from the trigger, joins right of their branches', () => {
    const at = layout(graph())
    expect(at[TRIGGER_NODE].x).toBe(0)
    expect(at.check.x).toBeLessThan(at.fan.x)
    expect(at.a.x).toBe(at.b.x)
    expect(at.done.x).toBeGreaterThan(at.a.x)
  })

  it('survives a cycle and a half-built draft', () => {
    const cyclic: WorkflowGraph = {
      trigger: { type: 'manual', next: 'x' },
      steps: [
        { id: 'x', type: 'delay', next: 'y' },
        { id: 'y', type: 'delay', next: 'x' }
      ]
    }
    expect(Object.keys(layout(cyclic))).toEqual([TRIGGER_NODE, 'x', 'y'])
    expect(edgesOf({})).toEqual([])
  })

  it('places violations on the node they name, by id', () => {
    const placed = placeViolations(
      [
        { field: 'graph.steps[2].input.text.ref', message: 'unknown step' },
        { field: 'graph.trigger.eventType', message: 'not declared' },
        { field: 'graph.steps', message: 'at least one step' },
        { field: 'name', message: 'required' }
      ],
      graph()
    )
    expect(placed.nodes).toEqual({
      a: [{ field: 'input.text.ref', message: 'unknown step' }],
      [TRIGGER_NODE]: [{ field: 'eventType', message: 'not declared' }]
    })
    expect(placed.rest.map((violation) => violation.field)).toEqual(['graph.steps', 'name'])
    expect(messagesAt(placed.nodes.a, 'input')).toBe('unknown step')
    expect(messagesAt(placed.nodes.a, 'action')).toBeUndefined()
  })

  it('reads an operand as text and back: json literals, plain text a string', () => {
    expect(operandOf('value', '42')).toEqual({ value: 42 })
    expect(operandOf('value', 'gold')).toEqual({ value: 'gold' })
    expect(operandOf('ref', ' trigger.payload.id ')).toEqual({ ref: 'trigger.payload.id' })
    expect(operandText({ value: { a: 1 } })).toBe('{"a":1}')
  })
})
