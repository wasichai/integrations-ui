import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'

// jsdom cannot follow a redirect to another origin: the seam is stubbed
vi.mock('./redirect', () => ({ redirectTo: vi.fn() }))

import { ConnectorPage } from './ConnectorPage'
import { integrationsModule } from './module'
import { redirectTo } from './redirect'
import { connection, connector } from './test/fixtures'

let mock: FetchMock | null = null
beforeEach(() => vi.mocked(redirectTo).mockClear())
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<ConnectorPage />, {
    modules: [integrationsModule()],
    language: 'en',
    route: '/integrations/connectors/hubspot',
    path: 'integrations/connectors/:connectorId',
    permissions: options.admin === false ? { admin: false, objects: {}, capabilities: [] } : undefined
  })
}

const apiKeyConnector = connector({ authMethods: [{ type: 'API_KEY' }], needsProviderConfig: false, providerConfigured: false })

describe('ConnectorPage', () => {
  it('connects with an api key: posts the credentials and opens the new connection', async () => {
    const { container } = render([
      { path: '/integrations/connectors/hubspot', body: apiKeyConnector },
      { method: 'POST', path: '/integrations/connections', status: 201, body: connection({ id: 'c9', authType: 'API_KEY' }) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Connection name')).toHaveValue('HubSpot')
    await userEvent.clear(within(dialog).getByLabelText('Connection name'))
    await userEvent.type(within(dialog).getByLabelText('Connection name'), 'Ventas')
    await userEvent.type(within(dialog).getByLabelText('API key'), 'secret-key')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }))

    const post = mock!.calls.find((call) => call.method === 'POST')
    expect(post?.path).toBe('/integrations/connections')
    expect(post?.body).toEqual({ connectorId: 'hubspot', name: 'Ventas', authType: 'API_KEY', apiKey: 'secret-key' })
    // off to the connection's own page, which this test does not mount
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows what the provider refused next to the field it names', async () => {
    render([
      { path: '/integrations/connectors/hubspot', body: apiKeyConnector },
      {
        method: 'POST',
        path: '/integrations/connections',
        status: 400,
        body: { title: 'Bad Request', detail: 'Invalid connection', errors: [{ field: 'apiKey', message: 'required' }] }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }))
    expect(await within(dialog).findByText('required')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('API key')).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Invalid connection')
  })

  it('starts oauth and sends the browser to the authorization url', async () => {
    render([
      { path: '/integrations/connectors/hubspot', body: connector() },
      {
        method: 'POST',
        path: '/integrations/connections/oauth/start',
        body: { authorizationUrl: 'https://app.hubspot.com/oauth/authorize?state=s1', expiresAt: '2026-11-04T10:10:00Z' }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to HubSpot' }))

    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({ connectorId: 'hubspot', name: 'HubSpot' })
    await vi.waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://app.hubspot.com/oauth/authorize?state=s1'))
  })

  it('will not start oauth before the provider app is registered', async () => {
    render([{ path: '/integrations/connectors/hubspot', body: connector({ providerConfigured: false }) }])
    await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Register the provider app first/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Continue to HubSpot' })).toBeDisabled()
  })

  it('hides connect and the provider app from a caller who cannot manage the organization', async () => {
    render([{ path: '/integrations/connectors/hubspot', body: connector() }], { admin: false })
    expect(await screen.findByRole('heading', { name: 'HubSpot', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Provider app' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Capabilities' })).toBeInTheDocument()
  })

  it('never fills the stored secret in and replaces the app with If-Match', async () => {
    const stored = {
      id: 'pc1',
      connectorId: 'hubspot',
      clientId: 'client-1',
      clientSecretSet: true,
      scopes: ['crm.schemas.read'],
      options: {},
      version: 3,
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-02T10:00:00Z'
    }
    render([
      { path: '/integrations/connectors/hubspot', body: connector() },
      { path: '/integrations/provider-configs/hubspot', body: stored },
      { method: 'PUT', path: '/integrations/provider-configs/hubspot', body: { ...stored, clientId: 'client-2', version: 4 } }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Provider app' }))
    expect(await screen.findByLabelText('Client ID')).toHaveValue('client-1')
    expect(screen.getByLabelText('Client secret')).toHaveValue('')
    expect(screen.getByText('Secret stored')).toBeInTheDocument()
    expect(screen.getByLabelText('Extra scopes')).toHaveValue('crm.schemas.read')

    await userEvent.clear(screen.getByLabelText('Client ID'))
    await userEvent.type(screen.getByLabelText('Client ID'), 'client-2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Provider app saved')).toBeInTheDocument()
    const put = mock!.calls.find((call) => call.method === 'PUT')
    expect(put?.headers['if-match']).toBe('"3"')
    // no clientSecret key: the stored one is kept
    expect(put?.body).toEqual({ clientId: 'client-2', scopes: ['crm.schemas.read'], options: {} })
  })

  it('registers a new app without If-Match and says when someone else saved first', async () => {
    render([
      { path: '/integrations/connectors/hubspot', body: connector({ providerConfigured: false }) },
      { path: '/integrations/provider-configs/hubspot', status: 404, body: { title: 'Not Found' } },
      { method: 'PUT', path: '/integrations/provider-configs/hubspot', status: 412, body: { title: 'Precondition Failed', detail: 'changed meanwhile' } }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Provider app' }))
    expect(await screen.findByText('Not registered')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Client ID'), 'client-1')
    await userEvent.type(screen.getByLabelText('Client secret'), 's3cret')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/Someone changed it while you were editing/)).toBeInTheDocument()
    const put = mock!.calls.find((call) => call.method === 'PUT')
    expect(put?.headers['if-match']).toBeUndefined()
    expect(put?.body).toEqual({ clientId: 'client-1', clientSecret: 's3cret', scopes: [], options: {} })
  })
})
