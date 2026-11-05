import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock, type MockRoute } from '@wasichai/testing'
import { integrationAdminModule } from './module'
import { integrationsGroup } from './test/fixtures'
import { UsagePage } from './UsagePage'

let mock: FetchMock | null = null
beforeEach(() => {
  // only Date: react-query and user-event keep real timers
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T12:00:00Z'))
})
afterEach(() => {
  mock?.restore()
  vi.useRealTimers()
})

const render = (routes: MockRoute[], route = '/integrations/admin/usage') => {
  mock = mockFetch(routes)
  return renderWithProviders(<UsagePage />, { modules: [integrationsGroup, integrationAdminModule()], language: 'en', route, path: 'integrations/admin/usage' })
}

const asked = () => mock!.calls.filter((call) => call.path.startsWith('/integrations/usage')).map((call) => call.path)

const rows = [
  { day: '2026-11-03', metric: 'provider.calls', count: 1200 },
  { day: '2026-11-03', metric: 'sync.records', count: 40 },
  { day: '2026-11-05', metric: 'provider.calls', count: 7 }
]

describe('UsagePage', () => {
  it('asks the last 30 UTC days by default and shows totals and every day, newest first', async () => {
    render([{ path: '/integrations/usage', body: rows }])
    // the first render of a file loads the page's modules: slower under a loaded runner
    expect(await screen.findByRole('heading', { name: 'Range totals' }, { timeout: 3000 })).toBeInTheDocument()
    expect(asked()).toEqual(['/integrations/usage?from=2026-10-07&to=2026-11-05'])
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-07')
    expect(screen.getByLabelText('To')).toHaveValue('2026-11-05')
    const totals = screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent])
    expect(totals).toEqual([
      ['Provider calls', '1,207'],
      ['Synced records', '40'],
      ['Workflow steps', '0'],
      ['AI tool calls', '0']
    ])
    const dayRows = screen.getAllByRole('row').slice(1)
    expect(dayRows).toHaveLength(30)
    expect(
      within(dayRows[0])
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['2026-11-05', '7', '0', '0', '0', '7', ''])
    expect(
      within(dayRows[2])
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['2026-11-03', '1,200', '40', '0', '0', '1,240', ''])
  })

  it('filters by metric and range, in the url', async () => {
    render([{ path: '/integrations/usage', body: [] }], '/integrations/admin/usage?from=2026-11-01&to=2026-11-05')
    expect(await screen.findByText('Nothing counted in this range')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'AI tool calls' }))
    await waitFor(() => expect(asked()).toContain('/integrations/usage?from=2026-11-01&to=2026-11-05&metric=ai.tool_calls'))
    expect(screen.getByRole('button', { name: 'AI tool calls' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-04' } })
    await waitFor(() => expect(asked()).toContain('/integrations/usage?from=2026-11-04&to=2026-11-05&metric=ai.tool_calls'))
    await userEvent.click(screen.getByRole('button', { name: 'Last 30 days' }))
    await waitFor(() => expect(asked()).toContain('/integrations/usage?from=2026-10-07&to=2026-11-05&metric=ai.tool_calls'))
  })

  it('shows one metric alone when filtered', async () => {
    render([{ path: '/integrations/usage', body: [rows[0]] }], '/integrations/admin/usage?from=2026-11-03&to=2026-11-03&metric=provider.calls')
    expect(await screen.findByRole('heading', { name: 'Per day' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Day', 'Provider calls', 'Chart'])
  })

  it('refuses a range the server would refuse, without asking it', async () => {
    render([{ path: '/integrations/usage', body: [] }], '/integrations/admin/usage?from=2026-11-06&to=2026-11-05')
    expect(await screen.findByText('"From" cannot be after "To".')).toBeInTheDocument()
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true')
    mock?.restore()
    render([{ path: '/integrations/usage', body: [] }], '/integrations/admin/usage?from=2024-01-01&to=2025-01-01')
    expect(await screen.findByText('The range can span 366 days at most.')).toBeInTheDocument()
    expect(asked()).toEqual([])
  })

  it('says when usage cannot be read', async () => {
    render([{ path: '/integrations/usage', status: 400, body: { title: 'Bad Request', detail: 'Invalid metric' } }], '/integrations/admin/usage?metric=x')
    expect(await screen.findByText(/Invalid metric/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'x' })).toHaveAttribute('aria-pressed', 'true')
  })
})
