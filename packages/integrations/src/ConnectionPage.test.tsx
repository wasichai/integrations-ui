import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { ConnectionPage } from './ConnectionPage'
import { integrationsModule } from './module'
import { connection, event } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

const render = (routes: MockRoute[], options: { admin?: boolean } = {}) => {
  mock = mockFetch([{ path: '/integrations/connections/c1', body: connection() }, ...routes])
  return renderWithProviders(<ConnectionPage />, {
    modules: [integrationsModule()],
    language: 'en',
    route: '/integrations/connections/c1',
    path: 'integrations/connections/:connectionId',
    permissions: options.admin === false ? { admin: false, objects: {}, capabilities: [] } : undefined
  })
}

const resources: MockRoute = { path: '/integrations/connections/c1/resources', body: [{ name: 'contacts', label: 'Contacts' }] }

describe('ConnectionPage', () => {
  it('lists the resources and shows the schema of the one clicked', async () => {
    render([
      resources,
      {
        path: '/integrations/connections/c1/resources/contacts/schema',
        body: {
          resource: 'contacts',
          label: 'Contacts',
          fields: [{ name: 'email', label: 'Email', type: 'TEXT', required: true, readOnly: false, externalId: true, options: [], nativeType: 'string' }]
        }
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: /Contacts/ }))
    expect(screen.getByRole('button', { name: /Contacts/ })).toHaveAttribute('aria-pressed', 'true')
    const row = (await screen.findByText('Email')).closest('tr')!
    expect(within(row).getByText('TEXT')).toBeInTheDocument()
    expect(within(row).getAllByText('Yes')).toHaveLength(2)
  })

  it('pages through events with the server cursor and replays one', async () => {
    render([
      resources,
      { path: /^\/integrations\/events\?.*cursor=next-1/, body: { content: [event({ eventId: 'e2', eventType: 'contact.deleted' })], nextCursor: null } },
      { path: /^\/integrations\/events\?connectionId=c1/, body: { content: [event()], nextCursor: 'next-1' } },
      { method: 'POST', path: '/integrations/events/e2/replay', body: event({ eventId: 'e2', status: 'RECEIVED' }) }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Events' }))
    expect(await screen.findByText('contact.created')).toBeInTheDocument()
    expect(mock!.calls.find((call) => call.path.startsWith('/integrations/events'))?.path).toBe('/integrations/events?connectionId=c1&limit=25')

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('contact.deleted')).toBeInTheDocument()
    expect(screen.getByText('contact.created')).toBeInTheDocument()
    expect(mock!.calls.filter((call) => call.path.startsWith('/integrations/events')).map((call) => call.path)).toEqual([
      '/integrations/events?connectionId=c1&limit=25',
      '/integrations/events?connectionId=c1&limit=25&cursor=next-1'
    ])
    // the last page has no cursor: nothing more to load
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Replay the event contact.deleted' }))
    expect(await screen.findByText('Event queued to be processed again')).toBeInTheDocument()
  })

  it('creates a webhook, shows its url to copy and reveals the verification token to an admin', async () => {
    const endpoint = {
      id: 'w1',
      connectionId: 'c1',
      connectorId: 'hubspot',
      url: 'https://app.example.com/api/integrations/webhooks/hubspot/w1',
      status: 'PENDING_VERIFICATION',
      secretSet: false,
      lastDeliveryAt: null,
      createdAt: '2026-11-04T10:00:00Z'
    }
    render([
      resources,
      { path: '/integrations/connections/c1/webhook-endpoints', body: [endpoint] },
      { method: 'POST', path: '/integrations/connections/c1/webhook-endpoints', status: 201, body: endpoint },
      { path: '/integrations/webhook-endpoints/w1/verification-token', body: { token: 'tok-123' } }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Webhooks' }))
    expect(await screen.findByText(endpoint.url)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy the URL' })).toBeInTheDocument()
    expect(screen.getByText('Awaiting verification')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Signing secret (optional)'), 'whsec')
    await userEvent.click(screen.getByRole('button', { name: 'Create webhook' }))
    expect(mock!.calls.find((call) => call.method === 'POST')?.body).toEqual({ secret: 'whsec' })

    await userEvent.click(screen.getByRole('button', { name: 'Show verification token' }))
    expect(await screen.findByText('tok-123')).toBeInTheDocument()
  })

  it('keeps webhook management, replay and delete away from a member', async () => {
    render(
      [
        resources,
        { path: '/integrations/connections/c1/webhook-endpoints', body: [] },
        { path: /^\/integrations\/events/, body: { content: [event()], nextCursor: null } }
      ],
      { admin: false }
    )
    expect(await screen.findByRole('heading', { name: 'HubSpot ventas', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Webhooks' }))
    expect(await screen.findByText('No webhooks')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create webhook' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Events' }))
    expect(await screen.findByText('contact.created')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Replay/ })).not.toBeInTheDocument()
  })
})
