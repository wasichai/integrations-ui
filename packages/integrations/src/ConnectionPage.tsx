import { useQuery } from '@tanstack/react-query'
import { Database, Eye, Inbox, PlayCircle, Plus, RotateCcw, Trash2, Webhook } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, EmptyState, ErrorState, LoadingState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, ConfirmDialog, CopyButton, Input, Label, Table, Tabs, Td, Th, cn } from '@wasichai/ui'
import {
  connectionQuery,
  resourcesQuery,
  schemaQuery,
  useCreateWebhookEndpoint,
  useDeleteConnection,
  useEvents,
  useReplayEvent,
  useTestConnection,
  useVerificationToken,
  webhookEndpointsQuery
} from './api'
import { ConnectionStatusBadge, EndpointStatusBadge, EventStatusBadge, HealthBadge, Time, ToneBadge } from './badges'
import { useCanManageIntegrations } from './permissions'
import type { Connection, WebhookEndpoint } from './types'

export function ConnectionPage() {
  const { connectionId } = useParams()
  const query = useQuery(connectionQuery(connectionId))
  return <QueryState query={query}>{(connection) => <ConnectionDetail connection={connection} />}</QueryState>
}

function ConnectionDetail({ connection }: { connection: Connection }) {
  const { t } = useTranslation(['integrations', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const canManage = useCanManageIntegrations()
  const test = useTestConnection()
  const remove = useDeleteConnection()
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const runTest = async () => {
    setNotice(null)
    try {
      const result = await test.mutateAsync(connection.id)
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
    setDeleteError(null)
    try {
      await remove.mutateAsync(connection.id)
      navigate(links.to('integrations:connections'), { replace: true })
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integrations:connections')} className="text-sm text-ink-muted hover:text-ink">
            {t('connections.title')}
          </Link>
        }
        title={connection.name}
        subtitle={[connection.connectorId, connection.displayName ?? connection.providerAccountId].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button variant="secondary" onClick={() => void runTest()} disabled={test.isPending}>
              <PlayCircle className="size-4" />
              {t('connections.test')}
            </Button>
            {canManage ? (
              <Button variant="danger" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" />
                {t('common.delete')}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            {t('connections.status')}: <ConnectionStatusBadge status={connection.status} />
          </span>
          <span className="flex items-center gap-2">
            {t('connections.health')}: <HealthBadge health={connection.health} />
          </span>
          <span className="text-ink-muted">
            {t('connections.lastValidated')}: <Time value={connection.lastValidatedAt} />
          </span>
          <span className="text-ink-muted">{t(`authType.${connection.authType}`)}</span>
        </div>
      </PageHeader>
      <div className="space-y-3 px-4 pt-4 md:px-8">
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
        {connection.status === 'NEEDS_REAUTH' ? <Alert tone="warning">{t('connection.needsReauth')}</Alert> : null}
        {connection.lastError ? (
          <Alert tone="danger" title={t('connection.lastError')}>
            {connection.lastError}
          </Alert>
        ) : null}
      </div>
      <div className="py-4">
        <Tabs
          label={t('connection.tabs')}
          tabs={[
            { id: 'resources', label: t('connection.resources'), render: () => <ResourcesTab connectionId={connection.id} /> },
            { id: 'webhooks', label: t('connection.webhooks'), render: () => <WebhooksTab connectionId={connection.id} /> },
            { id: 'events', label: t('connection.events'), render: () => <EventsTab connectionId={connection.id} /> }
          ]}
        />
      </div>
      {deleting ? (
        <ConfirmDialog
          title={t('connections.deleteTitle')}
          description={t('connections.deleteConfirm', { name: connection.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </>
  )
}

// discovery asks the provider live: the list and each schema can fail on their own
function ResourcesTab({ connectionId }: { connectionId: string }) {
  const { t } = useTranslation('integrations')
  const resources = useQuery(resourcesQuery(connectionId))
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="p-4 md:p-8">
      <QueryState query={resources}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon={Database} title={t('resources.empty')} headingLevel={2} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{t('resources.title')}</CardTitle>
                </CardHeader>
                <ul className="p-2">
                  {list.map((resource) => (
                    <li key={resource.name}>
                      <button
                        type="button"
                        aria-pressed={selected === resource.name}
                        onClick={() => setSelected(resource.name)}
                        className={cn(
                          'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted',
                          selected === resource.name ? 'bg-brand-soft text-brand-strong' : 'text-ink'
                        )}
                      >
                        <span className="block font-medium">{resource.label}</span>
                        <span className="block text-xs text-ink-muted">{resource.description ?? resource.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              {selected ? (
                <SchemaCard connectionId={connectionId} resource={selected} />
              ) : (
                <EmptyState icon={Database} title={t('resources.pick')} description={t('resources.pickHint')} />
              )}
            </div>
          )
        }
      </QueryState>
    </div>
  )
}

function SchemaCard({ connectionId, resource }: { connectionId: string; resource: string }) {
  const { t } = useTranslation('integrations')
  const schema = useQuery(schemaQuery(connectionId, resource))
  const yes = (value: boolean) => (value ? t('schema.yes') : '')

  return (
    <Card>
      <QueryState query={schema}>
        {(described) => (
          <>
            <CardHeader>
              <CardTitle>{described.label}</CardTitle>
              <p className="text-xs text-ink-muted">{described.resource}</p>
            </CardHeader>
            {described.fields.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">{t('schema.noFields')}</p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t('schema.field')}</Th>
                    <Th>{t('schema.type')}</Th>
                    <Th>{t('schema.required')}</Th>
                    <Th>{t('schema.readOnly')}</Th>
                    <Th>{t('schema.externalId')}</Th>
                    <Th>{t('schema.options')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {described.fields.map((field) => (
                    <tr key={field.name}>
                      <Td>
                        <span className="font-medium">{field.label}</span>
                        <span className="block text-xs text-ink-muted">{field.name}</span>
                      </Td>
                      <Td>
                        {field.type}
                        {field.nativeType ? <span className="block text-xs text-ink-muted">{field.nativeType}</span> : null}
                      </Td>
                      <Td>{yes(field.required)}</Td>
                      <Td>{yes(field.readOnly)}</Td>
                      <Td>{yes(field.externalId)}</Td>
                      <Td className="text-xs text-ink-muted">{field.options.join(', ')}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </QueryState>
    </Card>
  )
}

function WebhooksTab({ connectionId }: { connectionId: string }) {
  const { t } = useTranslation(['integrations', 'common'])
  const endpoints = useQuery(webhookEndpointsQuery(connectionId))
  const canManage = useCanManageIntegrations()
  const create = useCreateWebhookEndpoint(connectionId)
  const [secret, setSecret] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setCreateError(null)
    try {
      await create.mutateAsync(secret.trim() ? { secret: secret.trim() } : {})
      setSecret('')
    } catch (cause) {
      setCreateError(describeError(cause))
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-8">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('webhooks.new')}</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={submit} className="grid items-end gap-4 sm:grid-cols-[1fr_auto]" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="webhook-secret">{t('webhooks.secret')}</Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  autoComplete="new-password"
                  aria-describedby="webhook-secret-hint"
                />
              </div>
              <Button type="submit" disabled={create.isPending}>
                <Plus className="size-4" />
                {t('webhooks.create')}
              </Button>
              <p id="webhook-secret-hint" className="text-xs text-ink-muted sm:col-span-2">
                {t('webhooks.secretHint')}
              </p>
            </form>
            {createError ? (
              <Alert tone="danger" className="mt-3">
                {createError}
              </Alert>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
      <QueryState query={endpoints}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon={Webhook} title={t('webhooks.empty')} description={t('webhooks.emptyHint')} headingLevel={2} />
          ) : (
            <ul className="space-y-3">
              {list.map((endpoint) => (
                <li key={endpoint.id}>
                  <EndpointCard endpoint={endpoint} canManage={canManage} />
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  )
}

function EndpointCard({ endpoint, canManage }: { endpoint: WebhookEndpoint; canManage: boolean }) {
  const { t } = useTranslation('integrations')
  const reveal = useVerificationToken()
  // the token stays in this card's state only, gone on unmount
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)

  const showToken = async () => {
    setTokenError(null)
    try {
      setToken((await reveal.mutateAsync(endpoint.id)).token)
    } catch (cause) {
      setTokenError(cause instanceof ApiError && cause.status === 404 ? t('webhooks.noToken') : describeError(cause))
    } finally {
      reveal.reset()
    }
  }

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <EndpointStatusBadge status={endpoint.status} />
          <ToneBadge tone={endpoint.secretSet ? 'success' : 'muted'}>{endpoint.secretSet ? t('webhooks.secretSet') : t('webhooks.noSecret')}</ToneBadge>
          <span className="text-xs text-ink-muted">
            {t('webhooks.lastDelivery')}: <Time value={endpoint.lastDeliveryAt} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate rounded bg-surface-muted px-2 py-1 text-xs" title={endpoint.url}>
            {endpoint.url}
          </code>
          <CopyButton value={endpoint.url} label={t('webhooks.copyUrl')} copiedLabel={t('webhooks.copied')} />
        </div>
        {canManage ? (
          <div className="space-y-1">
            {token ? (
              <div className="flex items-center gap-1">
                <code className="min-w-0 flex-1 truncate rounded bg-surface-muted px-2 py-1 text-xs" aria-label={t('webhooks.token')}>
                  {token}
                </code>
                <CopyButton value={token} label={t('webhooks.copyToken')} copiedLabel={t('webhooks.copied')} />
                <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
                  {t('webhooks.hideToken')}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => void showToken()} disabled={reveal.isPending}>
                <Eye className="size-4" />
                {t('webhooks.showToken')}
              </Button>
            )}
            {tokenError ? <p className="text-xs text-ink-muted">{tokenError}</p> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

function EventsTab({ connectionId }: { connectionId: string }) {
  const { t } = useTranslation(['integrations', 'common'])
  const events = useEvents(connectionId)
  const canManage = useCanManageIntegrations()
  const replay = useReplayEvent()
  const [replayed, setReplayed] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const runReplay = async (eventId: string) => {
    setReplayed(null)
    try {
      await replay.mutateAsync(eventId)
      setReplayed({ tone: 'success', text: t('events.replayed') })
    } catch (cause) {
      setReplayed({ tone: 'danger', text: describeError(cause) })
    }
  }

  if (events.isPending) return <LoadingState />
  if (events.isError) return <ErrorState error={events.error} onRetry={() => void events.refetch()} />
  const list = events.data.pages.flatMap((page) => page.content)

  return (
    <div className="space-y-3 p-4 md:p-8">
      {replayed ? (
        <Alert tone={replayed.tone} onDismiss={() => setReplayed(null)}>
          {replayed.text}
        </Alert>
      ) : null}
      {list.length === 0 ? (
        <EmptyState icon={Inbox} title={t('events.empty')} description={t('events.emptyHint')} headingLevel={2} />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{t('events.received')}</Th>
                <Th>{t('events.type')}</Th>
                <Th>{t('events.resource')}</Th>
                <Th>{t('events.source')}</Th>
                <Th>{t('events.status')}</Th>
                {canManage ? (
                  <Th>
                    <span className="sr-only">{t('common.actions')}</span>
                  </Th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {list.map((event) => (
                <tr key={event.eventId}>
                  <Td>
                    <Time value={event.receivedAt} />
                  </Td>
                  <Td>
                    <span className="font-medium">{event.eventType}</span>
                    <details className="text-xs text-ink-muted">
                      <summary className="cursor-pointer">{t('events.payload')}</summary>
                      <pre className="mt-1 max-h-60 max-w-md overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(event.payload, null, 2)}</pre>
                    </details>
                  </Td>
                  <Td className="text-ink-muted">{[event.resourceType, event.resourceId].filter(Boolean).join(' ') || '—'}</Td>
                  <Td className="text-ink-muted">{t(`eventSource.${event.source}`)}</Td>
                  <Td>
                    <EventStatusBadge status={event.status} />
                    {event.error ? <span className="mt-1 block max-w-xs text-xs text-danger">{event.error}</span> : null}
                  </Td>
                  {canManage ? (
                    <Td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void runReplay(event.eventId)}
                        disabled={replay.isPending}
                        aria-label={t('events.replayNamed', { type: event.eventType })}
                      >
                        <RotateCcw className="size-4" />
                        {t('events.replay')}
                      </Button>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {events.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => void events.fetchNextPage()} disabled={events.isFetchingNextPage}>
            {events.isFetchingNextPage ? t('common.loading') : t('events.more')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
