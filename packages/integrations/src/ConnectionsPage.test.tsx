import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ConnectionsPage } from './ConnectionsPage'
import { integrationsModule } from './module'
import { connection } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], route = '/integrations/connections', options: { admin?: boolean } = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<ConnectionsPage />, {
    modules: [integrationsModule()],
    language: 'en',
    route,
    path: 'integrations/connections',
    permissions: options.admin === false ? { admin: false, objects: {}, capabilities: [] } : undefined
  })
}

const list: MockRoute = {
  path: '/integrations/connections',
  body: [connection(), connection({ id: 'c2', name: 'Notion docs', connectorId: 'notion', status: 'ERROR', health: 'FAILING', lastError: 'AuthExpired: 401' })]
}

describe('ConnectionsPage', () => {
  it('lists connections with their status and health', async () => {
    render([list])
    const row = (await screen.findByRole('link', { name: 'Notion docs' })).closest('tr')!
    expect(within(row).getByText('Error')).toBeInTheDocument()
    expect(within(row).getByText('Failing')).toBeInTheDocument()
    expect(within(row).getByText('AuthExpired: 401')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'HubSpot ventas' })).toHaveAttribute('href', '/integrations/connections/c1')
  })

  it('says why the oauth return failed, from the code in the query string', async () => {
    render([list], '/integrations/connections?status=error&error=token_refused')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not connect.')
    expect(alert).toHaveTextContent('The provider refused the authorization code')
    await userEvent.click(within(alert).getByRole('button'))
    expect(screen.queryByText(/Could not connect/)).not.toBeInTheDocument()
  })

  it('reads an unknown code as unknown, never as raw markup', async () => {
    render([list], '/integrations/connections?status=error&error=%3Cb%3Ex')
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown error (<b>x).')
  })

  it('confirms a successful oauth return with a link to the new connection', async () => {
    render([list], '/integrations/connections?status=connected&connectionId=c1')
    const status = await screen.findByText('The account is connected.')
    expect(within(status.closest('[data-slot="alert"]')!).getByRole('link', { name: 'Open the connection' })).toHaveAttribute(
      'href',
      '/integrations/connections/c1'
    )
  })

  it('tests a connection and reports a failure as an answer', async () => {
    render([
      list,
      {
        method: 'POST',
        path: '/integrations/connections/c1/test',
        body: { ok: false, error: 'RateLimited: slow down', retryable: true, connection: connection({ health: 'DEGRADED' }) }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Test the connection HubSpot ventas' }))
    expect(await screen.findByText('The connection "HubSpot ventas" failed: RateLimited: slow down')).toBeInTheDocument()
  })

  it('deletes after a confirmation, and only for a manager', async () => {
    render([list, { method: 'DELETE', path: '/integrations/connections/c2', status: 204 }])
    await userEvent.click(await screen.findByRole('button', { name: 'Delete the connection Notion docs' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete "Notion docs"?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mock!.calls.some((call) => call.method === 'DELETE' && call.path === '/integrations/connections/c2')).toBe(true)
  })

  it('hides delete from a member who cannot manage the organization', async () => {
    render([list], '/integrations/connections', { admin: false })
    await screen.findByRole('link', { name: 'Notion docs' })
    expect(screen.queryByRole('button', { name: /Delete the connection/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test the connection Notion docs' })).toBeInTheDocument()
  })

  it('points to the catalog when there is nothing yet', async () => {
    render([{ path: '/integrations/connections', body: [] }])
    expect(await screen.findByText('No connections yet')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'New connection' })[0]).toHaveAttribute('href', '/integrations/connectors')
  })
})
