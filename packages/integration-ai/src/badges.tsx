import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { absoluteTime, relativeTime } from '@wasichai/core'
import { Badge, cn } from '@wasichai/ui'
import type { ExecutionStatus, Tool } from './types'

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
  PENDING_APPROVAL: 'warning',
  RUNNING: 'brand',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REJECTED: 'muted'
}

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const { t } = useTranslation('integration-ai')
  return <ToneBadge tone={EXECUTION[status]}>{t(`executionStatus.${status}`)}</ToneBadge>
}

// enabled or disabled, then whether a person approves each call
export function ToolBadges({ tool }: { tool: Tool }) {
  const { t } = useTranslation('integration-ai')
  return (
    <span className="inline-flex flex-wrap gap-1">
      <ToneBadge tone={tool.enabled ? 'success' : 'muted'}>{t(tool.enabled ? 'tool.enabled' : 'tool.disabled')}</ToneBadge>
      {tool.approvalRequired ? <ToneBadge tone="warning">{t('tool.approval')}</ToneBadge> : null}
    </span>
  )
}

// what the tool does: the action, or operation and resource
export function ToolTarget({ tool }: { tool: Tool }) {
  const { t } = useTranslation('integration-ai')
  if (tool.kind === 'ACTION') return <>{t('tool.actionTarget', { action: tool.action })}</>
  return <>{t('tool.recordTarget', { operation: tool.operation ? t(`operation.${tool.operation}`) : '', resource: tool.resource })}</>
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

export function Json({ value, label }: { value: unknown; label: string }) {
  return (
    <pre className="max-h-80 overflow-auto rounded bg-surface-muted p-2 text-xs" aria-label={label}>
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}
