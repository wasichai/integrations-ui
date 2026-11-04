import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { HealthPage } from './HealthPage'
import { integrationsModule } from './module'
import type { Health, Job } from './types'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch(routes)
  return renderWithProviders(<HealthPage />, {
    modules: [integrationsModule()],
    language: 'en',
    permissions: options.admin === false ? { admin: false, objects: {}, capabilities: [] } : undefined
  })
}

const health: Health = {
  connections: { ACTIVE: 3, NEEDS_REAUTH: 1, DISABLED: 0, ERROR: 0 },
  failing: [
    {
      id: 'c2',
      connectorId: 'salesforce',
      name: 'Salesforce prod',
      status: 'NEEDS_REAUTH',
      health: 'FAILING',
      lastValidatedAt: null,
      lastError: 'AuthExpired: refresh token revoked',
      rateLimitedUntil: '2026-11-04T10:05:00Z'
    }
  ],
  jobs: { PENDING: 2, DEAD: 1 }
}

const dead: Job = {
  id: 'j1',
  kind: 'integration.event',
  status: 'DEAD',
  attempts: 8,
  maxAttempts: 8,
  nextAttemptAt: '2026-11-04T10:00:00Z',
  lastError: 'provider 500',
  errorKind: 'transient',
  retryable: true,
  correlationId: 'corr-9',
  createdAt: '2026-11-04T09:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
  finishedAt: '2026-11-04T10:00:00Z'
}

describe('HealthPage', () => {
  it('counts connections and jobs by status and lists the ones in trouble', async () => {
    render([
      { path: '/integrations/health', body: health },
      { path: '/integrations/jobs', body: [] }
    ])
    expect(await screen.findByText('1 connection needs attention')).toBeInTheDocument()
    const reauth = screen.getByText('Needs reconnecting', { selector: 'dt' }).closest('div')!
    expect(within(reauth).getByText('1')).toBeInTheDocument()
    // a missing count is zero, not blank
    const running = screen.getByText('Running', { selector: 'dt' }).closest('div')!
    expect(within(running).getByText('0')).toBeInTheDocument()

    const row = screen.getByRole('link', { name: 'Salesforce prod' }).closest('tr')!
    expect(within(row).getByText('AuthExpired: refresh token revoked')).toBeInTheDocument()
    expect(within(row).getByText('Failing')).toBeInTheDocument()
    expect(row.querySelector('time[datetime="2026-11-04T10:05:00Z"]')).not.toBeNull()
    expect(await screen.findByText('No job ran out of attempts')).toBeInTheDocument()
  })

  it('retries a dead job', async () => {
    render([
      { path: '/integrations/health', body: { ...health, failing: [] } },
      { path: /^\/integrations\/jobs\?status=dead/, body: [dead] },
      { method: 'POST', path: '/integrations/jobs/j1/retry', body: { ...dead, status: 'PENDING' } }
    ])
    expect(await screen.findByText('No connection is in trouble')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Retry the integration.event job' }))
    expect(await screen.findByText('The integration.event job is queued again')).toBeInTheDocument()
    expect(mock!.calls.some((call) => call.method === 'POST' && call.path === '/integrations/jobs/j1/retry')).toBe(true)
  })

  it('does not ask for jobs a member is not allowed to see', async () => {
    render([{ path: '/integrations/health', body: health }], { admin: false })
    await screen.findByText('1 connection needs attention')
    expect(screen.queryByText('Dead jobs')).not.toBeInTheDocument()
    expect(mock!.calls.some((call) => call.path.startsWith('/integrations/jobs'))).toBe(false)
  })

  it('shows the error when health cannot be read', async () => {
    render([{ path: '/integrations/health', status: 503, body: { title: 'Service Unavailable', detail: 'down' } }], { admin: false })
    expect(await screen.findByRole('alert')).toHaveTextContent('down')
  })
})
