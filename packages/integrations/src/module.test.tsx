import { coreModule, createLinks, createRegistry } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { integrationsModule } from './module'

describe('integrationsModule', () => {
  it('registers next to core without a conflict', () => {
    expect(() => createRegistry([coreModule, integrationsModule()])).not.toThrow()
  })

  it('mounts its routes under the default base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsModule()]))
    expect(links.to('integrations:catalog')).toBe('/integrations/connectors')
    expect(links.to('integrations:connector', { connectorId: 'hubspot' })).toBe('/integrations/connectors/hubspot')
    expect(links.to('integrations:connections')).toBe('/integrations/connections')
    expect(links.to('integrations:connection', { connectionId: 'c1' })).toBe('/integrations/connections/c1')
    expect(links.to('integrations:health')).toBe('/integrations/health')
  })

  it('moves every route when the app picks another base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsModule({ basePath: 'x' })]))
    expect(links.to('integrations:catalog')).toBe('/x/connectors')
    expect(links.to('integrations:connection', { connectionId: 'c1' })).toBe('/x/connections/c1')
  })

  it('declares its own nav group between automation and administration', () => {
    const registry = createRegistry([coreModule, integrationsModule()])
    expect(registry.navGroups.map((group) => group.id)).toEqual(['data', 'builder', 'automation', 'integrations', 'administration'])
    const group = registry.navGroups.find((candidate) => candidate.id === 'integrations')
    expect(group?.labelKey).toBe('integrations:nav.group')
    expect(group?.items.map((item) => [item.labelKey, item.to, item.order])).toEqual([
      ['integrations:nav.catalog', '/integrations/connectors', 10],
      ['integrations:nav.connections', '/integrations/connections', 20],
      ['integrations:nav.health', '/integrations/health', 30]
    ])
  })
})
