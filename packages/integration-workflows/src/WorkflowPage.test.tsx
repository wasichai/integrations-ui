import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { integrationWorkflowsModule } from './module'
import { execution, integrationsGroup, member, workflow } from './test/fixtures'
import type { Workflow } from './types'
import { WorkflowPage } from './WorkflowPage'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean; workflow?: Workflow } = {}) => {
  mock = mockFetch([
    ...routes,
    { path: '/integrations/workflows/w1', body: options.workflow ?? workflow() },
    { path: '/integrations/workflows/w1/versions', body: [{ number: 2, publishedAt: '2026-11-05T09:00:00Z', publishedBy: 'u1' }] },
    { path: /^\/integrations\/workflows\/w1\/executions\?/, body: { content: [execution()], nextCursor: null } }
  ])
  return renderWithProviders(<WorkflowPage />, {
    modules: [integrationsGroup, integrationWorkflowsModule()],
    language: 'en',
    route: '/integrations/workflows/w1',
    path: 'integrations/workflows/:workflowId',
    permissions: options.admin === false ? member : undefined
  })
}

describe('WorkflowPage', () => {
  it('shows the workflow, its versions and its runs', async () => {
    render([])
    expect(await screen.findByRole('heading', { name: 'Leads to CRM', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Published (v2)')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Version 2' })).toHaveAttribute('href', '/integrations/workflows/w1/versions/2')
    expect(await screen.findByRole('link', { name: 'Open run e1 (Waiting)' })).toHaveAttribute('href', '/integrations/workflows/w1/executions/e1')
    expect(screen.getByRole('link', { name: 'Design' })).toHaveAttribute('href', '/integrations/workflows/w1/design')
  })

  it('filters runs by status and pages with the cursor', async () => {
    render([
      { path: /executions\?.*cursor=c2/, body: { content: [execution({ id: 'e3', status: 'FAILED', error: 'upsert: RateLimited' })], nextCursor: null } },
      { path: /executions\?.*status=FAILED/, body: { content: [execution({ id: 'e2', status: 'FAILED' })], nextCursor: 'c2' } }
    ])
    await screen.findByRole('link', { name: 'Open run e1 (Waiting)' })
    await userEvent.click(screen.getByRole('button', { name: 'Failed' }))
    expect(await screen.findByRole('link', { name: 'Open run e2 (Failed)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Failed' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('upsert: RateLimited')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open run e2 (Failed)' })).toBeInTheDocument()
    expect(mock!.calls.map((call) => call.path)).toContain('/integrations/workflows/w1/executions?limit=50&status=FAILED&cursor=c2')
  })

  it('runs it now with a json payload, refusing one that is not an object', async () => {
    render([{ method: 'POST', path: '/integrations/workflows/w1/run', status: 202, body: execution({ id: 'e7', status: 'QUEUED' }) }])
    await userEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    const dialog = await screen.findByRole('dialog')
    const payload = within(dialog).getByLabelText('Data (JSON)')
    await userEvent.type(payload, '[[1]')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run' }))
    expect(within(dialog).getByText(/It must be a JSON object/)).toBeInTheDocument()
    expect(mock!.calls.some((call) => call.method === 'POST')).toBe(false)
    await userEvent.clear(payload)
    await userEvent.type(payload, '{{"email": "ana@example.com"}')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run' }))
    await waitFor(() => expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({ payload: { email: 'ana@example.com' } }))
  })

  it('says why a run was refused', async () => {
    render([
      {
        method: 'POST',
        path: '/integrations/workflows/w1/run',
        status: 409,
        body: { title: 'Conflict', detail: 'Workflow w1 is paused' }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Run now' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Run' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Workflow w1 is paused')
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({})
  })

  it('pauses and resumes', async () => {
    render([{ method: 'POST', path: '/integrations/workflows/w1/pause', body: workflow({ paused: true }) }])
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(await screen.findByText('Workflow paused: no trigger starts a run')).toBeInTheDocument()
  })

  it('issues a webhook url once, with a copy button and a warning', async () => {
    render(
      [
        {
          method: 'POST',
          path: '/integrations/workflows/w1/webhook',
          status: 201,
          body: { url: 'https://app.example.com/api/hook/s3cret', path: '/hook/s3cret' }
        }
      ],
      {
        workflow: workflow({ graph: { trigger: { type: 'webhook', next: 'done' }, steps: [{ id: 'done', type: 'end' }] } })
      }
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Webhook URL' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/stops the previous one/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Issue a new URL' }))
    expect(await within(dialog).findByLabelText('URL')).toHaveTextContent('https://app.example.com/api/hook/s3cret')
    expect(within(dialog).getByText('Copy it now: it is not shown again.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('shows the path when the server has no public url', async () => {
    render([{ method: 'POST', path: '/integrations/workflows/w1/webhook', status: 201, body: { url: null, path: '/hook/s3cret' } }], {
      workflow: workflow({ graph: { trigger: { type: 'webhook' } } })
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Webhook URL' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Issue a new URL' }))
    expect(await screen.findByLabelText('Path')).toHaveTextContent('/hook/s3cret')
    expect(screen.getByText(/no public URL configured/)).toBeInTheDocument()
  })

  it('offers a member nothing to change', async () => {
    render([], { admin: false })
    await screen.findByRole('heading', { name: 'Leads to CRM', level: 1 })
    for (const name of ['Run now', 'Pause', 'Delete workflow']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Design' })).not.toBeInTheDocument()
  })

  it('tells a draft apart: no run, no pause', async () => {
    render([], { workflow: workflow({ status: 'DRAFT', publishedVersion: null, unpublishedChanges: true }) })
    expect(await screen.findByText(/Not published yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument()
  })
})
