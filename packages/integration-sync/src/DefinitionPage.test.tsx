import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { WasichaiModule } from '@wasichai/core'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { DefinitionPage } from './DefinitionPage'
import { integrationSyncModule } from './module'
import type { SyncDefinition, SyncRun } from './types'

const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const definition = (overrides: Partial<SyncDefinition> = {}): SyncDefinition => ({
  id: 'd1',
  name: 'Contactos',
  a: { connectionId: 'c1', resource: 'contacts' },
  b: { connectionId: 'c2', resource: 'people' },
  direction: 'BIDIRECTIONAL',
  status: 'DRAFT',
  deletePolicy: 'FLAG',
  scheduleSeconds: null,
  reconcileSeconds: null,
  matchOn: null,
  mappings: [{ aField: 'email', bField: 'mail', transform: null, owner: 'BOTH', conflictStrategy: 'MANUAL' }],
  version: 1,
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
  ...overrides
})

const run: SyncRun = {
  id: 'r1',
  definitionId: 'd1',
  trigger: 'SCHEDULE',
  status: 'PARTIAL',
  read: 10,
  created: 2,
  updated: 3,
  skipped: 4,
  conflicts: 1,
  failed: 0,
  error: 'RateLimited: retry after 30s',
  queuedAt: '2026-11-04T10:00:00Z',
  startedAt: '2026-11-04T10:00:01Z',
  finishedAt: '2026-11-04T10:00:05Z'
}

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch([
    ...routes,
    { path: '/integrations/sync-definitions/d1/runs', body: [run] },
    { path: /^\/integrations\/conflicts\?status=OPEN/, body: [{ id: 'k1' }, { id: 'k2' }] },
    { path: '/integrations/connections', body: [{ id: 'c1', connectorId: 'hubspot', name: 'HubSpot', status: 'ACTIVE' }] }
  ])
  return renderWithProviders(<DefinitionPage />, {
    modules: [integrationsGroup, integrationSyncModule()],
    language: 'en',
    route: '/integrations/sync-definitions/d1',
    path: 'integrations/sync-definitions/:definitionId',
    permissions: options.admin === false ? { admin: false, objects: {}, capabilities: [] } : undefined
  })
}

describe('DefinitionPage', () => {
  it('shows the runs, the open conflicts and activates a draft', async () => {
    render([
      { path: '/integrations/sync-definitions/d1', body: definition() },
      { method: 'POST', path: '/integrations/sync-definitions/d1/activate', body: definition({ status: 'ACTIVE' }) }
    ])
    expect(await screen.findByRole('heading', { name: 'Contactos', level: 1 })).toBeInTheDocument()
    const row = (await screen.findByText('Partial')).closest('tr')!
    expect(within(row).getByText('RateLimited: retry after 30s')).toBeInTheDocument()
    expect(within(row).getByText(/10 read, 2 created, 3 updated/)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '2 open conflicts' })).toHaveAttribute('href', '/integrations/conflicts?definitionId=d1')
    expect(screen.getByText('HubSpot')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Activate' }))
    expect(await screen.findByText('Sync active')).toBeInTheDocument()
  })

  it('runs an active definition now', async () => {
    render([
      { path: '/integrations/sync-definitions/d1', body: definition({ status: 'ACTIVE' }) },
      { method: 'POST', path: '/integrations/sync-definitions/d1/run', status: 202, body: { runId: 'r2' } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    expect(await screen.findByText('Run queued')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.path === '/integrations/sync-definitions/d1/run')?.body).toEqual({ kind: 'INCREMENTAL' })
  })

  it('says why activation was refused', async () => {
    render([
      { path: '/integrations/sync-definitions/d1', body: definition() },
      {
        method: 'POST',
        path: '/integrations/sync-definitions/d1/activate',
        status: 422,
        body: {
          title: 'Unprocessable Content',
          detail: 'The sync definition does not validate',
          errors: [{ field: 'mappings[0].bField', message: "no field 'mail' in People" }]
        }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The sync definition does not validate — mappings[0].bField: no field 'mail' in People")
  })

  it('offers nothing to change to a member', async () => {
    render([{ path: '/integrations/sync-definitions/d1', body: definition({ status: 'ACTIVE' }) }], { admin: false })
    await screen.findByRole('heading', { name: 'Contactos', level: 1 })
    expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
