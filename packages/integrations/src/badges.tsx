import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { absoluteTime, relativeTime } from '@wasichai/core'
import { Badge, cn } from '@wasichai/ui'
import type { ConnectionHealth, ConnectionStatus, EndpointStatus, EventStatus, Maturity } from './types'

// the theme's tokens only. every badge says its state in words too: colour is never the only cue
const TONES = {
  brand: '',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-muted text-ink-muted'
}

export type Tone = keyof typeof TONES

export function ToneBadge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <Badge className={cn(TONES[tone])} title={title}>
      {children}
    </Badge>
  )
}

const MATURITY: Record<Maturity, Tone> = { TESTED: 'success', IMPLEMENTED: 'brand', DECLARED: 'muted' }
const STATUS: Record<ConnectionStatus, Tone> = { ACTIVE: 'success', NEEDS_REAUTH: 'warning', DISABLED: 'muted', ERROR: 'danger' }
const HEALTH: Record<ConnectionHealth, Tone> = { UNKNOWN: 'muted', HEALTHY: 'success', DEGRADED: 'warning', FAILING: 'danger' }
const EVENT: Record<EventStatus, Tone> = { RECEIVED: 'brand', PROCESSED: 'success', IGNORED: 'muted', FAILED: 'danger' }
const ENDPOINT: Record<EndpointStatus, Tone> = { PENDING_VERIFICATION: 'warning', ACTIVE: 'success', DISABLED: 'muted' }

// "READ · TESTED": the capability and how far the connector got with it
export function MaturityBadge({ maturity, label }: { maturity: Maturity; label?: string }) {
  const { t } = useTranslation('integrations')
  const text = t(`maturity.${maturity}`)
  return (
    <ToneBadge tone={MATURITY[maturity]} title={t(`maturityHint.${maturity}`)}>
      {label ? `${label} · ${text}` : text}
    </ToneBadge>
  )
}

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation('integrations')
  return <ToneBadge tone={STATUS[status]}>{t(`connectionStatus.${status}`)}</ToneBadge>
}

export function HealthBadge({ health }: { health: ConnectionHealth }) {
  const { t } = useTranslation('integrations')
  return <ToneBadge tone={HEALTH[health]}>{t(`health.${health}`)}</ToneBadge>
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const { t } = useTranslation('integrations')
  return <ToneBadge tone={EVENT[status]}>{t(`eventStatus.${status}`)}</ToneBadge>
}

export function EndpointStatusBadge({ status }: { status: EndpointStatus }) {
  const { t } = useTranslation('integrations')
  return <ToneBadge tone={ENDPOINT[status]}>{t(`endpointStatus.${status}`)}</ToneBadge>
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
