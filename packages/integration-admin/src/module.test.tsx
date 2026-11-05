import { coreModule, createLinks, createRegistry } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { integrationAdminModule } from './module'
import { integrationsGroup } from './test/fixtures'

describe('integrationAdminModule', () => {
  it('registers next to core and the integrations group without a conflict', () => {
    expect(() => createRegistry([coreModule, integrationsGroup, integrationAdminModule()])).not.toThrow()
  })

  it('needs the integrations group: alone its nav has nowhere to go', () => {
    expect(() => createRegistry([coreModule, integrationAdminModule()])).toThrow(/unknown nav group 'integrations'/)
  })

  it('mounts its routes under the default base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationAdminModule()]))
    expect(links.to('integration-admin:connectors')).toBe('/integrations/admin/connectors')
    expect(links.to('integration-admin:usage')).toBe('/integrations/admin/usage')
    expect(links.to('integration-admin:system')).toBe('/integrations/admin/system')
    expect(links.to('integration-admin:retention')).toBe('/integrations/admin/retention')
  })

  it('moves every route when the app picks another base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationAdminModule({ basePath: 'x' })]))
    expect(links.to('integration-admin:usage')).toBe('/x/admin/usage')
    expect(links.to('integration-admin:system')).toBe('/x/admin/system')
  })

  it('puts its entries in the integrations group after the ai ones, for every member', () => {
    const module = integrationAdminModule()
    expect(module.nav?.map((item) => [item.labelKey, item.group, item.order, item.visible])).toEqual([
      ['integration-admin:nav.connectors', 'integrations', 90, undefined],
      ['integration-admin:nav.usage', 'integrations', 92, undefined],
      ['integration-admin:nav.system', 'integrations', 94, undefined],
      ['integration-admin:nav.retention', 'integrations', 96, undefined]
    ])
  })

  it('loads every page lazily', () => {
    expect(integrationAdminModule().routes?.every((route) => typeof route.lazy === 'function')).toBe(true)
  })
})
