import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { absoluteTime, relativeTime } from '@wasichai/core'
import { Badge, cn } from '@wasichai/ui'
import type { ExecutionStatus, StepStatus, Workflow } from './types'

// the theme's tokens only. every badge says its state in words too: colour is never the only cue
const TONES = {
  brand: '',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-muted text-ink-muted'
}

type Tone = keyof typeof TONES

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge className={cn(TONES[tone])}>{children}</Badge>
}

const EXECUTION: Record<ExecutionStatus, Tone> = {
  QUEUED: 'brand',
  RUNNING: 'brand',
  WAITING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'muted'
}
const STEP: Record<StepStatus, Tone> = { PENDING: 'muted', RUNNING: 'brand', WAITING: 'warning', SUCCEEDED: 'success', FAILED: 'danger', SKIPPED: 'muted' }

// draft or published, then paused and unpublished changes when they hold
export function WorkflowBadges({ workflow }: { workflow: Workflow }) {
  const { t } = useTranslation('integration-workflows')
  return (
    <span className="inline-flex flex-wrap gap-1">
      <ToneBadge tone={workflow.status === 'PUBLISHED' ? 'success' : 'muted'}>
        {workflow.status === 'PUBLISHED' ? t('status.published', { version: workflow.publishedVersion }) : t('status.draft')}
      </ToneBadge>
      {workflow.paused ? <ToneBadge tone="warning">{t('status.paused')}</ToneBadge> : null}
      {workflow.status === 'PUBLISHED' && workflow.unpublishedChanges ? <ToneBadge tone="brand">{t('status.unpublishedChanges')}</ToneBadge> : null}
    </span>
  )
}

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const { t } = useTranslation('integration-workflows')
  return <ToneBadge tone={EXECUTION[status]}>{t(`executionStatus.${status}`)}</ToneBadge>
}

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const { t } = useTranslation('integration-workflows')
  return <ToneBadge tone={STEP[status]}>{t(`stepStatus.${status}`)}</ToneBadge>
}

// relative to now, the exact instant on hover. null is a dash
export function Time({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-ink-muted">—</span>
  return (
    <time dateTime={value} title={absoluteTime(value)}>
      {relativeTime(value)}
    </time>
  )
}
