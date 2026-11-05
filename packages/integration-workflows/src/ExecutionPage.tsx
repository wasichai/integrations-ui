import { useQuery } from '@tanstack/react-query'
import { Ban, Check, ListTree, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { EmptyState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, ConfirmDialog, Label, Textarea } from '@wasichai/ui'
import { executionQuery, isTerminal, useCancelExecution, useDecideApproval } from './api'
import { ExecutionStatusBadge, StepStatusBadge, Time } from './badges'
import { useCanManageWorkflows } from './permissions'
import type { ExecutionDetail, StepExecution } from './types'

const COMMENT_MAX = 2000

export function ExecutionPage() {
  const { executionId } = useParams()
  const query = useQuery(executionQuery(executionId))
  return <QueryState query={query}>{(detail) => <ExecutionView detail={detail} />}</QueryState>
}

function ExecutionView({ detail }: { detail: ExecutionDetail }) {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const links = useWasichaiLinks()
  const canManage = useCanManageWorkflows()
  const cancel = useCancelExecution()
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const { execution, steps } = detail
  const over = isTerminal(execution.status)

  const confirmCancel = async () => {
    setCancelError(null)
    try {
      await cancel.mutateAsync(execution.id)
      setCancelling(false)
    } catch (cause) {
      setCancelError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-workflows:workflow', { workflowId: execution.workflowId })} className="text-sm text-ink-muted hover:text-ink">
            {t('execution.back')}
          </Link>
        }
        title={t('execution.title')}
        subtitle={execution.id}
        actions={
          canManage && !over ? (
            <Button variant="secondary" onClick={() => setCancelling(true)}>
              <Ban className="size-4" />
              {t('execution.cancel')}
            </Button>
          ) : null
        }
      >
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <ExecutionStatusBadge status={execution.status} />
          <Fact label={t('executions.trigger')}>{t(`triggerType.${execution.triggerType}`)}</Fact>
          <Fact label={t('executions.version')}>{execution.version}</Fact>
          <Fact label={t('execution.queued')}>
            <Time value={execution.createdAt} />
          </Fact>
          <Fact label={t('execution.finished')}>
            <Time value={execution.finishedAt} />
          </Fact>
          <Fact label={t('execution.correlation')}>
            <code className="text-xs">{execution.correlationId}</code>
          </Fact>
        </dl>
      </PageHeader>
      <div className="space-y-5 p-4 md:p-8">
        {execution.error ? <Alert tone="danger">{execution.error}</Alert> : null}
        <Card>
          <CardHeader>
            <CardTitle>{t('execution.steps')}</CardTitle>
          </CardHeader>
          {steps.length === 0 ? (
            <EmptyState icon={ListTree} title={t('execution.noSteps')} />
          ) : (
            <ol className="divide-y divide-border">
              {steps.map((step, index) => (
                <StepRow key={`${step.stepId}-${index}`} executionId={execution.id} step={step} canDecide={canManage && !over} />
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('execution.trigger')}</CardTitle>
          </CardHeader>
          <CardBody>
            <Json value={execution.trigger} label={t('execution.trigger')} />
          </CardBody>
        </Card>
      </div>
      {cancelling ? (
        <ConfirmDialog
          title={t('execution.cancel')}
          description={t('execution.cancelConfirm')}
          confirmLabel={t('execution.cancel')}
          busy={cancel.isPending}
          error={cancelError}
          onConfirm={() => void confirmCancel()}
          onCancel={() => setCancelling(false)}
        />
      ) : null}
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

function Json({ value, label }: { value: unknown; label: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded bg-surface-muted p-2 text-xs" aria-label={label}>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function StepRow({ executionId, step, canDecide }: { executionId: string; step: StepExecution; canDecide: boolean }) {
  const { t } = useTranslation('integration-workflows')
  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-ink">{step.stepId}</span>
        <span className="text-ink-muted">{t(`stepType.${step.type}`)}</span>
        <StepStatusBadge status={step.status} />
        {step.attempt > 1 ? <span className="text-xs text-ink-muted">{t('execution.attempt', { attempt: step.attempt })}</span> : null}
        <span className="text-xs text-ink-muted">
          <Time value={step.startedAt ?? step.createdAt} />
        </span>
        {step.waitUntil ? (
          <span className="text-xs text-warning">
            {t('execution.waitUntil')}: <Time value={step.waitUntil} />
          </span>
        ) : null}
        {step.decidedBy ? <span className="text-xs text-ink-muted">{t('execution.decidedBy', { user: step.decidedBy })}</span> : null}
      </div>
      {step.error ? <p className="text-xs text-danger">{step.error}</p> : null}
      {step.input != null || step.output != null ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted">{t('execution.data')}</summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('execution.input')}</p>
              <Json value={step.input} label={t('execution.inputOf', { step: step.stepId })} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('execution.output')}</p>
              <Json value={step.output} label={t('execution.outputOf', { step: step.stepId })} />
            </div>
          </div>
        </details>
      ) : null}
      {canDecide && step.type === 'approval' && step.status === 'WAITING' ? <Decision executionId={executionId} stepId={step.stepId} /> : null}
    </li>
  )
}

// approve or reject a waiting approval, with an optional comment
function Decision({ executionId, stepId }: { executionId: string; stepId: string }) {
  const { t } = useTranslation('integration-workflows')
  const decide = useDecideApproval()
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = `decision-${stepId}`

  const submit = async (approve: boolean) => {
    setError(null)
    try {
      await decide.mutateAsync({ executionId, stepId, approve, comment })
    } catch (cause) {
      setError(describeError(cause))
    }
  }

  return (
    <div className="space-y-2 rounded border border-border p-3">
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t('approval.comment')}</Label>
        <Textarea id={id} rows={2} maxLength={COMMENT_MAX} value={comment} onChange={(event) => setComment(event.target.value)} />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void submit(true)} disabled={decide.isPending}>
          <Check className="size-4" />
          {t('approval.approve')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void submit(false)} disabled={decide.isPending}>
          <X className="size-4" />
          {t('approval.reject')}
        </Button>
      </div>
    </div>
  )
}
