import { describe, expect, it } from 'vitest'
import { integrationWorkflowsMessages } from './i18n'
import { CONDITION_OPS, EDGE_FIELDS, STEP_TYPES, TRIGGER_TYPES, WRITE_OPERATIONS } from './graph'

function leaves(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
    .sort()
}

describe('integration-workflows messages', () => {
  it('has the same keys in spanish and english', () => {
    expect(leaves(integrationWorkflowsMessages.en)).toEqual(leaves(integrationWorkflowsMessages.es))
  })

  it('names its nav entry, every trigger, step, edge, operation and operator', () => {
    const fields = [...new Set(Object.values(EDGE_FIELDS).flat())]
    expect(leaves(integrationWorkflowsMessages.es)).toEqual(
      expect.arrayContaining([
        'nav.workflows',
        ...TRIGGER_TYPES.map((type) => `triggerType.${type}`),
        ...STEP_TYPES.map((type) => `stepType.${type}`),
        ...fields.map((field) => `edge.${field}`),
        ...WRITE_OPERATIONS.map((op) => `operation.${op}`),
        ...CONDITION_OPS.map((op) => `op.${op}`)
      ])
    )
  })
})
