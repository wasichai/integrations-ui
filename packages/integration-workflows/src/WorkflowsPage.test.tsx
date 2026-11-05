import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { integrationWorkflowsModule } from './module'
import { integrationsGroup, member, workflow } from './test/fixtures'
import { WorkflowsPage } from './WorkflowsPage'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<WorkflowsPage />, {
    modules: [integrationsGroup, integrationWorkflowsModule()],
    language: 'en',
    route: '/integrations/workflows',
    path: 'integrations/workflows',
    permissions: options.admin === false ? member : undefined
  })
}

describe('WorkflowsPage', () => {
  it('lists workflows with their status, pause and unpublished changes', async () => {
    render([
      {
        path: '/integrations/workflows',
        body: [
          workflow(),
          workflow({ id: 'w2', name: 'Nightly export', paused: true, unpublishedChanges: true, graph: { trigger: { type: 'schedule' } } }),
          workflow({ id: 'w3', name: 'Half built', status: 'DRAFT', publishedVersion: null, unpublishedChanges: true, graph: {} })
        ]
      }
    ])
    const row = (name: string) => within(screen.getByRole('link', { name }).closest('tr')!)
    expect(await screen.findByRole('link', { name: 'Leads to CRM' })).toHaveAttribute('href', '/integrations/workflows/w1')
    expect(row('Leads to CRM').getByText('Published (v2)')).toBeInTheDocument()
    expect(row('Leads to CRM').getByText('Connection event')).toBeInTheDocument()
    expect(row('Nightly export').getByText('Paused')).toBeInTheDocument()
    expect(row('Nightly export').getByText('Unpublished changes')).toBeInTheDocument()
    expect(row('Half built').getByText('Draft')).toBeInTheDocument()
    expect(row('Half built').queryByText('Unpublished changes')).not.toBeInTheDocument()
  })

  it('creates a draft that starts connected: manual trigger to an end', async () => {
    render([
      { path: '/integrations/workflows', body: [] },
      { method: 'POST', path: '/integrations/workflows', status: 201, body: workflow({ id: 'w9', status: 'DRAFT' }) }
    ])
    await userEvent.click((await screen.findAllByRole('button', { name: 'New workflow' }))[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(within(dialog).getByText('Give it a name')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Name'), ' Leads ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
    // created: the designer route takes over
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Leads',
      graph: { trigger: { type: 'manual', next: 'done' }, steps: [{ id: 'done', type: 'end' }] }
    })
  })

  it('deletes a workflow after asking', async () => {
    render([
      { path: '/integrations/workflows', body: [workflow()] },
      { method: 'DELETE', path: '/integrations/workflows/w1', status: 204 }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Leads to CRM' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Its versions and trigger go too')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mock!.calls.some((call) => call.method === 'DELETE' && call.path === '/integrations/workflows/w1')).toBe(true)
  })

  it('offers a member nothing to change', async () => {
    render([{ path: '/integrations/workflows', body: [workflow()] }], { admin: false })
    await screen.findByRole('link', { name: 'Leads to CRM' })
    expect(screen.queryByRole('button', { name: 'New workflow' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Leads to CRM' })).not.toBeInTheDocument()
  })

  it('says when the list cannot be read', async () => {
    render([{ path: '/integrations/workflows', status: 500, body: { title: 'Internal Server Error', detail: 'database down' } }])
    expect(await screen.findByText(/database down/)).toBeInTheDocument()
  })
})
