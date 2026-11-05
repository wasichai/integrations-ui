import { coreModule, createLinks, createRegistry } from '@wasichai/core'
import { describe, expect, it } from 'vitest'
import { integrationAiModule } from './module'
import { integrationsGroup, member } from './test/fixtures'

describe('integrationAiModule', () => {
  it('registers next to core and the integrations group without a conflict', () => {
    expect(() => createRegistry([coreModule, integrationsGroup, integrationAiModule()])).not.toThrow()
  })

  it('needs the integrations group: alone its nav has nowhere to go', () => {
    expect(() => createRegistry([coreModule, integrationAiModule()])).toThrow(/unknown nav group 'integrations'/)
  })

  it('mounts its routes under the default base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationAiModule()]))
    expect(links.to('integration-ai:tools')).toBe('/integrations/ai/tools')
    expect(links.to('integration-ai:newTool')).toBe('/integrations/ai/new-tool')
    expect(links.to('integration-ai:tool', { toolName: 'find_contact' })).toBe('/integrations/ai/tools/find_contact')
    expect(links.to('integration-ai:editTool', { toolName: 'find_contact' })).toBe('/integrations/ai/tools/find_contact/edit')
    expect(links.to('integration-ai:approvals')).toBe('/integrations/ai/approvals')
    expect(links.to('integration-ai:executions')).toBe('/integrations/ai/executions')
    expect(links.to('integration-ai:execution', { executionId: 'x1' })).toBe('/integrations/ai/executions/x1')
    expect(links.to('integration-ai:mcp')).toBe('/integrations/ai/mcp')
  })

  it('moves every route when the app picks another base path', () => {
    const links = createLinks(createRegistry([coreModule, integrationsGroup, integrationAiModule({ basePath: 'x' })]))
    expect(links.to('integration-ai:tools')).toBe('/x/ai/tools')
    expect(links.to('integration-ai:mcp')).toBe('/x/ai/mcp')
  })

  it('puts its entries in the integrations group after the workflows; approvals only for who may decide', () => {
    const module = integrationAiModule()
    expect(module.nav?.map((item) => [item.labelKey, item.group, item.order])).toEqual([
      ['integration-ai:nav.tools', 'integrations', 70],
      ['integration-ai:nav.approvals', 'integrations', 75],
      ['integration-ai:nav.executions', 'integrations', 80],
      ['integration-ai:nav.mcp', 'integrations', 85]
    ])
    const approvals = module.nav?.find((item) => item.route === 'approvals')
    expect(approvals?.visible?.({ admin: true, objects: {} })).toBe(true)
    expect(approvals?.visible?.({ ...member, capabilities: ['MANAGE_ORGANIZATION'] })).toBe(true)
    expect(approvals?.visible?.(member)).toBe(false)
    expect(approvals?.visible?.(null)).toBe(false)
  })

  it('loads every page lazily', () => {
    expect(integrationAiModule().routes?.every((route) => typeof route.lazy === 'function')).toBe(true)
  })
})
