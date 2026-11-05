import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ExecutionPage } from './ExecutionPage'
import { integrationAiModule } from './module'
import { execution, integrationsGroup, member } from './test/fixtures'
import type { ToolExecution } from './types'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean; execution?: ToolExecution } = {}) => {
  mock = mockFetch([...routes, { path: '/integrations/ai/executions/x1', body: options.execution ?? execution() }])
  return renderWithProviders(<ExecutionPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route: '/integrations/ai/executions/x1',
    path: 'integrations/ai/executions/:executionId',
    permissions: options.admin === false ? member : undefined
  })
}

describe('ExecutionPage', () => {
  it('shows a finished execution: input, output summary, truncation, error kind and decision', async () => {
    render([], {
      execution: execution({
        status: 'FAILED',
        output: '{"partial": "…',
        outputTruncated: true,
        error: 'The provider refused',
        errorKind: 'permission_denied',
        decidedBy: 'u-admin',
        decidedAt: '2026-11-05T10:00:30Z',
        startedAt: '2026-11-05T10:00:30Z',
        finishedAt: '2026-11-05T10:00:31Z'
      })
    })
    expect(await screen.findByRole('heading', { name: 'Execution of post_to_support', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI executions' })).toHaveAttribute('href', '/integrations/ai/executions')
    expect(screen.getByLabelText('Input')).toHaveTextContent('Order 17 shipped')
    expect(screen.getByLabelText('Output')).toHaveTextContent('{"partial"')
    expect(screen.getByText(/over 16 KiB and was cut/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The provider refused')
    expect(screen.getByText('Permission denied')).toBeInTheDocument()
    expect(screen.getByText('u-admin')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })

  it('rejects a pending execution from its page', async () => {
    render([{ method: 'POST', path: '/integrations/ai/executions/x1/reject', body: execution({ status: 'REJECTED', decidedBy: 'u-admin' }) }])
    expect(await screen.findByText(/Waits for an administrator/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reject post_to_support (x1)' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('post_to_support rejected.')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({})
  })

  it('offers a member no decision', async () => {
    render([], { admin: false })
    await screen.findByRole('heading', { name: 'Execution of post_to_support', level: 1 })
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })

  it('says when the execution does not exist', async () => {
    mock = mockFetch([{ path: '/integrations/ai/executions/nope', status: 404, body: { title: 'Not Found', detail: 'Execution nope not found' } }])
    renderWithProviders(<ExecutionPage />, {
      modules: [integrationsGroup, integrationAiModule()],
      language: 'en',
      route: '/integrations/ai/executions/nope',
      path: 'integrations/ai/executions/:executionId'
    })
    expect(await screen.findByText(/not found/i)).toBeInTheDocument()
  })
})
