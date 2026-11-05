import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ExecutionsPage } from './ExecutionsPage'
import { integrationAiModule } from './module'
import { actionTool, execution, integrationsGroup, recordTool } from './test/fixtures'

vi.mock('@wasichai/ui', async (importOriginal) => (await import('./test/selectDouble')).selectDouble(importOriginal))

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], route = '/integrations/ai/executions') => {
  mock = mockFetch([...routes, { path: '/integrations/ai/tools', body: [actionTool(), recordTool()] }])
  return renderWithProviders(<ExecutionsPage />, {
    modules: [integrationsGroup, integrationAiModule()],
    language: 'en',
    route,
    path: 'integrations/ai/executions'
  })
}

const listed = () => mock!.calls.filter((call) => call.path.startsWith('/integrations/ai/executions')).map((call) => call.path)

describe('ExecutionsPage', () => {
  it('lists executions newest first with status, tool, caller and error kind', async () => {
    render([
      {
        path: '/integrations/ai/executions',
        body: {
          content: [
            execution({ status: 'FAILED', errorKind: 'rate_limited', error: 'slow down', finishedAt: '2026-11-05T10:01:00Z' }),
            execution({ id: 'x2' })
          ],
          nextCursor: null
        }
      }
    ])
    expect(await screen.findByRole('link', { name: 'Open Failed execution of post_to_support' })).toHaveAttribute('href', '/integrations/ai/executions/x1')
    expect(screen.getByText('Provider rate limit')).toBeInTheDocument()
    expect(screen.getAllByText('support-bot')).toHaveLength(2)
  })

  it('filters by status and tool, in the url', async () => {
    render([{ path: '/integrations/ai/executions', body: { content: [], nextCursor: null } }], '/integrations/ai/executions?tool=post_to_support')
    expect(await screen.findByText('No execution matches these filters')).toBeInTheDocument()
    expect(screen.getByLabelText('Tool')).toHaveValue('post_to_support')
    await userEvent.click(screen.getByRole('button', { name: 'Failed' }))
    await waitFor(() => expect(listed()).toContain('/integrations/ai/executions?limit=50&status=FAILED&tool=post_to_support'))
    await userEvent.selectOptions(screen.getByLabelText('Tool'), '@all')
    await waitFor(() => expect(listed()).toContain('/integrations/ai/executions?limit=50&status=FAILED'))
    expect(screen.getByRole('button', { name: 'Failed' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says when there are none, and when they cannot be read', async () => {
    render([{ path: '/integrations/ai/executions', body: { content: [], nextCursor: null } }])
    expect(await screen.findByText('No executions yet')).toBeInTheDocument()
    mock?.restore()
    render([{ path: '/integrations/ai/executions', status: 400, body: { title: 'Bad Request', detail: 'Invalid cursor' } }])
    await waitFor(() => expect(screen.getByText(/Invalid cursor/)).toBeInTheDocument())
  })
})
