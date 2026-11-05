import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ExecutionPage } from './ExecutionPage'
import { integrationWorkflowsModule } from './module'
import { detail, integrationsGroup, member, stepRun } from './test/fixtures'
import type { ExecutionDetail } from './types'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean; detail?: ExecutionDetail } = {}) => {
  mock = mockFetch([...routes, { path: '/integrations/workflows/executions/e1', body: options.detail ?? detail() }])
  return renderWithProviders(<ExecutionPage />, {
    modules: [integrationsGroup, integrationWorkflowsModule()],
    language: 'en',
    route: '/integrations/workflows/w1/executions/e1',
    path: 'integrations/workflows/:workflowId/executions/:executionId',
    permissions: options.admin === false ? member : undefined
  })
}

const stepItem = (stepId: string) => within(screen.getByText(stepId, { selector: 'span' }).closest('li')!)

describe('ExecutionPage', () => {
  it('shows the step timeline: status, attempts, data, errors and waits', async () => {
    render([])
    expect(await screen.findByRole('heading', { name: 'Run', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the workflow' })).toHaveAttribute('href', '/integrations/workflows/w1')
    expect(stepItem('check').getByText('Done')).toBeInTheDocument()
    expect(stepItem('upsert').getByText('Attempt 3')).toBeInTheDocument()
    expect(stepItem('upsert').getByText('RateLimited')).toBeInTheDocument()
    expect(stepItem('upsert').getByLabelText('Input of upsert')).toHaveTextContent('ana@example.com')
    expect(stepItem('ok').getByText(/Waits until/)).toBeInTheDocument()
    expect(screen.getByLabelText('What started it')).toHaveTextContent('"type": "manual"')
  })

  it('approves a waiting approval with a comment', async () => {
    const decided = detail({ status: 'RUNNING' }, [
      stepRun({ stepId: 'ok', type: 'approval', status: 'SUCCEEDED', decidedBy: 'u1', output: { approved: true } })
    ])
    render([{ method: 'POST', path: '/integrations/workflows/executions/e1/steps/ok/approve', body: decided }])
    await screen.findByRole('heading', { name: 'Run', level: 1 })
    await userEvent.type(stepItem('ok').getByLabelText('Comment (optional)'), 'fine by me')
    await userEvent.click(stepItem('ok').getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Decided by u1')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({ comment: 'fine by me' })
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('says why a decision was refused', async () => {
    render([
      {
        method: 'POST',
        path: '/integrations/workflows/executions/e1/steps/ok/reject',
        status: 409,
        body: { title: 'Conflict', detail: 'Step ok is not waiting' }
      }
    ])
    await screen.findByRole('heading', { name: 'Run', level: 1 })
    await userEvent.click(stepItem('ok').getByRole('button', { name: 'Reject' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Step ok is not waiting')
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({})
  })

  it('cancels a run that is not over', async () => {
    render([
      { method: 'POST', path: '/integrations/workflows/executions/e1/cancel', body: detail({ status: 'CANCELLED', finishedAt: '2026-11-05T10:05:00Z' }) }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel run' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel run' }))
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument()
  })

  it('offers no decision and no cancel to a member, nor on a run that is over', async () => {
    render([], { admin: false })
    await screen.findByRole('heading', { name: 'Run', level: 1 })
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument()
  })

  it('shows the error that failed the run', async () => {
    render([], { detail: detail({ status: 'FAILED', error: 'Step upsert failed: RateLimited', finishedAt: '2026-11-05T10:05:00Z' }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Step upsert failed: RateLimited')
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument()
  })

  it('says when the run does not exist', async () => {
    mock = mockFetch([{ path: '/integrations/workflows/executions/nope', status: 404, body: { title: 'Not Found', detail: 'Execution nope not found' } }])
    renderWithProviders(<ExecutionPage />, {
      modules: [integrationsGroup, integrationWorkflowsModule()],
      language: 'en',
      route: '/integrations/workflows/w1/executions/nope',
      path: 'integrations/workflows/:workflowId/executions/:executionId'
    })
    expect(await screen.findByText(/not found/i)).toBeInTheDocument()
  })
})
