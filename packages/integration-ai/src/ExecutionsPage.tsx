import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState, PageHeader, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, Table, Td, Th } from '@wasichai/ui'
import { executionsQuery, toolsQuery } from './api'
import { ExecutionStatusBadge, Time } from './badges'
import { ALL, Pick } from './fields'
import { useCanManageTools } from './permissions'
import { EXECUTION_STATUSES } from './schema'
import type { ExecutionStatus } from './types'

// every tool execution, newest first. the filters live in the url (?status=&tool=), so a tool page links here
export function ExecutionsPage() {
  const { t } = useTranslation('integration-ai')
  const links = useWasichaiLinks()
  const canManage = useCanManageTools()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = EXECUTION_STATUSES.includes(statusParam as ExecutionStatus) ? (statusParam as ExecutionStatus) : null
  const tool = params.get('tool') || null
  const query = useInfiniteQuery(executionsQuery(status, tool))
  const tools = useQuery(toolsQuery())
  const executions = query.data?.pages.flatMap((page) => page.content) ?? []

  const setFilter = (key: 'status' | 'tool', value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true }
    )

  // a deleted tool's executions stay: its name, once in the url, stays an option
  const names = [...new Set([...(tools.data ?? []).map((candidate) => candidate.name), ...(tool ? [tool] : [])])]

  return (
    <>
      <PageHeader title={t('executions.title')} subtitle={t(canManage ? 'executions.subtitle' : 'executions.subtitleMember')} />
      <div className="p-4 md:p-8">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('executions.filter')}>
              {[null, ...EXECUTION_STATUSES].map((value) => (
                <Button
                  key={value ?? 'all'}
                  variant={status === value ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={status === value}
                  onClick={() => setFilter('status', value)}
                >
                  {value ? t(`executionStatus.${value}`) : t('executions.all')}
                </Button>
              ))}
            </div>
            <div className="max-w-xs">
              <Pick
                id="executions-tool"
                label={t('executions.tool')}
                value={tool ?? ALL}
                onChange={(value) => setFilter('tool', value === ALL ? null : value)}
                options={[{ value: ALL, label: t('executions.allTools') }, ...names.map((name) => ({ value: name, label: name }))]}
              />
            </div>
          </CardBody>
          {query.isPending ? (
            <LoadingState />
          ) : query.isError && !query.isFetchNextPageError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : executions.length === 0 ? (
            <EmptyState icon={History} title={t(status || tool ? 'executions.emptyFiltered' : 'executions.empty')} />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>{t('executions.status')}</Th>
                    <Th>{t('executions.tool')}</Th>
                    <Th>{t('executions.caller')}</Th>
                    <Th>{t('executions.created')}</Th>
                    <Th>{t('executions.finished')}</Th>
                    <Th>{t('executions.error')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution.id}>
                      <Td>
                        <Link
                          to={links.to('integration-ai:execution', { executionId: execution.id })}
                          className="hover:underline"
                          aria-label={t('executions.open', { status: t(`executionStatus.${execution.status}`), tool: execution.toolName })}
                        >
                          <ExecutionStatusBadge status={execution.status} />
                        </Link>
                      </Td>
                      <Td className="font-mono text-sm">{execution.toolName}</Td>
                      <Td className="text-ink-muted">{execution.serviceAccount ?? execution.callerId ?? '—'}</Td>
                      <Td>
                        <Time value={execution.createdAt} />
                      </Td>
                      <Td>
                        <Time value={execution.finishedAt} />
                      </Td>
                      <Td className="max-w-sm text-xs text-danger">{execution.errorKind ? t(`errorKind.${execution.errorKind}`) : ''}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
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
            </>
          )}
        </Card>
      </div>
    </>
  )
}
