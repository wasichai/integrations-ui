import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { integrationAiModule } from './module'
import { actionTool, connections, execution, integrationsGroup, member, recordTool } from './test/fixtures'
import { ToolPage } from './ToolPage'
import type { Tool } from './types'

vi.mock('@wasichai/ui', async (importOriginal) => (await import('./test/selectDouble')).selectDouble(importOriginal))

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean; tool?: Tool } = {}) => {
  const tool = options.tool ?? actionTool()
  mock = mockFetch([...routes, { path: `/integrations/ai/tools/${tool.name}`, body: tool }, { path: '/integrations/connections', body: connections }])
  return renderWithProviders(<ToolPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: `/integrations/ai/tools/${tool.name}`,
    path: 'integrations/ai/tools/:toolName',
    permissions: options.admin === false ? member : undefined
  })
}

const executed = () => mock!.calls.find((call) => call.method === 'POST')

describe('ToolPage', () => {
  it('shows the tool: connection, target, roles, limit, schema and links', async () => {
    render([])
    expect(await screen.findByRole('heading', { name: 'post_to_support', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Support Slack')).toBeInTheDocument())
    expect(screen.getByText('Action send_message')).toBeInTheDocument()
    expect(screen.getByText('SUPPORT_AGENT')).toBeInTheDocument()
    expect(screen.getByLabelText('Input schema')).toHaveTextContent('support-escalations')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/integrations/ai/tools/post_to_support/edit')
    expect(screen.getByRole('link', { name: 'Executions' })).toHaveAttribute('href', '/integrations/ai/executions?tool=post_to_support')
  })

  it('tries a tool from a form built from its schema; a 202 waits for approval', async () => {
    render([{ method: 'POST', path: '/integrations/ai/tools/post_to_support/execute', status: 202, body: execution() }])
    await screen.findByRole('heading', { name: 'post_to_support', level: 1 })
    expect(screen.getByText(/It needs approval/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('channel'), 'support')
    await userEvent.type(screen.getByLabelText('text'), 'Order 17 shipped')
    await userEvent.type(screen.getByLabelText('priority (optional)'), '2')
    await userEvent.click(screen.getByLabelText('urgent (optional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Run' }))
    const result = await screen.findByRole('status')
    expect(within(result).getByText('Waits for approval: it did not run.')).toBeInTheDocument()
    expect(within(result).getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/integrations/ai/executions/x1')
    expect(executed()!.body).toEqual({ channel: 'support', text: 'Order 17 shipped', priority: 2, urgent: true })
  })

  it('shows a 200 that ran, and a provider failure as its outcome', async () => {
    render(
      [
        {
          method: 'POST',
          path: '/integrations/ai/tools/find_contact/execute',
          body: execution({ toolName: 'find_contact', status: 'FAILED', error: 'Not found at the provider', errorKind: 'not_found' })
        }
      ],
      { tool: recordTool() }
    )
    await screen.findByRole('heading', { name: 'find_contact', level: 1 })
    await userEvent.type(screen.getByLabelText('id'), 'c-17')
    await userEvent.click(screen.getByRole('button', { name: 'Run' }))
    const result = await screen.findByRole('status')
    expect(within(result).getByText('Failed')).toBeInTheDocument()
    expect(within(result).getByText(/Not found: Not found at the provider/)).toBeInTheDocument()
  })

  it('places a 400 under the field it names', async () => {
    render([
      {
        method: 'POST',
        path: '/integrations/ai/tools/post_to_support/execute',
        status: 400,
        body: { title: 'Bad Request', detail: 'Invalid input', errors: [{ field: 'input.text', message: 'at least 1 character' }] }
      }
    ])
    await screen.findByRole('heading', { name: 'post_to_support', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByText('at least 1 character')).toBeInTheDocument()
    expect(screen.getByLabelText('text')).toHaveAttribute('aria-invalid', 'true')
  })

  it('takes JSON for a schema a form cannot draw', async () => {
    const create = recordTool({
      name: 'add_contact',
      operation: 'CREATE',
      inputSchema: { type: 'object', properties: { fields: { type: 'object', properties: { name: { type: 'string' } } } }, required: ['fields'] }
    })
    render(
      [
        {
          method: 'POST',
          path: '/integrations/ai/tools/add_contact/execute',
          body: execution({ toolName: 'add_contact', status: 'SUCCEEDED', output: { id: 'c-9', created: true } })
        }
      ],
      { tool: create }
    )
    await screen.findByRole('heading', { name: 'add_contact', level: 1 })
    fireEvent.change(screen.getByLabelText('Input (JSON)'), { target: { value: '[1]' } })
    await userEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.getByText('Must be a JSON object')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Input (JSON)'), { target: { value: '{"fields": {"name": "Ana"}}' } })
    await userEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByText('It ran.')).toBeInTheDocument()
    expect(screen.getByLabelText('Output')).toHaveTextContent('c-9')
    expect(executed()!.body).toEqual({ fields: { name: 'Ana' } })
  })

  it('does not offer to run a disabled tool', async () => {
    render([], { tool: actionTool({ enabled: false }) })
    expect(await screen.findByText('The tool is disabled: it cannot be called.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
  })

  it('deletes after asking', async () => {
    render([{ method: 'DELETE', path: '/integrations/ai/tools/post_to_support', status: 204 }])
    await userEvent.click(await screen.findByRole('button', { name: 'Delete tool' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mock!.calls.some((call) => call.method === 'DELETE')).toBe(true))
  })

  it('lets a member try it, not change it', async () => {
    render([], { admin: false })
    await screen.findByRole('heading', { name: 'post_to_support', level: 1 })
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete tool' })).not.toBeInTheDocument()
  })

  it('says when the tool does not exist', async () => {
    mock = mockFetch([{ path: '/integrations/ai/tools/nope', status: 404, body: { title: 'Not Found', detail: "Tool 'nope' not found" } }])
    renderWithProviders(<ToolPage />, {
      modules: [integrationsGroup, integrationAiModule()],
      language: 'en',
      route: '/integrations/ai/tools/nope',
      path: 'integrations/ai/tools/:toolName'
    })
    expect(await screen.findByText(/not found/i)).toBeInTheDocument()
  })
})
