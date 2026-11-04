import { describe, expect, it } from 'vitest'
import { integrationsMessages } from './i18n'
import { OAUTH_ERRORS } from './ConnectionsPage'

function leaves(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
    )
    .sort()
}

describe('integrations messages', () => {
  it('has the same keys in spanish and english', () => {
    expect(leaves(integrationsMessages.en)).toEqual(leaves(integrationsMessages.es))
  })

  it('names its nav group and entries', () => {
    expect(leaves(integrationsMessages.es)).toEqual(expect.arrayContaining(['nav.group', 'nav.catalog', 'nav.connections', 'nav.health']))
  })

  it('explains every code the oauth callback sends back', () => {
    expect(leaves(integrationsMessages.es)).toEqual(expect.arrayContaining([...OAUTH_ERRORS.map((code) => `oauth.errors.${code}`), 'oauth.errors.unknown']))
  })
})
