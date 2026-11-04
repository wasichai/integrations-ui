import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { CatalogPage } from './CatalogPage'
import { integrationsModule } from './module'
import { connector } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = () => renderWithProviders(<CatalogPage />, { modules: [integrationsModule()], language: 'en' })

describe('CatalogPage', () => {
  it('shows each connector with its capabilities, auth methods and whether its app is registered', async () => {
    mock = mockFetch([
      {
        path: '/integrations/connectors',
        body: [
          connector(),
          connector({
            id: 'notion',
            provider: 'Notion',
            description: 'Pages and databases',
            authMethods: [{ type: 'API_KEY' }],
            capabilities: { READ: 'TESTED' },
            needsProviderConfig: false,
            providerConfigured: false
          }),
          connector({ id: 'salesforce', provider: 'Salesforce', description: 'Accounts', providerConfigured: false })
        ]
      }
    ])
    render()

    const hubspot = (await screen.findByRole('link', { name: 'HubSpot' })).closest('li')!
    expect(screen.getByRole('link', { name: 'HubSpot' })).toHaveAttribute('href', '/integrations/connectors/hubspot')
    expect(within(hubspot).getByText('Read · Implemented')).toBeInTheDocument()
    expect(within(hubspot).getByText('Webhooks · Declared')).toBeInTheDocument()
    expect(within(hubspot).getByText('Authentication · Tested')).toBeInTheDocument()
    expect(within(hubspot).getByText('OAuth (sign in at the provider)')).toBeInTheDocument()
    expect(within(hubspot).getByText('App registered')).toBeInTheDocument()

    const notion = screen.getByRole('link', { name: 'Notion' }).closest('li')!
    expect(within(notion).getByText('API key')).toBeInTheDocument()
    // an api key connector needs no app: no badge either way
    expect(within(notion).queryByText(/App (registered|not registered)/)).not.toBeInTheDocument()

    const salesforce = screen.getByRole('link', { name: 'Salesforce' }).closest('li')!
    expect(within(salesforce).getByText('App not registered')).toBeInTheDocument()
  })

  it('filters by what is typed and says when nothing matches', async () => {
    mock = mockFetch([
      {
        path: '/integrations/connectors',
        body: [connector(), connector({ id: 'notion', provider: 'Notion', description: 'Pages and databases', capabilities: { READ: 'TESTED' } })]
      }
    ])
    render()
    await screen.findByRole('link', { name: 'HubSpot' })

    await userEvent.type(screen.getByLabelText('Search connectors'), 'databases')
    expect(screen.queryByRole('link', { name: 'HubSpot' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notion' })).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search connectors'))
    await userEvent.type(screen.getByLabelText('Search connectors'), 'webhooks')
    expect(screen.getByRole('link', { name: 'HubSpot' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Notion' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search connectors'), ' zzz')
    expect(screen.getByText('No connector matches "webhooks zzz"')).toBeInTheDocument()
  })

  it('has an empty state and an error state', async () => {
    mock = mockFetch([{ path: '/integrations/connectors', body: [] }])
    const { unmount } = render()
    expect(await screen.findByText('No connectors are installed')).toBeInTheDocument()
    unmount()
    mock.restore()

    mock = mockFetch([{ path: '/integrations/connectors', status: 500, body: { title: 'Internal Server Error', detail: 'boom' } }])
    render()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
