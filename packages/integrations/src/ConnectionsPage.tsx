import { useQuery } from '@tanstack/react-query'
import { Cable, PlayCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, ConfirmDialog, Table, Td, Th } from '@wasichai/ui'
import { connectionsQuery, useDeleteConnection, useTestConnection } from './api'
import { ConnectionStatusBadge, HealthBadge, Time } from './badges'
import { useCanManageIntegrations } from './permissions'
import type { Connection, ConnectionTest } from './types'

// the codes the oauth callback sends back (ConnectionService.completeOAuth). anything else reads as unknown
export const OAUTH_ERRORS = [
  'invalid_state',
  'access_denied',
  'provider_error',
  'token_refused',
  'provider_unavailable',
  'provider_not_configured',
  'missing_code',
  'unknown_connector'
] as const

type Notice = { tone: 'success' | 'danger' | 'warning'; text: string }

export function ConnectionsPage() {
  const { t } = useTranslation(['integrations', 'common'])
  const links = useWasichaiLinks()
  const query = useQuery(connectionsQuery())
  const canManage = useCanManageIntegrations()
  const [params, setParams] = useSearchParams()
  const test = useTestConnection()
  const remove = useDeleteConnection()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [deleting, setDeleting] = useState<Connection | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // back from the provider: ?status=connected&connectionId=… or ?status=error&error=<code>
  const returned = params.get('status')
  const code = params.get('error') ?? ''
  const returnedId = params.get('connectionId')
  const dismissReturn = () => setParams({}, { replace: true })

  const runTest = async (connection: Connection) => {
    setNotice(null)
    try {
      const result: ConnectionTest = await test.mutateAsync(connection.id)
      setNotice(
        result.ok
          ? { tone: 'success', text: t('connections.testOk', { name: connection.name }) }
          : { tone: result.retryable ? 'warning' : 'danger', text: t('connections.testFailed', { name: connection.name, error: result.error ?? '' }) }
      )
    } catch (cause) {
      setNotice({ tone: 'danger', text: describeError(cause) })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await remove.mutateAsync(deleting.id)
      setDeleting(null)
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader
        title={t('connections.title')}
        subtitle={t('connections.subtitle')}
        actions={
          <Button asChild variant="secondary">
            <Link to={links.to('integrations:catalog')}>{t('connections.add')}</Link>
          </Button>
        }
      />
      <div className="space-y-4 p-4 md:p-8">
        {returned === 'connected' ? (
          <Alert tone="success" title={t('oauth.connectedTitle')} onDismiss={dismissReturn}>
            {t('oauth.connected')}{' '}
            {returnedId ? (
              <Link to={links.to('integrations:connection', { connectionId: returnedId })} className="underline">
                {t('oauth.open')}
              </Link>
            ) : null}
          </Alert>
        ) : null}
        {returned === 'error' ? (
          <Alert tone="danger" title={t('oauth.errorTitle')} onDismiss={dismissReturn}>
            {t(`oauth.errors.${(OAUTH_ERRORS as readonly string[]).includes(code) ? code : 'unknown'}`, { code })}
          </Alert>
        ) : null}
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
        <QueryState query={query}>
          {(connections) =>
            connections.length === 0 ? (
              <EmptyState icon={Cable} title={t('connections.empty')} description={t('connections.emptyHint')} headingLevel={2}>
                <Button asChild variant="secondary" size="sm">
                  <Link to={links.to('integrations:catalog')}>{t('connections.add')}</Link>
                </Button>
              </EmptyState>
            ) : (
              <Card>
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('connections.name')}</Th>
                      <Th>{t('connections.connector')}</Th>
                      <Th>{t('connections.status')}</Th>
                      <Th>{t('connections.health')}</Th>
                      <Th>{t('connections.lastValidated')}</Th>
                      <Th>
                        <span className="sr-only">{t('common.actions')}</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((connection) => (
                      <tr key={connection.id}>
                        <Td>
                          <Link to={links.to('integrations:connection', { connectionId: connection.id })} className="font-medium hover:underline">
                            {connection.name}
                          </Link>
                          <span className="block text-xs text-ink-muted">{connection.displayName ?? connection.providerAccountId ?? ''}</span>
                        </Td>
                        <Td className="text-ink-muted">{connection.connectorId}</Td>
                        <Td>
                          <ConnectionStatusBadge status={connection.status} />
                        </Td>
                        <Td>
                          <HealthBadge health={connection.health} />
                          {connection.lastError ? <span className="mt-1 block max-w-xs truncate text-xs text-danger">{connection.lastError}</span> : null}
                        </Td>
                        <Td>
                          <Time value={connection.lastValidatedAt} />
                        </Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void runTest(connection)}
                              disabled={test.isPending}
                              aria-label={t('connections.testNamed', { name: connection.name })}
                            >
                              <PlayCircle className="size-4" />
                              {t('connections.test')}
                            </Button>
                            {canManage ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteError(null)
                                  setDeleting(connection)
                                }}
                                aria-label={t('connections.deleteNamed', { name: connection.name })}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )
          }
        </QueryState>
      </div>
      {deleting ? (
        <ConfirmDialog
          title={t('connections.deleteTitle')}
          description={t('connections.deleteConfirm', { name: deleting.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}
