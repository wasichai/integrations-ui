import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { DesignerPage } from './DesignerPage'
import { integrationWorkflowsModule } from './module'
import { integrationsGroup, member, workflow } from './test/fixtures'
import type { Workflow } from './types'

vi.mock('@wasichai/ui', async (importOriginal) => (await import('./test/selectDouble')).selectDouble(importOriginal))

// xyflow measures its container and draws nothing in jsdom, which measures zero. the canvas is a double:
// it records the props it was handed and lets the test fire what the pointer would have
const { flow } = vi.hoisted(() => ({ flow: { props: null as Record<string, never> | null } }))
vi.mock('./WorkflowCanvas', () => ({
  WorkflowCanvas: (props: Record<string, never>) => {
    flow.props = props
    return <div data-testid="canvas" />
  }
}))
const canvas = () =>
  flow.props as unknown as {
    problems: Record<string, number>
    onSelect: (id: string) => void
    onConnect: (source: string, handle: string, target: string) => void
  }

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const connections = { path: '/integrations/connections', body: [{ id: 'c1', connectorId: 'slack', name: 'Slack', status: 'ACTIVE' }] }

const render = (routes: MockRoute[], options: { workflow?: Workflow; connections?: MockRoute; admin?: boolean } = {}) => {
  mock = mockFetch([...routes, { path: '/integrations/workflows/w1', body: options.workflow ?? workflow() }, options.connections ?? connections])
  return renderWithProviders(<DesignerPage />, {
    modules: [integrationsGroup, integrationWorkflowsModule()],
    language: 'en',
    route: '/integrations/workflows/w1/design',
    path: 'integrations/workflows/:workflowId/design',
    permissions: options.admin === false ? member : undefined
  })
}

const panel = () => within(screen.getByRole('region', { name: /^Properties of/ }))
const select = (label: string) => userEvent.selectOptions.bind(null, panel().getByLabelText(label))
const saved = (overrides: Partial<Workflow> = {}) => workflow({ version: 8, unpublishedChanges: true, ...overrides })
const put = (status = 200, body: unknown = saved()): MockRoute => ({ method: 'PUT', path: '/integrations/workflows/w1', status, body })

describe('DesignerPage', () => {
  it('edits the trigger, adds a step and saves the draft with its version as If-Match', async () => {
    render([put()])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    expect(panel().getByRole('heading', { name: 'Trigger' })).toBeInTheDocument()
    await select('Trigger type')('schedule')
    await userEvent.type(panel().getByLabelText('Cron'), '0 0 9 * * *')

    await userEvent.selectOptions(screen.getByLabelText('Step type'), 'delay')
    await userEvent.click(screen.getByRole('button', { name: 'Add step' }))
    expect(panel().getByRole('heading', { name: 'delay1 · Delay' })).toBeInTheDocument()
    await userEvent.clear(panel().getByLabelText('Duration'))
    await userEvent.type(panel().getByLabelText('Duration'), 'PT1H')
    await select('Next')('done')
    expect(screen.getByText('Unsaved')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Draft saved')).toBeInTheDocument()
    const call = mock!.calls.find((candidate) => candidate.method === 'PUT')!
    expect(call.headers['if-match']).toBe('"7"')
    expect(call.body).toEqual({
      name: 'Leads to CRM',
      graph: {
        trigger: { type: 'schedule', next: 'check', cron: '0 0 9 * * *' },
        steps: [...(workflow().graph.steps ?? []), { id: 'delay1', type: 'delay', duration: 'PT1H', next: 'done' }]
      }
    })
  })

  it('wires an edge dragged on the canvas and drops edges into a removed step', async () => {
    render([put()])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    act(() => canvas().onConnect('upsert', 'onError', 'check'))
    act(() => canvas().onSelect('upsert'))
    expect(panel().getByLabelText('On error')).toHaveValue('check')
    act(() => canvas().onSelect('done'))
    await userEvent.click(panel().getByRole('button', { name: 'Remove step' }))
    expect(screen.getByText('Pick a node on the canvas to edit it.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Draft saved')
    const steps = (mock!.calls.find((call) => call.method === 'PUT')!.body as { graph: { steps: unknown[] } }).graph.steps
    expect(steps).toHaveLength(2)
    expect(steps[1]).toMatchObject({ id: 'upsert', onError: 'check' })
    expect(steps[1]).not.toHaveProperty('next')
  })

  it('shows each violation next to its node and field', async () => {
    render([
      {
        method: 'POST',
        path: '/integrations/workflows/w1/validate',
        body: {
          valid: false,
          errors: [
            { field: 'graph.steps[1].write.externalIdField', message: "'extId' is not an external id field" },
            { field: 'graph.trigger.eventType', message: 'the connector declares no event message.created' },
            { field: 'graph.steps[1].foo', message: 'unknown thing' }
          ]
        }
      }
    ])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    // nothing changed: validate reads the stored draft without saving it again
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))
    expect(await screen.findByText('3 problems to fix before publishing')).toBeInTheDocument()
    expect(mock!.calls.some((call) => call.method === 'PUT')).toBe(false)
    expect(canvas().problems).toEqual({ upsert: 2, '@trigger': 1 })
    expect(panel().getByLabelText('Event type')).toHaveAccessibleDescription('the connector declares no event message.created')

    await userEvent.click(screen.getByRole('button', { name: 'upsert: 2 problems' }))
    expect(panel().getByLabelText('External id field')).toHaveAccessibleDescription("'extId' is not an external id field")
    expect(panel().getByRole('alert')).toHaveTextContent('foo: unknown thing')
  })

  it('saves, then publishes the draft', async () => {
    render([
      put(),
      {
        method: 'POST',
        path: '/integrations/workflows/w1/publish',
        status: 201,
        body: { workflowId: 'w1', number: 3, graph: {}, publishedAt: '', publishedBy: null }
      }
    ])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    await userEvent.type(screen.getByLabelText('Name'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Version 3 published')).toBeInTheDocument()
    expect(screen.getByText('Published (v3)')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ name: 'Leads to CRM!' })
    expect(mock!.calls.find((call) => call.path.endsWith('/publish'))?.headers['if-match']).toBe('"8"')
  })

  it('shows what publish refused: violations, nothing new, a stale draft', async () => {
    const refusal = (status: number, body: unknown): MockRoute => ({ method: 'POST', path: '/integrations/workflows/w1/publish', status, body })
    const first = render([
      refusal(422, {
        title: 'Unprocessable Content',
        detail: 'The workflow does not validate',
        errors: [{ field: 'graph.steps[0].condition.ref', message: 'a reference' }]
      })
    ])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('The workflow does not validate')).toBeInTheDocument()
    expect(canvas().problems).toEqual({ check: 1 })
    first.unmount()
    mock!.restore()

    const second = render([refusal(409, { title: 'Conflict', detail: 'The draft is already published as version 2' })])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText(/nothing new to publish/)).toBeInTheDocument()
    second.unmount()
    mock!.restore()

    render([put(412, { title: 'Precondition Failed', detail: 'changed meanwhile' })])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    await userEvent.type(screen.getByLabelText('Name'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText(/Someone saved this workflow/)).toBeInTheDocument()
    expect(mock!.calls.some((call) => call.path.endsWith('/publish'))).toBe(false)
  })

  it('edits an action: its write, its inputs as references or literals', async () => {
    render([put()])
    await screen.findByRole('heading', { name: 'Designer', level: 1 })
    act(() => canvas().onSelect('upsert'))
    await waitFor(() => expect(panel().getByLabelText('External id field')).toHaveValue('extId'))
    await userEvent.click(panel().getByRole('button', { name: 'Add field' }))
    await userEvent.clear(panel().getByLabelText('Field 2'))
    await userEvent.type(panel().getByLabelText('Field 2'), 'tier')
    await userEvent.selectOptions(panel().getByLabelText('Kind of Value of tier'), 'value')
    await userEvent.clear(panel().getByLabelText('Value of tier'))
    await userEvent.type(panel().getByLabelText('Value of tier'), 'gold')
    await select('Operation')('delete')
    expect(panel().queryByLabelText('Value of tier')).not.toBeInTheDocument()
    await select('Operation')('upsert')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Draft saved')
    const steps = (mock!.calls.find((call) => call.method === 'PUT')!.body as { graph: { steps: { input?: unknown }[] } }).graph.steps
    expect(steps[1].input).toEqual({ email: { ref: 'trigger.payload.email' }, tier: { value: 'gold' } })
  })

  it('keeps working when the connection list cannot be read', async () => {
    render([], { connections: { path: '/integrations/connections', status: 500, body: { title: 'Internal Server Error' } } })
    expect(await screen.findByText(/connection list could not be read/)).toBeInTheDocument()
    expect(panel().getByLabelText('Connection')).toHaveValue('c1')
  })

  it('offers a member no save, validate or publish', async () => {
    render([], { admin: false })
    expect(await screen.findByText(/Read only/)).toBeInTheDocument()
    for (const name of ['Save draft', 'Validate', 'Publish']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  })
})
