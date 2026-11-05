import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute, type WasichaiRenderOptions } from '@wasichai/testing'
import { ConnectorsPage } from './ConnectorsPage'
import { integrationAdminModule } from './module'
import { connector, integrationsGroup, integrationsRoutes } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: WasichaiRenderOptions = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<ConnectorsPage />, { modules: [integrationsRoutes, integrationAdminModule()], language: 'en', ...options })
}

describe('ConnectorsPage', () => {
  it('lists each installed connector with its versions, auth methods and capability maturity', async () => {
    render([
      {
        path: '/integrations/connectors',
        body: [
          connector(),
          connector({
            id: 'salesforce',
            provider: 'Salesforce',
            version: '2.0.1',
            sdkVersion: '1.3.0',
            authMethods: [{ type: 'OAUTH2_AUTHORIZATION_CODE', pkce: true }, { type: 'OAUTH2_CLIENT_CREDENTIALS' }],
            capabilities: { CHANGE_FEED: 'TESTED' },
            providerConfigured: true
          })
        ]
      }
    ])
    expect(await screen.findByText('2 connectors installed · SDKs in use: 1.2.0, 1.3.0')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notion' })).toHaveAttribute('href', '/integrations/connectors/notion')
    expect(screen.getByText('1.4.0')).toBeInTheDocument()
    expect(screen.getByText('2.0.1')).toBeInTheDocument()
    const notion = within(screen.getByRole('list', { name: 'Capabilities of Notion' }))
    expect(notion.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Authentication · Tested',
      'Read · Tested',
      'Write · Implemented',
      'Webhooks · Declared'
    ])
    expect(notion.getByText('Webhooks · Declared')).toHaveAttribute('title', 'Announced in the manifest, not implemented yet')
    expect(screen.getByText('OAuth app missing')).toBeInTheDocument()
    expect(screen.getByText('OAuth app registered')).toBeInTheDocument()
    expect(screen.getByText('OAuth (client credentials)')).toBeInTheDocument()
    expect(screen.getByText('· PKCE')).toBeInTheDocument()
  })

  it('names connectors without a link when @wasichai/integrations is not registered', async () => {
    render([{ path: '/integrations/connectors', body: [connector()] }], { modules: [integrationsGroup, integrationAdminModule()] })
    expect(await screen.findByText('Notion')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Notion' })).toBeNull()
    expect(screen.getByText('1 connector installed · SDK 1.2.0')).toBeInTheDocument()
  })

  it('says when none is installed, and when the catalog cannot be read', async () => {
    render([{ path: '/integrations/connectors', body: [] }])
    expect(await screen.findByText('No connector is installed')).toBeInTheDocument()
    mock?.restore()
    render([{ path: '/integrations/connectors', status: 500, body: { title: 'Server Error', detail: 'down' } }])
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('speaks spanish by default', async () => {
    render([{ path: '/integrations/connectors', body: [connector()] }], { language: undefined })
    expect(await screen.findByText('Lectura · Probado')).toBeInTheDocument()
  })
})
