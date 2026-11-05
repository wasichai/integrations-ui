import { coreModule, createLinks, createRegistry, type WasichaiModule } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { integrationWorkflowsModule } from './module'

// what @wasichai/integrations declares, without importing it: the group this module fills
const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

describe('integrationWorkflowsModule', () => {
  it('registers next to core and the integrations group without a conflict', () => {
    expect(() => createRegistry([coreModule, integrationsGroup, integrationWorkflowsModule()])).not.toThrow()
  })

  it('needs the integrations group: alone its nav has nowhere to go', () => {
    expect(() => createRegistry([coreModule, integrationWorkflowsModule()])).toThrow(/unknown nav group 'integrations'/)
  })

  it('mounts its routes under the default base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationWorkflowsModule()]))
    expect(links.to('integration-workflows:workflows')).toBe('/integrations/workflows')
    expect(links.to('integration-workflows:workflow', { workflowId: 'w1' })).toBe('/integrations/workflows/w1')
    expect(links.to('integration-workflows:designer', { workflowId: 'w1' })).toBe('/integrations/workflows/w1/design')
    expect(links.to('integration-workflows:version', { workflowId: 'w1', number: '2' })).toBe('/integrations/workflows/w1/versions/2')
    expect(links.to('integration-workflows:execution', { workflowId: 'w1', executionId: 'e1' })).toBe('/integrations/workflows/w1/executions/e1')
  })

  it('moves every route when the app picks another base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationWorkflowsModule({ basePath: 'x' })]))
    expect(links.to('integration-workflows:workflows')).toBe('/x/workflows')
    expect(links.to('integration-workflows:designer', { workflowId: 'w1' })).toBe('/x/workflows/w1/design')
  })

  it('puts workflows in the integrations group, after integrations and integration-sync', () => {
    const registry = createRegistry([coreModule, integrationsGroup, integrationWorkflowsModule()])
    const group = registry.navGroups.find((candidate) => candidate.id === 'integrations')
    expect(group?.items.map((item) => [item.labelKey, item.to, item.order])).toEqual([['integration-workflows:nav.workflows', '/integrations/workflows', 60]])
  })

  it('loads every page lazily: the designer and its canvas library stay out of the first bundle', () => {
    const module = integrationWorkflowsModule()
    expect(module.routes?.every((route) => typeof route.lazy === 'function')).toBe(true)
  })
})
