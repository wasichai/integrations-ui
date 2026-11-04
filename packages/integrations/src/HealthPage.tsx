import { useQuery } from '@tanstack/react-query'
import { CircleCheck, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Table, Td, Th, cn } from '@wasichai/ui'
import { deadJobsQuery, healthQuery, useRetryJob } from './api'
import { ConnectionStatusBadge, HealthBadge, Time, ToneBadge } from './badges'
import { useCanManageIntegrations } from './permissions'
import type { ConnectionStatus, Health, Job, JobStatus } from './types'

const CONNECTION_STATUSES: ConnectionStatus[] = ['ACTIVE', 'NEEDS_REAUTH', 'ERROR', 'DISABLED']
const JOB_STATUSES: JobStatus[] = ['PENDING', 'RUNNING', 'SUCCEEDED', 'DEAD']
// a count that needs someone's attention is drawn in its tone
const ALARMING = new Set<string>(['NEEDS_REAUTH', 'ERROR', 'DEAD'])

export function HealthPage() {
  const { t } = useTranslation(['integrations', 'common'])
  const query = useQuery(healthQuery())
  const canManage = useCanManageIntegrations()

  return (
    <>
      <PageHeader title={t('healthPage.title')} subtitle={t('healthPage.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <QueryState query={query}>{(health) => <Summary health={health} />}</QueryState>
        {canManage ? <DeadJobs /> : null}
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
  const { t } = useTranslation('integrations')
  const links = useWasichaiLinks()
  const total = CONNECTION_STATUSES.reduce((sum, status) => sum + (health.connections[status] ?? 0), 0)

  return (
    <>
      {health.failing.length > 0 ? (
        <Alert tone="warning">{t('healthPage.degraded', { count: health.failing.length })}</Alert>
      ) : total > 0 ? (
        <Alert tone="success">{t('healthPage.allGood')}</Alert>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('healthPage.connections')}</CardTitle>
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
            <CardTitle>{t('healthPage.jobs')}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {JOB_STATUSES.map((status) => (
                <Count key={status} label={t(`jobStatus.${status}`)} value={health.jobs[status] ?? 0} alarming={ALARMING.has(status)} />
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('healthPage.failing')}</CardTitle>
        </CardHeader>
        {health.failing.length === 0 ? (
          <EmptyState icon={CircleCheck} title={t('healthPage.noFailing')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('connections.name')}</Th>
                <Th>{t('connections.status')}</Th>
                <Th>{t('connections.health')}</Th>
                <Th>{t('healthPage.lastError')}</Th>
                <Th>{t('healthPage.rateLimitedUntil')}</Th>
                <Th>{t('connections.lastValidated')}</Th>
              </tr>
            </thead>
            <tbody>
              {health.failing.map((connection) => (
                <tr key={connection.id}>
                  <Td>
                    <Link to={links.to('integrations:connection', { connectionId: connection.id })} className="font-medium hover:underline">
                      {connection.name}
                    </Link>
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
                    <Time value={connection.rateLimitedUntil} />
                  </Td>
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

// what gave up after every attempt. a permanent error fails again as it is: said, not hidden
function DeadJobs() {
  const { t } = useTranslation(['integrations', 'common'])
  const query = useQuery(deadJobsQuery())
  const retry = useRetryJob()
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const runRetry = async (job: Job) => {
    setNotice(null)
    try {
      await retry.mutateAsync(job.id)
      setNotice({ tone: 'success', text: t('jobs.retried', { kind: job.kind }) })
    } catch (cause) {
      setNotice({ tone: 'danger', text: describeError(cause) })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('jobs.dead')}</CardTitle>
      </CardHeader>
      {notice ? (
        <CardBody>
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        </CardBody>
      ) : null}
      <QueryState query={query}>
        {(jobs) =>
          jobs.length === 0 ? (
            <EmptyState icon={CircleCheck} title={t('jobs.noDead')} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t('jobs.kind')}</Th>
                  <Th>{t('jobs.attempts')}</Th>
                  <Th>{t('jobs.lastError')}</Th>
                  <Th>{t('jobs.updated')}</Th>
                  <Th>
                    <span className="sr-only">{t('common.actions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <Td>
                      <span className="font-medium">{job.kind}</span>
                      {job.correlationId ? <span className="block text-xs text-ink-muted">{job.correlationId}</span> : null}
                    </Td>
                    <Td>
                      {job.attempts}/{job.maxAttempts}
                    </Td>
                    <Td className="max-w-sm">
                      {job.errorKind ? <ToneBadge tone={job.retryable ? 'warning' : 'danger'}>{job.errorKind}</ToneBadge> : null}
                      <span className="mt-1 block text-xs text-danger">{job.lastError ?? '—'}</span>
                      {!job.retryable ? <span className="block text-xs text-ink-muted">{t('jobs.permanent')}</span> : null}
                    </Td>
                    <Td>
                      <Time value={job.updatedAt} />
                    </Td>
                    <Td>
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
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </Card>
  )
}
