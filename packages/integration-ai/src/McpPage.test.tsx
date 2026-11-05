import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@wasichai/testing'
import { McpPage, apiUrl } from './McpPage'
import { integrationAiModule } from './module'
import { integrationsGroup, member } from './test/fixtures'

const render = (options: { admin?: boolean; apiBaseUrl?: string } = {}) =>
  renderWithProviders(<McpPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: '/integrations/ai/mcp',
    path: 'integrations/ai/mcp',
    config: options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : undefined,
    permissions: options.admin === false ? member : undefined
  })

describe('McpPage', () => {
  it('shows the endpoint under the app api base, the revision, auth and a client config', () => {
    render()
    const endpoint = `${window.location.origin}/api/integrations/mcp`
    expect(screen.getByLabelText('Endpoint')).toHaveTextContent(endpoint)
    expect(screen.getByText('2025-06-18')).toBeInTheDocument()
    expect(screen.getByText(`POST ${window.location.origin}/api/auth/token`)).toBeInTheDocument()
    const example = JSON.parse(screen.getByLabelText('Example client configuration').textContent ?? '')
    expect(example).toEqual({ mcpServers: { wasichai: { type: 'http', url: endpoint, headers: { Authorization: 'Bearer ${WASICHAI_TOKEN}' } } } })
    expect(screen.getByText(/allowed-origins/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Service accounts' })).toHaveAttribute('href', '/admin/service-accounts')
  })

  it('keeps an absolute api base as it is', () => {
    render({ apiBaseUrl: 'https://api.example.com/api/', admin: false })
    expect(screen.getByLabelText('Endpoint')).toHaveTextContent('https://api.example.com/api/integrations/mcp')
    expect(screen.queryByRole('link', { name: 'Service accounts' })).not.toBeInTheDocument()
    expect(apiUrl('/api', '/integrations/mcp', 'https://app.example.com')).toBe('https://app.example.com/api/integrations/mcp')
  })
})
