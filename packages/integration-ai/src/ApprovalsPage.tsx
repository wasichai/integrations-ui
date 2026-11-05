import { useInfiniteQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState, PageHeader, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody } from '@wasichai/ui'
import { executionsQuery } from './api'
import { Json, Time } from './badges'
import { Decision } from './Decision'
import { useCanManageTools } from './permissions'
import type { ToolExecution } from './types'

// what waits for a person: read the input, then approve (it runs once) or reject
export function ApprovalsPage() {
  const { t } = useTranslation('integration-ai')
  const links = useWasichaiLinks()
  const canManage = useCanManageTools()
  const query = useInfiniteQuery(executionsQuery('PENDING_APPROVAL', null))
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)
  const pending = query.data?.pages.flatMap((page) => page.content) ?? []

  const decided = (execution: ToolExecution) =>
    setNotice({
      tone: execution.status === 'FAILED' ? 'warning' : 'success',
      text: t(`decision.done.${execution.status}`, { tool: execution.toolName, error: execution.error ?? '' })
    })

  return (
    <>
      <PageHeader title={t('approvals.title')} subtitle={t(canManage ? 'approvals.subtitle' : 'approvals.subtitleMember')} />
      <div className="space-y-5 p-4 md:p-8">
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
        {query.isPending ? (
          <LoadingState />
        ) : query.isError && !query.isFetchNextPageError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : pending.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('approvals.empty')} description={t('approvals.emptyHint')} headingLevel={2} />
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {pending.map((execution) => (
                <li key={execution.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-mono font-medium text-ink">{execution.toolName}</span>
                    <span className="text-ink-muted">{t('executions.by', { caller: execution.serviceAccount ?? execution.callerId ?? '—' })}</span>
                    <span className="text-xs text-ink-muted">
                      <Time value={execution.createdAt} />
                    </span>
                    <Link to={links.to('integration-ai:execution', { executionId: execution.id })} className="text-xs text-ink-muted hover:underline">
                      {t('executions.details')}
                    </Link>
                  </div>
                  <Json value={execution.input} label={t('execution.inputOf', { tool: execution.toolName })} />
                  {canManage ? <Decision execution={execution} onDecided={decided} /> : null}
                </li>
              ))}
            </ul>
            {query.hasNextPage ? (
              <CardBody className="flex justify-center">
                <Button variant="secondary" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {t('executions.more')}
                </Button>
              </CardBody>
            ) : null}
            {query.isFetchNextPageError ? (
              <CardBody>
                <Alert tone="danger">{describeError(query.error)}</Alert>
              </CardBody>
            ) : null}
          </Card>
        )}
      </div>
    </>
  )
}
