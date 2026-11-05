import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { CircleCheck, RotateCw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Table, Td, Th, cn } from '@wasichai/ui'
import { connectionOptionsQuery, failedEventsQuery, healthQuery, jobsQuery, useReplayEvent, useRetryJob } from './api'
import { ConnectionStatusBadge, HealthBadge, JobStatusBadge, Time, ToneBadge } from './badges'
import { CONNECTION_STATUSES, JOB_STATUSES } from './constants'
import { useCanManageIntegrations } from './permissions'
import type { ConnectionHealthView, Health, IntegrationEvent, Job, JobStatus } from './types'

// a count that needs someone's attention is drawn in its tone
const ALARMING = new Set<string>(['NEEDS_REAUTH', 'ERROR', 'DEAD'])
// GET /jobs has no cursor: a longer list is a bigger limit, up to the server's 500
const JOB_LIMITS = [50, 200, 500]

type Notice = { tone: 'success' | 'danger'; text: string } | null

// health, jobs and dead letters of the tenant. each part loads and fails on its own: one down leaves the rest
export function SystemPage() {
  const { t } = useTranslation('integration-admin')
  const canManage = useCanManageIntegrations()
  const health = useQuery(healthQuery())

  return (
    <>
      <PageHeader title={t('system.title')} subtitle={t('system.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <QueryState query={health}>{(data) => <Summary health={data} />}</QueryState>
        {canManage ? <Jobs /> : <p className="text-sm text-ink-muted">{t('jobs.managersOnly')}</p>}
        <FailedEvents canReplay={canManage} />
      </div>
    </>
  )
}

function Count({ label, value, alarming }: { label: string; value: number; alarming: boolean }) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={cn('text-2xl font-semibold', alarming && value > 0 ? 'text-danger' : 'text-ink')}>{value}</dd>
    </div>
  )
}

function Summary({ health }: { health: Health }) {
  const { t } = useTranslation('integration-admin')
  const dead = health.jobs.DEAD ?? 0
  const now = Date.now()
  const paused = health.failing.filter((connection) => connection.rateLimitedUntil && Date.parse(connection.rateLimitedUntil) > now)

  return (
    <>
      {health.failing.length > 0 || dead > 0 ? (
        <Alert tone="warning">
          {[health.failing.length > 0 ? t('system.degraded', { count: health.failing.length }) : null, dead > 0 ? t('system.dead', { count: dead }) : null]
            .filter(Boolean)
            .join(' ')}
        </Alert>
      ) : (
        <Alert tone="success">{t('system.allGood')}</Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('system.connections')}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CONNECTION_STATUSES.map((status) => (
                <Count key={status} label={t(`connectionStatus.${status}`)} value={health.connections[status] ?? 0} alarming={ALARMING.has(status)} />
              ))}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('system.jobs')}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {JOB_STATUSES.map((status) => (
                <Count key={status} label={t(`jobStatus.${status}`)} value={health.jobs[status] ?? 0} alarming={ALARMING.has(status)} />
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink-muted">{t('system.jobsHint')}</p>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('system.paused')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {paused.length === 0 ? (
            <p className="text-sm">{t('system.noPaused')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {paused.map((connection) => (
                <li key={connection.id}>
                  <ConnectionName connection={connection} /> · {t('system.pausedUntil')} <Time value={connection.rateLimitedUntil} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">{t('system.pausedHint')}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('system.failing')}</CardTitle>
        </CardHeader>
        {health.failing.length === 0 ? (
          <EmptyState icon={CircleCheck} title={t('system.noFailing')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('system.connection')}</Th>
                <Th>{t('system.status')}</Th>
                <Th>{t('system.health')}</Th>
                <Th>{t('system.lastError')}</Th>
                <Th>{t('system.lastValidated')}</Th>
              </tr>
            </thead>
            <tbody>
              {health.failing.map((connection) => (
                <tr key={connection.id}>
                  <Td>
                    <ConnectionName connection={connection} />
                    <span className="block text-xs text-ink-muted">{connection.connectorId}</span>
                  </Td>
                  <Td>
                    <ConnectionStatusBadge status={connection.status} />
                  </Td>
                  <Td>
                    <HealthBadge health={connection.health} />
                  </Td>
                  <Td className="max-w-sm text-xs text-danger">{connection.lastError ?? '—'}</Td>
                  <Td>
                    <Time value={connection.lastValidatedAt} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

// the connection page is @wasichai/integrations': linked only when that module is registered
function ConnectionName({ connection }: { connection: Pick<ConnectionHealthView, 'id' | 'name'> }) {
  const links = useWasichaiLinks()
  if (!links.has('integrations:connection')) return <span className="font-medium">{connection.name}</span>
  return (
    <Link to={links.to('integrations:connection', { connectionId: connection.id })} className="font-medium hover:underline">
      {connection.name}
    </Link>
  )
}

// every job, DEAD first: the dead letters. a permanent error fails again as it is: said, not hidden
function Jobs() {
  const { t } = useTranslation(['integration-admin', 'common'])
  const [status, setStatus] = useState<JobStatus | null>('DEAD')
  const [kindDraft, setKindDraft] = useState('')
  const [kind, setKind] = useState<string | null>(null)
  const [limit, setLimit] = useState(JOB_LIMITS[0])
  const query = useQuery(jobsQuery(status, kind, limit))
  const retry = useRetryJob()
  const [notice, setNotice] = useState<Notice>(null)

  const applyKind = (event: FormEvent) => {
    event.preventDefault()
    setKind(kindDraft.trim() || null)
    setLimit(JOB_LIMITS[0])
  }

  const runRetry = async (job: Job) => {
    setNotice(null)
    try {
      await retry.mutateAsync(job.id)
      setNotice({ tone: 'success', text: t('jobs.retried', { kind: job.kind }) })
    } catch (cause) {
      setNotice({ tone: 'danger', text: describeError(cause) })
    }
  }

  const nextLimit = JOB_LIMITS.find((candidate) => candidate > limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('jobs.title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('jobs.statusFilter')}>
          {[null, ...JOB_STATUSES].map((value) => (
            <Button
              key={value ?? 'all'}
              variant={status === value ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value)
                setLimit(JOB_LIMITS[0])
              }}
            >
              {value ? t(`jobStatus.${value}`) : t('jobs.all')}
            </Button>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={applyKind}>
          <div className="space-y-1.5">
            <Label htmlFor="jobs-kind">{t('jobs.kind')}</Label>
            <Input id="jobs-kind" value={kindDraft} onChange={(event) => setKindDraft(event.target.value)} placeholder="integrations.sync.run" />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            {t('jobs.apply')}
          </Button>
        </form>
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
      </CardBody>
      <QueryState query={query}>
        {(jobs) =>
          jobs.length === 0 ? (
            <EmptyState icon={CircleCheck} title={t(status === 'DEAD' && !kind ? 'jobs.noDead' : 'jobs.empty')} />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>{t('jobs.kind')}</Th>
                    <Th>{t('jobs.status')}</Th>
                    <Th>{t('jobs.attempts')}</Th>
                    <Th>{t('jobs.lastError')}</Th>
                    <Th>{t('jobs.updated')}</Th>
                    <Th>
                      <span className="sr-only">{t('common:common.actions')}</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <Td>
                        <span className="font-mono text-sm">{job.kind}</span>
                        {job.correlationId ? <span className="block text-xs text-ink-muted">{job.correlationId}</span> : null}
                      </Td>
                      <Td>
                        <JobStatusBadge status={job.status} />
                      </Td>
                      <Td>
                        {job.attempts}/{job.maxAttempts}
                        {job.status === 'PENDING' && job.attempts > 0 ? (
                          <span className="block text-xs text-ink-muted">
                            {t('jobs.nextAttempt')} <Time value={job.nextAttemptAt} />
                          </span>
                        ) : null}
                      </Td>
                      <Td className="max-w-sm">
                        {job.errorKind ? <ToneBadge tone={job.retryable ? 'warning' : 'danger'}>{job.errorKind}</ToneBadge> : null}
                        <span className="mt-1 block text-xs text-danger">{job.lastError ?? ''}</span>
                        {job.status === 'DEAD' && !job.retryable ? <span className="block text-xs text-ink-muted">{t('jobs.permanent')}</span> : null}
                      </Td>
                      <Td>
                        <Time value={job.updatedAt} />
                      </Td>
                      <Td>
                        {job.status === 'DEAD' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void runRetry(job)}
                            disabled={retry.isPending}
                            aria-label={t('jobs.retryNamed', { kind: job.kind })}
                          >
                            <RotateCw className="size-4" />
                            {t('jobs.retry')}
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {jobs.length >= limit ? (
                <CardBody className="flex flex-wrap items-center justify-center gap-3 text-sm text-ink-muted">
                  {t('jobs.limited', { count: limit })}
                  {nextLimit ? (
                    <Button variant="secondary" size="sm" onClick={() => setLimit(nextLimit)}>
                      {t('jobs.more', { count: nextLimit })}
                    </Button>
                  ) : null}
                </CardBody>
              ) : null}
            </>
          )
        }
      </QueryState>
    </Card>
  )
}

// events a listener threw on, every connection. the job retries them; a replay queues one again after a fix
function FailedEvents({ canReplay }: { canReplay: boolean }) {
  const { t } = useTranslation(['integration-admin', 'common'])
  const query = useInfiniteQuery(failedEventsQuery())
  const connections = useQuery(connectionOptionsQuery())
  const replay = useReplayEvent()
  const [notice, setNotice] = useState<Notice>(null)
  const events = query.data?.pages.flatMap((page) => page.content) ?? []
  const nameOf = (id: string) => connections.data?.find((connection) => connection.id === id)?.name ?? id

  const runReplay = async (event: IntegrationEvent) => {
    setNotice(null)
    try {
      await replay.mutateAsync(event.eventId)
      setNotice({ tone: 'success', text: t('events.replayed', { type: event.eventType }) })
    } catch (cause) {
      setNotice({ tone: 'danger', text: describeError(cause) })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('events.title')}</CardTitle>
      </CardHeader>
      {notice ? (
        <CardBody>
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        </CardBody>
      ) : null}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError && !query.isFetchNextPageError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t('events.none')} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('events.type')}</Th>
                <Th>{t('system.connection')}</Th>
                <Th>{t('events.error')}</Th>
                <Th>{t('events.received')}</Th>
                {canReplay ? (
                  <Th>
                    <span className="sr-only">{t('common:common.actions')}</span>
                  </Th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.eventId}>
                  <Td>
                    <span className="font-mono text-sm">{event.eventType}</span>
                    {event.resourceType ? (
                      <span className="block text-xs text-ink-muted">
                        {event.resourceType}
                        {event.resourceId ? ` · ${event.resourceId}` : ''}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {nameOf(event.connectionId)}
                    <span className="block text-xs text-ink-muted">{event.provider}</span>
                  </Td>
                  <Td className="max-w-sm text-xs text-danger">{event.error ?? '—'}</Td>
                  <Td>
                    <Time value={event.receivedAt} />
                  </Td>
                  {canReplay ? (
                    <Td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void runReplay(event)}
                        disabled={replay.isPending}
                        aria-label={t('events.replayNamed', { type: event.eventType })}
                      >
                        <RotateCw className="size-4" />
                        {t('events.replay')}
                      </Button>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
          {query.hasNextPage ? (
            <CardBody className="flex justify-center">
              <Button variant="secondary" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {t('events.more')}
              </Button>
            </CardBody>
          ) : null}
          {query.isFetchNextPageError ? (
            <CardBody>
              <Alert tone="danger">{describeError(query.error)}</Alert>
            </CardBody>
          ) : null}
        </>
      )}
    </Card>
  )
}
