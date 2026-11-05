import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PageHeader, QueryState, useWasichaiLinks } from '@wasichai/core'
import { Alert, Card, CardBody, CardHeader, CardTitle } from '@wasichai/ui'
import { executionQuery } from './api'
import { ExecutionStatusBadge, Json, Time } from './badges'
import { Decision } from './Decision'
import { useCanManageTools } from './permissions'
import type { ToolExecution } from './types'

export function ExecutionPage() {
  const { executionId } = useParams()
  const query = useQuery(executionQuery(executionId))
  return <QueryState query={query}>{(execution) => <ExecutionView execution={execution} />}</QueryState>
}

function ExecutionView({ execution }: { execution: ToolExecution }) {
  const { t } = useTranslation('integration-ai')
  const links = useWasichaiLinks()
  const canManage = useCanManageTools()
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-ai:executions')} className="text-sm text-ink-muted hover:text-ink">
            {t('executions.title')}
          </Link>
        }
        title={t('execution.title', { tool: execution.toolName })}
        subtitle={execution.id}
        actions={
          canManage && execution.status === 'PENDING_APPROVAL' ? (
            <Decision
              execution={execution}
              onDecided={(decided) =>
                // the error itself shows below, from the stored execution
                setNotice({
                  tone: decided.status === 'FAILED' ? 'warning' : 'success',
                  text: t(`decision.done.${decided.status}`, { tool: decided.toolName, error: '' })
                })
              }
            />
          ) : null
        }
      >
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <ExecutionStatusBadge status={execution.status} />
          <Fact label={t('executions.caller')}>{execution.serviceAccount ?? execution.callerId ?? '—'}</Fact>
          <Fact label={t('executions.created')}>
            <Time value={execution.createdAt} />
          </Fact>
          <Fact label={t('execution.started')}>
            <Time value={execution.startedAt} />
          </Fact>
          <Fact label={t('executions.finished')}>
            <Time value={execution.finishedAt} />
          </Fact>
          {execution.correlationId ? (
            <Fact label={t('execution.correlation')}>
              <code className="text-xs">{execution.correlationId}</code>
            </Fact>
          ) : null}
        </dl>
      </PageHeader>
      <div className="space-y-5 p-4 md:p-8">
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
        {execution.status === 'PENDING_APPROVAL' ? <Alert tone="notice">{t('execution.pending')}</Alert> : null}
        {execution.error ? (
          <Alert tone="danger" title={execution.errorKind ? t(`errorKind.${execution.errorKind}`) : undefined}>
            {execution.error}
          </Alert>
        ) : null}
        {execution.decidedBy ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('execution.decision')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <Fact label={t('execution.decidedBy')}>{execution.decidedBy}</Fact>
                <Fact label={t('execution.decidedAt')}>
                  <Time value={execution.decidedAt} />
                </Fact>
                {execution.reason ? <Fact label={t('execution.reason')}>{execution.reason}</Fact> : null}
              </dl>
            </CardBody>
          </Card>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('execution.input')}</CardTitle>
            </CardHeader>
            <CardBody>
              <Json value={execution.input} label={t('execution.input')} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('execution.output')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {execution.outputTruncated ? <Alert tone="warning">{t('execution.truncated')}</Alert> : null}
              {execution.output == null ? (
                <p className="text-sm text-ink-muted">{t('execution.noOutput')}</p>
              ) : (
                <Json value={execution.output} label={t('execution.output')} />
              )}
              <p className="text-xs text-ink-muted">{t('execution.summaryHint')}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-ink-muted">{label}:</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}
