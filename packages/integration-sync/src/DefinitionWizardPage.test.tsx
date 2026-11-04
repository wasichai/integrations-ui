import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WasichaiModule } from '@wasichai/core'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'

vi.mock('@wasichai/ui', async (importOriginal) => (await import('./test/selectDouble')).selectDouble(importOriginal))

import { DefinitionWizardPage } from './DefinitionWizardPage'
import { integrationSyncModule } from './module'
import type { SyncDefinition } from './types'

const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const field = (name: string, overrides = {}) => ({
  name,
  label: name,
  type: 'TEXT',
  required: false,
  readOnly: false,
  externalId: false,
  options: [],
  ...overrides
})

const discovery: MockRoute[] = [
  {
    path: '/integrations/connections',
    body: [
      { id: 'c1', connectorId: 'hubspot', name: 'HubSpot', status: 'ACTIVE' },
      { id: 'c2', connectorId: 'notion', name: 'Notion', status: 'ACTIVE' }
    ]
  },
  { path: '/integrations/connections/c1/resources', body: [{ name: 'contacts', label: 'Contacts' }] },
  { path: '/integrations/connections/c2/resources', body: [{ name: 'people', label: 'People' }] },
  {
    path: '/integrations/connections/c1/resources/contacts/schema',
    body: { resource: 'contacts', label: 'Contacts', fields: [field('email'), field('stage')] }
  },
  {
    path: '/integrations/connections/c2/resources/people/schema',
    body: { resource: 'people', label: 'People', fields: [field('mail'), field('phone', { readOnly: true })] }
  }
]

const saved = (overrides: Partial<SyncDefinition> = {}): SyncDefinition => ({
  id: 'd1',
  name: 'Contactos',
  a: { connectionId: 'c1', resource: 'contacts' },
  b: { connectionId: 'c2', resource: 'people' },
  direction: 'A_TO_B',
  status: 'DRAFT',
  deletePolicy: 'FLAG',
  scheduleSeconds: null,
  reconcileSeconds: null,
  matchOn: null,
  mappings: [{ aField: 'email', bField: 'phone', transform: null, owner: 'A', conflictStrategy: 'MANUAL' }],
  version: 1,
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
  ...overrides
})

const render = (routes: MockRoute[]) => {
  mock = mockFetch([...routes, ...discovery])
  return renderWithProviders(<DefinitionWizardPage />, {
    modules: [integrationsGroup, integrationSyncModule()],
    language: 'en',
    route: '/integrations/sync-definitions/new',
    path: 'integrations/sync-definitions/new'
  })
}

const card = (title: string) => screen.getByRole('heading', { name: title }).closest('[data-slot="card"]') as HTMLElement

async function fillSides() {
  await userEvent.type(screen.getByLabelText('Name'), 'Contactos')
  const a = card('Side A')
  await within(a).findByRole('option', { name: 'HubSpot (hubspot)' })
  await userEvent.selectOptions(within(a).getByLabelText('Connection'), 'c1')
  await within(a).findByRole('option', { name: 'Contacts' })
  await userEvent.selectOptions(within(a).getByLabelText('Resource'), 'contacts')
  const b = card('Side B')
  await userEvent.selectOptions(within(b).getByLabelText('Connection'), 'c2')
  await within(b).findByRole('option', { name: 'People' })
  await userEvent.selectOptions(within(b).getByLabelText('Resource'), 'people')
  const row = screen.getByRole('listitem', { name: 'Field 1' })
  await within(row).findByRole('option', { name: 'email · TEXT' })
  await userEvent.selectOptions(within(row).getByLabelText('Field in A'), 'email')
  await within(row).findByRole('option', { name: 'phone · TEXT' })
  await userEvent.selectOptions(within(row).getByLabelText('Field in B'), 'phone')
  return row
}

describe('DefinitionWizardPage', () => {
  it('saves the draft, validates it and shows each violation next to its field', async () => {
    render([
      { method: 'POST', path: '/integrations/sync-definitions', status: 201, body: saved() },
      {
        method: 'POST',
        path: '/integrations/sync-definitions/d1/validate',
        body: { valid: false, errors: [{ field: 'mappings[0].bField', message: "'phone' is read-only" }] }
      }
    ])
    const row = await fillSides()
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))

    expect(await within(row).findByText("'phone' is read-only")).toBeInTheDocument()
    expect(screen.getByText('It does not validate against both systems')).toBeInTheDocument()
    const post = mock!.calls.find((call) => call.method === 'POST' && call.path === '/integrations/sync-definitions')
    expect(post?.body).toEqual({
      name: 'Contactos',
      a: { connectionId: 'c1', resource: 'contacts' },
      b: { connectionId: 'c2', resource: 'people' },
      direction: 'A_TO_B',
      deletePolicy: 'FLAG',
      scheduleSeconds: null,
      reconcileSeconds: null,
      matchOn: null,
      mappings: [{ aField: 'email', bField: 'phone', transform: null, owner: 'A', conflictStrategy: 'MANUAL' }]
    })
  })

  it('draws the structural refusal of a save on the fields it names, and replaces with If-Match afterwards', async () => {
    render([
      {
        method: 'POST',
        path: '/integrations/sync-definitions',
        status: 400,
        body: {
          title: 'Bad Request',
          detail: 'Invalid sync definition',
          errors: [
            { field: 'name', message: '1 to 200 characters' },
            { field: 'b.resource', message: 'required, at most 300 characters' }
          ]
        }
      }
    ])
    await screen.findByRole('heading', { name: 'Side A' })
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('1 to 200 characters')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(within(card('Side B')).getByText('required, at most 300 characters')).toBeInTheDocument()
    expect(screen.getByText('Invalid sync definition')).toBeInTheDocument()
  })

  it('sends an advanced transform with its parameters, then a replace with the version read', async () => {
    render([
      { method: 'POST', path: '/integrations/sync-definitions', status: 201, body: saved() },
      { method: 'PUT', path: '/integrations/sync-definitions/d1', body: saved({ version: 2 }) }
    ])
    const row = await fillSides()
    await userEvent.click(screen.getByLabelText('Advanced transforms'))
    await userEvent.selectOptions(within(row).getByLabelText('Transform'), 'enumMap')
    await userEvent.type(within(row).getByLabelText('Equivalences'), 'lead=new{enter}customer=won')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      mappings: [{ aField: 'email', bField: 'phone', transform: { type: 'enumMap', map: { lead: 'new', customer: 'won' } } }]
    })

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await vi.waitFor(() => expect(mock!.calls.some((call) => call.method === 'PUT')).toBe(true))
    expect(mock!.calls.find((call) => call.method === 'PUT')?.headers['if-match']).toBe('"1"')
  })
})
