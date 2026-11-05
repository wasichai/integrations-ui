import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { integrationAiModule } from './module'
import { actionTool, connections, crm, integrationsGroup, member, recordTool, slack } from './test/fixtures'
import { ToolEditorPage } from './ToolEditorPage'

vi.mock('@wasichai/ui', async (importOriginal) => (await import('./test/selectDouble')).selectDouble(importOriginal))

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const common: MockRoute[] = [
  { path: '/integrations/connections', body: connections },
  { path: '/integrations/connectors/slack', body: slack },
  { path: '/integrations/connectors/crm', body: crm },
  {
    path: '/integrations/connections/c2/resources',
    body: [
      { name: 'contacts', label: 'Contacts' },
      { name: 'deals', label: 'Deals' }
    ]
  },
  { path: '/roles', body: [{ id: 'r1', name: 'SUPPORT_AGENT', label: 'Support agent', ownRecordsOnly: false, permissions: [], fieldPermissions: [] }] }
]

const renderNew = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch([...routes, ...common])
  return renderWithProviders(<ToolEditorPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: '/integrations/ai/new-tool',
    path: 'integrations/ai/new-tool',
    permissions: options.admin === false ? member : undefined
  })
}

const renderEdit = (routes: MockRoute[]) => {
  mock = mockFetch([...routes, ...common])
  return renderWithProviders(<ToolEditorPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: '/integrations/ai/tools/post_to_support/edit',
    path: 'integrations/ai/tools/:toolName/edit'
  })
}

const posted = () => mock!.calls.find((call) => call.method === 'POST' || call.method === 'PUT')

describe('ToolEditorPage', () => {
  it('exposes a connector action with its schema, roles, approval on by default and a limit', async () => {
    renderNew([{ method: 'POST', path: '/integrations/ai/tools', status: 201, body: actionTool() }])
    await waitFor(() => expect(screen.getByRole('option', { name: 'Support Slack (slack)' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Connection'), 'c1')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Send a message' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'send_message')
    await userEvent.type(screen.getByLabelText('Name'), 'post_to_support')
    await userEvent.type(screen.getByLabelText('Description'), 'Post a message.')
    const schema = '{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}'
    fireEvent.change(screen.getByLabelText('Input schema'), { target: { value: schema } })
    await userEvent.type(screen.getByLabelText('Roles that may call it'), 'support_agent{Enter}')
    expect(screen.getByRole('button', { name: 'Remove role SUPPORT_AGENT' })).toBeInTheDocument()
    expect(screen.getByLabelText('A person approves every call')).toBeChecked()
    await userEvent.clear(screen.getByLabelText('Limit per minute'))
    await userEvent.type(screen.getByLabelText('Limit per minute'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(posted()).toBeDefined())
    expect(posted()!.body).toEqual({
      name: 'post_to_support',
      description: 'Post a message.',
      connectionId: 'c1',
      action: 'send_message',
      inputSchema: JSON.parse(schema),
      allowedRoles: ['SUPPORT_AGENT'],
      approvalRequired: true,
      rateLimitPerMinute: 10,
      enabled: true
    })
  })

  it('checks the schema is a JSON object before sending', async () => {
    renderNew([])
    await screen.findByLabelText('Input schema')
    fireEvent.change(screen.getByLabelText('Input schema'), { target: { value: '{ nope' } })
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByText('Not valid JSON')).toBeInTheDocument()
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
    expect(posted()).toBeUndefined()
  })

  it('exposes a record operation: discovered resources, operations by capability, approval following the operation', async () => {
    renderNew([{ method: 'POST', path: '/integrations/ai/tools', status: 201, body: recordTool() }])
    await waitFor(() => expect(screen.getByRole('option', { name: 'CRM (crm)' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Connection'), 'c2')
    await userEvent.click(screen.getByLabelText('Record operation'))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Deals' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Resource'), 'contacts')
    // the crm declares READ and WRITE, not UPSERT
    expect(screen.queryByRole('option', { name: 'Create or update' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Operation'), 'CREATE')
    expect(screen.getByLabelText('A person approves every call')).toBeChecked()
    await userEvent.selectOptions(screen.getByLabelText('Operation'), 'READ')
    expect(screen.getByLabelText('A person approves every call')).not.toBeChecked()
    expect(screen.queryByLabelText('Input schema')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name'), 'find_contact')
    await userEvent.type(screen.getByLabelText('Description'), 'Read a contact.')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(posted()).toBeDefined())
    expect(posted()!.body).toEqual({
      name: 'find_contact',
      description: 'Read a contact.',
      connectionId: 'c2',
      resource: 'contacts',
      operation: 'read',
      allowedRoles: [],
      approvalRequired: false,
      rateLimitPerMinute: 60,
      enabled: true
    })
  })

  it('shows the server violations under their fields', async () => {
    renderNew([
      {
        method: 'POST',
        path: '/integrations/ai/tools',
        status: 400,
        body: {
          title: 'Bad Request',
          detail: 'Invalid tool',
          errors: [
            { field: 'name', message: 'lower case letters' },
            { field: 'inputSchema.properties.text.pattern', message: 'not supported' },
            { field: 'allowedRoles[0]', message: "no role 'GHOST' in this organization" }
          ]
        }
      }
    ])
    await waitFor(() => expect(screen.getByRole('option', { name: 'Support Slack (slack)' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Connection'), 'c1')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Send a message' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'send_message')
    await userEvent.type(screen.getByLabelText('Name'), 'Bad')
    await userEvent.type(screen.getByLabelText('Description'), 'x')
    await userEvent.type(screen.getByLabelText('Roles that may call it'), 'ghost{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('lower case letters')).toBeInTheDocument()
    expect(screen.getByText('inputSchema.properties.text.pattern: not supported')).toBeInTheDocument()
    expect(screen.getByText("allowedRoles[0]: no role 'GHOST' in this organization")).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('saves an edit with If-Match and says when it went stale', async () => {
    renderEdit([
      { path: '/integrations/ai/tools/post_to_support', body: actionTool() },
      { method: 'PUT', path: '/integrations/ai/tools/post_to_support', status: 412, body: { title: 'Precondition Failed', detail: 'changed meanwhile' } }
    ])
    expect(await screen.findByLabelText('Name')).toHaveValue('post_to_support')
    expect(screen.getByLabelText('Input schema')).toHaveValue(JSON.stringify(actionTool().inputSchema, null, 2))
    expect(screen.getByRole('button', { name: 'Remove role SUPPORT_AGENT' })).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Enabled'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Someone changed this tool/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(posted()!.headers['if-match']).toBe('"3"')
    expect(posted()!.body).toMatchObject({ name: 'post_to_support', enabled: false, approvalRequired: true, rateLimitPerMinute: 10 })
  })

  it('shows a record tool its derived schema', async () => {
    mock = mockFetch([{ path: '/integrations/ai/tools/find_contact', body: recordTool() }, ...common])
    renderWithProviders(<ToolEditorPage />, {
      modules: [integrationsGroup, integrationAiModule()],
      language: 'en',
      route: '/integrations/ai/tools/find_contact/edit',
      path: 'integrations/ai/tools/:toolName/edit'
    })
    expect(await screen.findByLabelText('Derived input schema')).toHaveTextContent('"minLength": 1')
  })

  it('tells a member they cannot change tools', async () => {
    renderNew([], { admin: false })
    expect(await screen.findByText('Only an administrator can expose or change tools.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  })
})
