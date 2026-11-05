import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { integrationAiModule } from './module'
import { actionTool, connections, integrationsGroup, member, recordTool } from './test/fixtures'
import { ToolsPage } from './ToolsPage'

vi.mock('@wasichai/ui', async (importOriginal) => (await import('./test/selectDouble')).selectDouble(importOriginal))

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<ToolsPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: '/integrations/ai/tools',
    path: 'integrations/ai/tools',
    permissions: options.admin === false ? member : undefined
  })
}

const row = (name: string) => within(screen.getByRole('link', { name }).closest('tr')!)

describe('ToolsPage', () => {
  it('lists tools with their connection, target, roles, state and approval', async () => {
    render([
      { path: '/integrations/ai/tools', body: [actionTool(), recordTool({ enabled: false })] },
      { path: '/integrations/connections', body: connections }
    ])
    expect(await screen.findByRole('link', { name: 'post_to_support' })).toHaveAttribute('href', '/integrations/ai/tools/post_to_support')
    await waitFor(() => expect(row('post_to_support').getByText('Support Slack')).toBeInTheDocument())
    expect(row('post_to_support').getByText('Action send_message')).toBeInTheDocument()
    expect(row('post_to_support').getByText('SUPPORT_AGENT')).toBeInTheDocument()
    expect(row('post_to_support').getByText('Needs approval')).toBeInTheDocument()
    expect(row('find_contact').getByText('Read · contacts')).toBeInTheDocument()
    expect(row('find_contact').getByText('Administrators only')).toBeInTheDocument()
    expect(row('find_contact').getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New tool' })).toHaveAttribute('href', '/integrations/ai/new-tool')
  })

  it('filters by connection', async () => {
    render([
      { path: '/integrations/ai/tools', body: [actionTool(), recordTool()] },
      { path: '/integrations/connections', body: connections }
    ])
    await screen.findByRole('link', { name: 'post_to_support' })
    await userEvent.selectOptions(screen.getByLabelText('Connection'), 'c2')
    expect(screen.queryByRole('link', { name: 'post_to_support' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'find_contact' })).toBeInTheDocument()
  })

  it('still lists tools when connections cannot be read', async () => {
    render([
      { path: '/integrations/ai/tools', body: [actionTool()] },
      { path: '/integrations/connections', status: 500, body: { title: 'Error' } }
    ])
    expect(await screen.findByText(/connections could not be read/)).toBeInTheDocument()
    expect(row('post_to_support').getByText('c1')).toBeInTheDocument()
  })

  it('deletes a tool after asking', async () => {
    render([
      { path: '/integrations/ai/tools', body: [actionTool()] },
      { path: '/integrations/connections', body: connections },
      { method: 'DELETE', path: '/integrations/ai/tools/post_to_support', status: 204 }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Delete post_to_support' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Its executions stay')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mock!.calls.some((call) => call.method === 'DELETE' && call.path === '/integrations/ai/tools/post_to_support')).toBe(true)
  })

  it('offers a member nothing to change, and says when none is callable', async () => {
    render(
      [
        { path: '/integrations/ai/tools', body: [] },
        { path: '/integrations/connections', body: connections }
      ],
      { admin: false }
    )
    expect(await screen.findByText('No tools your roles may call')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New tool' })).not.toBeInTheDocument()
  })

  it('says when the list cannot be read', async () => {
    render([{ path: '/integrations/ai/tools', status: 500, body: { title: 'Internal Server Error', detail: 'database down' } }])
    expect(await screen.findByText(/database down/)).toBeInTheDocument()
  })
})
