import { coreModule, createLinks, createRegistry, type WasichaiModule } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { integrationSyncModule } from './module'

// what @wasichai/integrations declares, without importing it: the group this module fills
const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

describe('integrationSyncModule', () => {
  it('registers next to core and the integrations group without a conflict', () => {
    expect(() => createRegistry([coreModule, integrationsGroup, integrationSyncModule()])).not.toThrow()
  })

  it('needs the integrations group: alone its nav has nowhere to go', () => {
    expect(() => createRegistry([coreModule, integrationSyncModule()])).toThrow(/unknown nav group 'integrations'/)
  })

  it('mounts its routes under the default base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationSyncModule()]))
    expect(links.to('integration-sync:definitions')).toBe('/integrations/sync-definitions')
    expect(links.to('integration-sync:newDefinition')).toBe('/integrations/sync-definitions/new')
    expect(links.to('integration-sync:definition', { definitionId: 'd1' })).toBe('/integrations/sync-definitions/d1')
    expect(links.to('integration-sync:editDefinition', { definitionId: 'd1' })).toBe('/integrations/sync-definitions/d1/edit')
    expect(links.to('integration-sync:conflicts')).toBe('/integrations/conflicts')
  })

  it('moves every route when the app picks another base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationSyncModule({ basePath: 'x' })]))
    expect(links.to('integration-sync:definitions')).toBe('/x/sync-definitions')
    expect(links.to('integration-sync:conflicts')).toBe('/x/conflicts')
  })

  it('puts definitions and conflicts in the integrations group, after its own entries', () => {
    const registry = createRegistry([coreModule, integrationsGroup, integrationSyncModule()])
    const group = registry.navGroups.find((candidate) => candidate.id === 'integrations')
    expect(group?.items.map((item) => [item.labelKey, item.to, item.order])).toEqual([
      ['integration-sync:nav.definitions', '/integrations/sync-definitions', 40],
      ['integration-sync:nav.conflicts', '/integrations/conflicts', 50]
    ])
  })
})
