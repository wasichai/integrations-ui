import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { WasichaiModule } from '@wasichai/core'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ConflictsPage, resolutionOf, violationOf } from './ConflictsPage'
import { integrationSyncModule } from './module'
import type { Conflict, ConflictField } from './types'

const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const fields: ConflictField[] = [
  { key: 'email->mail', aField: 'email', bField: 'mail', a: { t: 'text', v: 'ana@a.com' }, b: { t: 'text', v: 'ana@b.com' } },
  { key: 'stage->status', aField: 'stage', bField: 'status', a: { t: 'choice', v: 'lead' }, b: { t: 'choice', v: 'won' } }
]

const conflict: Conflict = {
  id: 'k1',
  definitionId: 'd1',
  linkId: 'l1',
  kind: 'FIELDS',
  fields,
  status: 'OPEN',
  resolution: null,
  detectedAt: '2026-11-04T10:00:00Z',
  resolvedAt: null
}

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch([...routes, { path: '/integrations/sync-definitions', body: [{ id: 'd1', name: 'Contactos' }] }])
  return renderWithProviders(<ConflictsPage />, {
    modules: [integrationsGroup, integrationSyncModule()],
    language: 'en',
    permissions: options.admin === false ? { admin: false, objects: {}, capabilities: [] } : undefined
  })
}

describe('resolutionOf', () => {
  it('sends a side when every field takes it, otherwise picks in fields and typed values in values', () => {
    expect(resolutionOf(fields, {}, {})).toEqual({ choice: 'A' })
    expect(resolutionOf(fields, { 'email->mail': 'B', 'stage->status': 'B' }, {})).toEqual({ choice: 'B' })
    expect(resolutionOf(fields, { 'email->mail': 'B' }, {})).toEqual({ choice: 'CUSTOM', fields: { 'email->mail': 'B', 'stage->status': 'A' } })
    expect(resolutionOf(fields, { 'email->mail': 'B', 'stage->status': 'CUSTOM' }, { 'stage->status': 'customer' })).toEqual({
      choice: 'CUSTOM',
      fields: { 'email->mail': 'B' },
      values: { stage: 'customer' }
    })
    expect(resolutionOf(fields, { 'email->mail': 'CUSTOM', 'stage->status': 'CUSTOM' }, { 'email->mail': 'ana@c.com' })).toEqual({
      choice: 'CUSTOM',
      values: { email: 'ana@c.com', stage: '' }
    })
  })
})

describe('violationOf', () => {
  it('finds a refused pick by mapping key and a missing value by A field', () => {
    expect(violationOf(fields[0], [{ field: 'fields.email->mail', message: 'no inverse' }])).toBe('no inverse')
    expect(violationOf(fields[1], [{ field: 'values.stage', message: 'required' }])).toBe('required')
    expect(violationOf(fields[1], [{ field: 'fields.email->mail', message: 'no inverse' }])).toBeUndefined()
  })
})

describe('ConflictsPage', () => {
  it('lists open conflicts and posts the choice made in the dialog', async () => {
    render([
      { path: /^\/integrations\/conflicts\?status=OPEN/, body: [conflict] },
      { method: 'POST', path: '/integrations/conflicts/k1/resolve', body: { ...conflict, status: 'RESOLVED' } }
    ])
    const row = (await screen.findByRole('link', { name: 'Contactos' })).closest('tr')!
    expect(within(row).getByText(/A: ana@a.com · B: ana@b.com/)).toBeInTheDocument()

    await userEvent.click(within(row).getByRole('button', { name: 'Resolve the conflict of Contactos' }))
    const dialog = await screen.findByRole('dialog')
    const email = within(dialog).getByRole('group', { name: 'email ↔ mail' })
    await userEvent.click(within(email).getByLabelText("B's: ana@b.com"))
    const stage = within(dialog).getByRole('group', { name: 'stage ↔ status' })
    await userEvent.click(within(stage).getByLabelText('Another value'))
    await userEvent.type(within(stage).getByLabelText('Value for stage'), 'customer')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }))

    expect(await screen.findByText('Conflict resolved')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({
      choice: 'CUSTOM',
      fields: { 'email->mail': 'B' },
      values: { stage: 'customer' }
    })
  })

  it("shows the server's violations next to the field they name", async () => {
    render([
      { path: /^\/integrations\/conflicts\?status=OPEN/, body: [conflict] },
      {
        method: 'POST',
        path: '/integrations/conflicts/k1/resolve',
        status: 400,
        body: {
          title: 'Bad Request',
          detail: 'Invalid resolution',
          errors: [
            { field: 'fields.email->mail', message: "this mapping's transform has no inverse; give values.email" },
            { field: 'choice', message: 'A, B or CUSTOM' }
          ]
        }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve the conflict of Contactos' }))
    const dialog = await screen.findByRole('dialog')
    const email = within(dialog).getByRole('group', { name: 'email ↔ mail' })
    await userEvent.click(within(email).getByLabelText("B's: ana@b.com"))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }))

    expect(await within(email).findByText("this mapping's transform has no inverse; give values.email")).toBeInTheDocument()
    expect(email).toHaveAccessibleDescription("this mapping's transform has no inverse; give values.email")
    const stage = within(dialog).getByRole('group', { name: 'stage ↔ status' })
    expect(within(stage).queryByText(/no inverse/)).not.toBeInTheDocument()
    // the one no field claims stays in the banner
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Invalid resolution — choice: A, B or CUSTOM')
    expect(within(dialog).getByRole('alert')).not.toHaveTextContent('no inverse')
    expect(screen.queryByText('Conflict resolved')).not.toBeInTheDocument()
  })

  it('unlinks an interrupted create without a choice', async () => {
    const orphan: Conflict = { ...conflict, kind: 'ORPHANED_CREATE', fields: [] }
    render([
      { path: /^\/integrations\/conflicts\?status=OPEN/, body: [orphan] },
      { method: 'POST', path: '/integrations/conflicts/k1/resolve', body: { ...orphan, status: 'RESOLVED', resolution: { choice: 'UNLINK' } } }
    ])
    expect(await screen.findByText('A create was cut short')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resolve the conflict of Contactos' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop pairing' }))
    expect(await screen.findByText('Conflict resolved')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({})
  })

  it('posts a single side when every field keeps it', async () => {
    render([
      { path: /^\/integrations\/conflicts\?status=OPEN/, body: [conflict] },
      { method: 'POST', path: '/integrations/conflicts/k1/resolve', body: { ...conflict, status: 'RESOLVED' } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve the conflict of Contactos' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }))
    expect(await screen.findByText('Conflict resolved')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({ choice: 'A' })
  })

  it('shows resolved ones on request, and no resolve button to a member', async () => {
    render(
      [
        { path: /^\/integrations\/conflicts\?status=OPEN/, body: [conflict] },
        { path: /^\/integrations\/conflicts\?status=RESOLVED/, body: [] }
      ],
      { admin: false }
    )
    await screen.findByRole('link', { name: 'Contactos' })
    expect(screen.queryByRole('button', { name: /Resolve the conflict/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resolved' }))
    expect(await screen.findByText('None resolved yet')).toBeInTheDocument()
  })
})
