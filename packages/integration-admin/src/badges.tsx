import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { absoluteTime, relativeTime } from '@wasichai/core'
import { Badge, cn } from '@wasichai/ui'
import type { ConnectionHealth, ConnectionStatus, JobStatus, Maturity } from './types'

// the theme's tokens only. every badge says its state in words too: colour is never the only cue
const TONES = {
  brand: '',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-muted text-ink-muted'
}

type Tone = keyof typeof TONES

export function ToneBadge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <Badge className={cn(TONES[tone])} title={title}>
      {children}
    </Badge>
  )
}

const MATURITY: Record<Maturity, Tone> = { TESTED: 'success', IMPLEMENTED: 'brand', DECLARED: 'muted' }
const JOB: Record<JobStatus, Tone> = { PENDING: 'brand', RUNNING: 'brand', SUCCEEDED: 'success', DEAD: 'danger' }
const STATUS: Record<ConnectionStatus, Tone> = { ACTIVE: 'success', NEEDS_REAUTH: 'warning', DISABLED: 'muted', ERROR: 'danger' }
const HEALTH: Record<ConnectionHealth, Tone> = { UNKNOWN: 'muted', HEALTHY: 'success', DEGRADED: 'warning', FAILING: 'danger' }

// "READ · Tested": the capability and how far the connector got with it
export function MaturityBadge({ maturity, label }: { maturity: Maturity; label: string }) {
  const { t } = useTranslation('integration-admin')
  return (
    <ToneBadge tone={MATURITY[maturity]} title={t(`maturityHint.${maturity}`)}>
      {label} · {t(`maturity.${maturity}`)}
    </ToneBadge>
  )
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useTranslation('integration-admin')
  return <ToneBadge tone={JOB[status]}>{t(`jobStatus.${status}`)}</ToneBadge>
}

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation('integration-admin')
  return <ToneBadge tone={STATUS[status]}>{t(`connectionStatus.${status}`)}</ToneBadge>
}

export function HealthBadge({ health }: { health: ConnectionHealth }) {
  const { t } = useTranslation('integration-admin')
  return <ToneBadge tone={HEALTH[health]}>{t(`health.${health}`)}</ToneBadge>
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
