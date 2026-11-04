import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { absoluteTime, relativeTime } from '@wasichai/core'
import { Badge, cn } from '@wasichai/ui'
import type { ConflictStatus, DefinitionStatus, RunStatus } from './types'

// the theme's tokens only. every badge says its state in words too: colour is never the only cue
const TONES = {
  brand: '',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-muted text-ink-muted'
}

type Tone = keyof typeof TONES

function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge className={cn(TONES[tone])}>{children}</Badge>
}

const DEFINITION: Record<DefinitionStatus, Tone> = { DRAFT: 'muted', ACTIVE: 'success', PAUSED: 'warning' }
const RUN: Record<RunStatus, Tone> = { QUEUED: 'brand', RUNNING: 'brand', SUCCEEDED: 'success', PARTIAL: 'warning', FAILED: 'danger' }
const CONFLICT: Record<ConflictStatus, Tone> = { OPEN: 'warning', RESOLVED: 'success' }

export function DefinitionStatusBadge({ status }: { status: DefinitionStatus }) {
  const { t } = useTranslation('integration-sync')
  return <ToneBadge tone={DEFINITION[status]}>{t(`definitionStatus.${status}`)}</ToneBadge>
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { t } = useTranslation('integration-sync')
  return <ToneBadge tone={RUN[status]}>{t(`runStatus.${status}`)}</ToneBadge>
}

export function ConflictStatusBadge({ status }: { status: ConflictStatus }) {
  const { t } = useTranslation('integration-sync')
  return <ToneBadge tone={CONFLICT[status]}>{t(`conflictStatus.${status}`)}</ToneBadge>
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
