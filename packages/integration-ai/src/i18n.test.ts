import { describe, expect, it } from 'vitest'
import { integrationAiMessages } from './i18n'
import { ERROR_KINDS, EXECUTION_STATUSES, OPERATIONS } from './schema'

function leaves(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
    .sort()
}

describe('integration-ai messages', () => {
  it('has the same keys in spanish and english', () => {
    expect(leaves(integrationAiMessages.en)).toEqual(leaves(integrationAiMessages.es))
  })

  it('names its nav entries, every kind, operation, status and error kind, and every decision outcome', () => {
    expect(leaves(integrationAiMessages.es)).toEqual(
      expect.arrayContaining([
        'nav.tools',
        'nav.approvals',
        'nav.executions',
        'nav.mcp',
        'kind.ACTION',
        'kind.RESOURCE',
        ...OPERATIONS.map((op) => `operation.${op}`),
        ...EXECUTION_STATUSES.map((status) => `executionStatus.${status}`),
        ...EXECUTION_STATUSES.map((status) => `decision.done.${status}`),
        ...EXECUTION_STATUSES.map((status) => `try.result.${status}`),
        ...ERROR_KINDS.map((kind) => `errorKind.${kind}`)
      ])
    )
  })
})
