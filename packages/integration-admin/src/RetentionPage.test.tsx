import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockFetch, renderWithProviders, type FetchMock } from '@wasichai/testing'
import { integrationAdminModule } from './module'
import { RetentionPage } from './RetentionPage'
import { integrationsGroup } from './test/fixtures'

let mock: FetchMock | null = null
afterEach(() => mock?.restore())

describe('RetentionPage', () => {
  it('explains the documented defaults, read only, without asking the server', () => {
    mock = mockFetch([])
    renderWithProviders(<RetentionPage />, { modules: [integrationsGroup, integrationAdminModule()], language: 'en' })
    expect(screen.getByText(/Read only: retention is server configuration/)).toBeInTheDocument()
    const rows = screen.getAllByRole('row').map((row) => row.textContent)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.stringContaining('events'),
        expect.stringContaining('usageIntegrations400 days'),
        expect.stringContaining('sync.conflictsSynchronization180 days'),
        expect.stringContaining('wasichai.integrations.retention.batch-size1000')
      ])
    )
    expect(screen.getByText('Each task is changed with wasichai.integrations.retention.max-age.<task>; 0 keeps it forever.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Operations guide › Retention/ })).toHaveAttribute(
      'href',
      'https://github.com/wasichai/integrations/blob/main/docs/guides/operations.md#retention'
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    // nothing of this module's own: the only call is core's (preferences)
    expect(mock.calls.filter((call) => call.path.startsWith('/integrations'))).toEqual([])
  })
})
