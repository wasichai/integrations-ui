import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { History, Link2, Pause, Pencil, Play, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState, PageHeader, QueryState, describeError, formError, useWasichaiLinks } from '@wasichai/core'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Label,
  Table,
  Td,
  Textarea,
  Th
} from '@wasichai/ui'
import { executionsQuery, useDeleteWorkflow, useIssueWebhook, useRunWorkflow, useSetPaused, versionsQuery, workflowQuery } from './api'
import { ExecutionStatusBadge, Time, WorkflowBadges } from './badges'
import { useCanManageWorkflows } from './permissions'
import type { ExecutionStatus, WebhookUrl, Workflow } from './types'

const EXECUTION_STATUSES: ExecutionStatus[] = ['QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'CANCELLED']

export function WorkflowPage() {
  const { workflowId } = useParams()
  const query = useQuery(workflowQuery(workflowId))
  return <QueryState query={query}>{(workflow) => <WorkflowDetail workflow={workflow} />}</QueryState>
}

function WorkflowDetail({ workflow }: { workflow: Workflow }) {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const canManage = useCanManageWorkflows()
  const setPaused = useSetPaused()
  const remove = useDeleteWorkflow()
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [webhook, setWebhook] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const published = workflow.status === 'PUBLISHED'

  const pause = async (paused: boolean) => {
    setNotice(null)
    try {
      await setPaused.mutateAsync({ workflowId: workflow.id, paused })
      setNotice({ tone: 'success', text: t(paused ? 'workflow.pausedNotice' : 'workflow.resumedNotice') })
    } catch (cause) {
      setNotice({ tone: 'danger', text: describeError(cause) })
    }
  }

  const confirmDelete = async () => {
    setDeleteError(null)
    try {
      await remove.mutateAsync(workflow.id)
      navigate(links.to('integration-workflows:workflows'), { replace: true })
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-workflows:workflows')} className="text-sm text-ink-muted hover:text-ink">
            {t('workflows.title')}
          </Link>
        }
        title={workflow.name}
        actions={
          canManage ? (
            <>
              <Button asChild variant="secondary">
                <Link to={links.to('integration-workflows:designer', { workflowId: workflow.id })}>
                  <Pencil className="size-4" />
                  {t('workflow.design')}
                </Link>
              </Button>
              {published ? (
                <>
                  <Button onClick={() => setRunning(true)} disabled={workflow.paused}>
                    <Play className="size-4" />
                    {t('workflow.runNow')}
                  </Button>
                  <Button variant="secondary" onClick={() => void pause(!workflow.paused)} disabled={setPaused.isPending}>
                    {workflow.paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    {t(workflow.paused ? 'workflow.resume' : 'workflow.pause')}
                  </Button>
                </>
              ) : null}
              {workflow.graph.trigger?.type === 'webhook' ? (
                <Button variant="secondary" onClick={() => setWebhook(true)}>
                  <Link2 className="size-4" />
                  {t('webhook.button')}
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} aria-label={t('workflow.delete')}>
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <WorkflowBadges workflow={workflow} />
          <span>
            {t('workflows.trigger')}: {workflow.graph.trigger?.type ? t(`triggerType.${workflow.graph.trigger.type}`) : '—'}
          </span>
          <span>
            {t('workflows.updated')}: <Time value={workflow.updatedAt} />
          </span>
        </div>
      </PageHeader>
      <div className="space-y-5 p-4 md:p-8">
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
        {!published ? <Alert tone="notice">{t('workflow.notPublished')}</Alert> : null}
        {workflow.paused ? <Alert tone="warning">{t('workflow.pausedHint')}</Alert> : null}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Executions workflowId={workflow.id} />
          </div>
          <Versions workflowId={workflow.id} />
        </div>
      </div>
      {running ? <RunDialog workflowId={workflow.id} onClose={() => setRunning(false)} /> : null}
      {webhook ? <WebhookDialog workflowId={workflow.id} onClose={() => setWebhook(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title={t('workflow.delete')}
          description={t('workflow.deleteConfirm', { name: workflow.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </>
  )
}

function Versions({ workflowId }: { workflowId: string }) {
  const { t } = useTranslation('integration-workflows')
  const links = useWasichaiLinks()
  const query = useQuery(versionsQuery(workflowId))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('versions.title')}</CardTitle>
      </CardHeader>
      <QueryState query={query}>
        {(versions) =>
          versions.length === 0 ? (
            <EmptyState icon={History} title={t('versions.empty')} />
          ) : (
            <ul className="divide-y divide-border">
              {versions.map((version) => (
                <li key={version.number} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <Link to={links.to('integration-workflows:version', { workflowId, number: String(version.number) })} className="font-medium hover:underline">
                    {t('versions.number', { number: version.number })}
                  </Link>
                  <span className="text-xs text-ink-muted">
                    <Time value={version.publishedAt} />
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Card>
  )
}

function Executions({ workflowId }: { workflowId: string }) {
  const { t } = useTranslation('integration-workflows')
  const links = useWasichaiLinks()
  const [status, setStatus] = useState<ExecutionStatus | null>(null)
  const query = useInfiniteQuery(executionsQuery(workflowId, status))
  const executions = query.data?.pages.flatMap((page) => page.content) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('executions.title')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-wrap gap-1.5" role="group" aria-label={t('executions.filter')}>
        {[null, ...EXECUTION_STATUSES].map((value) => (
          <Button
            key={value ?? 'all'}
            variant={status === value ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value ? t(`executionStatus.${value}`) : t('executions.all')}
          </Button>
        ))}
      </CardBody>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError && !query.isFetchNextPageError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : executions.length === 0 ? (
        <EmptyState icon={History} title={t(status ? 'executions.emptyFiltered' : 'executions.empty')} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('executions.status')}</Th>
                <Th>{t('executions.started')}</Th>
                <Th>{t('executions.trigger')}</Th>
                <Th>{t('executions.version')}</Th>
                <Th>{t('executions.error')}</Th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <Td>
                    <Link
                      to={links.to('integration-workflows:execution', { workflowId, executionId: execution.id })}
                      className="hover:underline"
                      aria-label={t('executions.open', { status: t(`executionStatus.${execution.status}`), id: execution.id })}
                    >
                      <ExecutionStatusBadge status={execution.status} />
                    </Link>
                  </Td>
                  <Td>
                    <Time value={execution.createdAt} />
                  </Td>
                  <Td className="text-ink-muted">{t(`triggerType.${execution.triggerType}`)}</Td>
                  <Td className="text-ink-muted">{execution.version}</Td>
                  <Td className="max-w-sm text-xs text-danger">{execution.error ?? ''}</Td>
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
  )
}

// a manual run of the published version. the payload is what trigger.payload.<path> reads
function RunDialog({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const run = useRunWorkflow()
  const [text, setText] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFieldError(null)
    setError(null)
    let payload: Record<string, unknown> | null = null
    if (text.trim()) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>
      } catch {
        payload = null
      }
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        setFieldError(t('run.notObject'))
        return
      }
    }
    try {
      const execution = await run.mutateAsync({ workflowId, payload })
      navigate(links.to('integration-workflows:execution', { workflowId, executionId: execution.id }))
    } catch (cause) {
      const problem = formError(cause)
      const payloadProblem = problem.violations.find((violation) => violation.field.startsWith('payload'))
      if (payloadProblem) setFieldError(payloadProblem.message)
      else setError(describeError(cause))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">{t('run.title')}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">{t('run.description')}</DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="run-payload">{t('run.payload')}</Label>
            <Textarea
              id="run-payload"
              rows={8}
              className="font-mono text-xs"
              value={text}
              placeholder='{"email": "ana@example.com"}'
              onChange={(event) => setText(event.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'run-payload-error' : 'run-payload-hint'}
            />
            {fieldError ? (
              <p id="run-payload-error" className="text-xs text-danger">
                {fieldError}
              </p>
            ) : (
              <p id="run-payload-hint" className="text-xs text-ink-muted">
                {t('run.payloadHint')}
              </p>
            )}
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={run.isPending}>
              <Play className="size-4" />
              {t('run.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// issuing a url rotates the secret: ask first, then show it once with a copy button
function WebhookDialog({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const issue = useIssueWebhook()
  const [issued, setIssued] = useState<WebhookUrl | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      setIssued(await issue.mutateAsync(workflowId))
    } catch (cause) {
      setError(describeError(cause))
    } finally {
      // the secret lives in this dialog's state only, never in the mutation cache
      issue.reset()
    }
  }

  const value = issued ? (issued.url ?? issued.path) : ''

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">{t('webhook.title')}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">{t('webhook.description')}</DialogDescription>
        <div className="mt-4 space-y-4">
          {issued ? (
            <>
              <Alert tone="warning">{t('webhook.once')}</Alert>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">{t(issued.url ? 'webhook.url' : 'webhook.path')}</p>
                <div className="flex items-center gap-1">
                  <code
                    className="min-w-0 flex-1 break-all rounded bg-surface-muted px-2 py-1 text-xs"
                    aria-label={t(issued.url ? 'webhook.url' : 'webhook.path')}
                  >
                    {value}
                  </code>
                  <CopyButton value={value} label={t('webhook.copy')} copiedLabel={t('webhook.copied')} />
                </div>
                {issued.url ? null : <p className="text-xs text-ink-muted">{t('webhook.noBaseUrl')}</p>}
              </div>
              <div className="flex justify-end">
                <Button onClick={onClose}>{t('common.close')}</Button>
              </div>
            </>
          ) : (
            <>
              <Alert tone="warning">{t('webhook.rotates')}</Alert>
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void submit()} disabled={issue.isPending}>
                  {t('webhook.issue')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
