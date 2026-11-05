import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute, type WasichaiRenderOptions } from '@wasichai/testing'
import { integrationAdminModule } from './module'
import { SystemPage } from './SystemPage'
import { failedEvent, health, integrationsRoutes, job, member } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const base: MockRoute[] = [
  { path: '/integrations/health', body: health() },
  {
    path: '/integrations/jobs',
    body: [job(), job({ id: 'j2', kind: 'integrations.event', errorKind: 'permanent', retryable: false, lastError: 'bad mapping' })]
  },
  { path: '/integrations/events', body: { content: [failedEvent()], nextCursor: null } },
  { path: '/integrations/connections', body: [{ id: 'c1', connectorId: 'salesforce', name: 'Salesforce' }] }
]

const render = (routes: MockRoute[] = [], options: WasichaiRenderOptions = {}) => {
  // the first route that matches answers: the test's own before the defaults
  mock = mockFetch([...routes, ...base])
  return renderWithProviders(<SystemPage />, { modules: [integrationsRoutes, integrationAdminModule()], language: 'en', ...options })
}

const paths = (prefix: string, method = 'GET') => mock!.calls.filter((call) => call.method === method && call.path.startsWith(prefix)).map((call) => call.path)

describe('SystemPage', () => {
  it('sums up connections and jobs and lists the failing connections', async () => {
    render()
    expect(await screen.findByText('1 connection needs attention. 2 jobs ran out of attempts.')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Salesforce' })[0]).toHaveAttribute('href', '/integrations/connections/c1')
    expect(screen.getByText('authorization expired: invalid_grant')).toBeInTheDocument()
    expect(screen.getByText('No connection is paused.')).toBeInTheDocument()
  })

  it('shows rate-limit pauses still running', async () => {
    const until = new Date(Date.now() + 60_000).toISOString()
    render([
      {
        path: '/integrations/health',
        body: health({
          failing: [{ ...health().failing[0], status: 'ACTIVE', health: 'DEGRADED', rateLimitedUntil: until }]
        })
      }
    ])
    expect(await screen.findByText(/paused until/)).toBeInTheDocument()
    expect(screen.queryByText('No connection is paused.')).toBeNull()
  })

  it('lists the dead jobs first and retries one, saying when an error is permanent', async () => {
    render([{ method: 'POST', path: '/integrations/jobs/j1/retry', body: job({ status: 'PENDING', attempts: 0 }) }])
    expect(await screen.findByText('bad mapping')).toBeInTheDocument()
    expect(paths('/integrations/jobs')).toEqual(['/integrations/jobs?limit=50&status=DEAD'])
    expect(screen.getByText('Permanent error: it fails again unless the cause is fixed.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry integrations.sync.run' }))
    expect(await screen.findByText('integrations.sync.run is queued again.')).toBeInTheDocument()
    expect(paths('/integrations/jobs/j1/retry', 'POST')).toHaveLength(1)
  })

  it('filters jobs by status and kind', async () => {
    render()
    await screen.findByText('bad mapping')
    await userEvent.click(within(screen.getByRole('group', { name: 'Job status' })).getByRole('button', { name: 'All' }))
    await waitFor(() => expect(paths('/integrations/jobs')).toContain('/integrations/jobs?limit=50'))
    await userEvent.type(screen.getByLabelText('Kind'), 'integrations.event')
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    await waitFor(() => expect(paths('/integrations/jobs')).toContain('/integrations/jobs?limit=50&kind=integrations.event'))
  })

  it('says when no job is dead, and when jobs cannot be read', async () => {
    render([{ path: '/integrations/jobs', body: [] }])
    expect(await screen.findByText('No dead jobs')).toBeInTheDocument()
    mock?.restore()
    render([{ path: '/integrations/jobs', status: 500, body: { title: 'Server Error', detail: 'jobs down' } }])
    expect(await screen.findByText('jobs down')).toBeInTheDocument()
    // the rest still shows: one part down leaves the others
    expect((await screen.findAllByText('authorization expired: invalid_grant')).length).toBeGreaterThan(0)
  })

  it('replays a failed event', async () => {
    render([{ method: 'POST', path: '/integrations/events/e1/replay', body: failedEvent({ status: 'RECEIVED' }) }])
    expect(await screen.findByText('listener threw')).toBeInTheDocument()
    expect(paths('/integrations/events')).toEqual(['/integrations/events?status=FAILED&limit=25'])
    await userEvent.click(screen.getByRole('button', { name: 'Replay record.updated' }))
    expect(await screen.findByText('record.updated is processed again.')).toBeInTheDocument()
  })

  it('shows a member the health and failed events, without jobs, retries or replays', async () => {
    render([], { permissions: member })
    expect(await screen.findByText('listener threw')).toBeInTheDocument()
    expect(screen.getByText('The job list and retries are for administrators only.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Replay/ })).toBeNull()
    expect(paths('/integrations/jobs')).toEqual([])
  })

  it('stays useful when health cannot be read', async () => {
    render([{ path: '/integrations/health', status: 503, body: { title: 'Unavailable', detail: 'health down' } }])
    expect(await screen.findByText('health down')).toBeInTheDocument()
    expect(await screen.findByText('listener threw')).toBeInTheDocument()
    expect(await screen.findByText('bad mapping')).toBeInTheDocument()
  })

  it('says all is well', async () => {
    render([
      { path: '/integrations/health', body: health({ failing: [], jobs: { SUCCEEDED: 3 } }) },
      { path: '/integrations/jobs', body: [] },
      { path: '/integrations/events', body: { content: [], nextCursor: null } }
    ])
    expect(await screen.findByText('All good: no connection is failing and no job is dead.')).toBeInTheDocument()
    expect(await screen.findByText('No failed events')).toBeInTheDocument()
  })
})
