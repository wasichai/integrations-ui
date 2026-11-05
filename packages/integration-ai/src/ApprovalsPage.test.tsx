import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ApprovalsPage } from './ApprovalsPage'
import { integrationAiModule } from './module'
import { execution, integrationsGroup, member } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const PENDING = /^\/integrations\/ai\/executions\?limit=50&status=PENDING_APPROVAL$/

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<ApprovalsPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: '/integrations/ai/approvals',
    path: 'integrations/ai/approvals',
    permissions: options.admin === false ? member : undefined
  })
}

describe('ApprovalsPage', () => {
  it('lists what waits, with its input, and approves one: it runs', async () => {
    render([
      { path: PENDING, body: { content: [execution()], nextCursor: null } },
      { method: 'POST', path: '/integrations/ai/executions/x1/approve', body: execution({ status: 'SUCCEEDED', output: { ok: true } }) }
    ])
    expect(await screen.findByLabelText('Input of post_to_support')).toHaveTextContent('Order 17 shipped')
    expect(screen.getByText('By support-bot')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve post_to_support (x1)' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('It runs once, now')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('post_to_support approved: it ran.')).toBeInTheDocument()
  })

  it('rejects with a reason', async () => {
    render([
      { path: PENDING, body: { content: [execution()], nextCursor: null } },
      { method: 'POST', path: '/integrations/ai/executions/x1/reject', body: execution({ status: 'REJECTED', reason: 'wrong channel' }) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Reject post_to_support (x1)' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), ' wrong channel ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('post_to_support rejected.')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({ reason: 'wrong channel' })
  })

  it('explains a 409: decided meanwhile or the tool changed', async () => {
    render([
      { path: PENDING, body: { content: [execution()], nextCursor: null } },
      {
        method: 'POST',
        path: '/integrations/ai/executions/x1/approve',
        status: 409,
        body: { title: 'Conflict', detail: "Tool 'post_to_support' changed since it was called; reject the execution" }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Approve post_to_support (x1)' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }))
    const alert = await within(screen.getByRole('dialog')).findByRole('alert')
    expect(alert).toHaveTextContent('changed since it was called')
    expect(alert).toHaveTextContent('It was decided already')
  })

  it('pages with the cursor', async () => {
    render([
      { path: /cursor=next1/, body: { content: [execution({ id: 'x2', toolName: 'older_tool' })], nextCursor: null } },
      { path: PENDING, body: { content: [execution()], nextCursor: 'next1' } }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(await screen.findByLabelText('Input of older_tool')).toBeInTheDocument()
  })

  it('shows a member their own waiting calls, without decisions', async () => {
    render([{ path: PENDING, body: { content: [execution()], nextCursor: null } }], { admin: false })
    await screen.findByLabelText('Input of post_to_support')
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })

  it('says when nothing waits, and when the list cannot be read', async () => {
    render([{ path: PENDING, body: { content: [], nextCursor: null } }])
    expect(await screen.findByText('Nothing waits for approval')).toBeInTheDocument()
    mock?.restore()
    render([{ path: PENDING, status: 500, body: { title: 'Error', detail: 'database down' } }])
    await waitFor(() => expect(screen.getByText(/database down/)).toBeInTheDocument())
  })
})
