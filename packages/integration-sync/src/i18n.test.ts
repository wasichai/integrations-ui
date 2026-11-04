import { describe, expect, it } from 'vitest'
import { integrationSyncMessages } from './i18n'
import { TRANSFORM_TYPES } from './draft'

function leaves(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
    .sort()
}

describe('integration-sync messages', () => {
  it('has the same keys in spanish and english', () => {
    expect(leaves(integrationSyncMessages.en)).toEqual(leaves(integrationSyncMessages.es))
  })

  it('names its nav entries and every transform', () => {
    expect(leaves(integrationSyncMessages.es)).toEqual(
      expect.arrayContaining(['nav.definitions', 'nav.conflicts', ...TRANSFORM_TYPES.map((type) => `transform.types.${type}`)])
    )
  })
})
