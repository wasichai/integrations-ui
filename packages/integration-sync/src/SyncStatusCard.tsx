import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, QueryState } from '@wasichai/core'
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { statusQuery } from './api'
import { RunStatusBadge, Time } from './badges'
import type { LinkState, SyncStatus } from './types'

const LINK_STATES: LinkState[] = ['LINKED', 'PENDING_CREATE', 'CONFLICT', 'ORPHANED']

// what the server says of the definition (GET /status): nothing counted here
export function SyncStatusCard({ definitionId }: { definitionId: string }) {
  const { t } = useTranslation('integration-sync')
  const query = useQuery(statusQuery(definitionId))
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('status.title')}</CardTitle>
          {query.data?.queuedOrRunning ? <Badge>{t('status.queuedOrRunning')}</Badge> : null}
        </div>
      </CardHeader>
      <QueryState query={query}>{(status) => <StatusBody status={status} />}</QueryState>
    </Card>
  )
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  )
}

function StatusBody({ status }: { status: SyncStatus }) {
  const { t } = useTranslation('integration-sync')
  const run = status.lastRun
  // never ran: no run, no feed, nothing to show but when it will
  if (!run && status.cursors.length === 0 && LINK_STATES.every((state) => !status.links[state])) {
    return (
      <EmptyState
        icon={Activity}
        title={t('status.empty')}
        description={status.nextScheduledAt ? <Time value={status.nextScheduledAt} /> : undefined}
        headingLevel={3}
      />
    )
  }
  return (
    <CardBody>
      <div className="space-y-4">
        {status.lastError ? (
          <Alert tone={status.errorKind === 'transient' ? 'warning' : 'danger'} title={t(`status.errorKind.${status.errorKind ?? 'permanent'}`)}>
            {status.lastError}
          </Alert>
        ) : run?.status === 'PARTIAL' ? (
          // degraded: the run finished, some records did not
          <Alert tone="warning">{t('status.partial', { count: run.failed })}</Alert>
        ) : null}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Term label={t('status.lastRun')}>
            {run ? (
              <span className="flex flex-wrap items-center gap-2">
                <RunStatusBadge status={run.status} />
                <Time value={run.finishedAt ?? run.startedAt ?? run.queuedAt} />
              </span>
            ) : (
              <Time value={null} />
            )}
          </Term>
          <Term label={t('status.lastSuccess')}>
            <Time value={status.lastSuccessAt} />
          </Term>
          <Term label={t('status.nextRun')}>
            <Time value={status.nextScheduledAt} />
          </Term>
          <Term label={t('status.nextReconcile')}>
            <Time value={status.nextReconcileAt} />
          </Term>
        </dl>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Term label={t('status.links')}>
            <ul className="space-y-0.5">
              {LINK_STATES.map((state) => (
                <li key={state}>
                  {t(`linkState.${state}`)}: <span className="font-medium">{status.links[state] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Term>
          <Term label={t('status.cursors')}>
            {status.cursors.length === 0 ? (
              <span className="text-ink-muted">{t('status.noCursors')}</span>
            ) : (
              <ul className="space-y-0.5">
                {status.cursors.map((cursor) => (
                  <li key={cursor.side}>
                    {t('status.cursor', { side: cursor.side, checkpoint: cursor.checkpoint ?? t('status.fromStart') })}{' '}
                    <span className="text-xs text-ink-muted">
                      <Time value={cursor.updatedAt} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Term>
        </dl>
      </div>
    </CardBody>
  )
}
