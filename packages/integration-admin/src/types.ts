// integration-admin shapes. mirror the views of wasichai/integrations (/api/integrations/...): cast, not parsed.
// this module owns no view: each is read from @wasichai/integrations' routes, typed here without importing it

export type Capability = 'AUTHENTICATION' | 'DISCOVERY' | 'READ' | 'CHANGE_FEED' | 'WRITE' | 'UPSERT' | 'WEBHOOKS' | 'ACTIONS'

// declared in the manifest, implemented, or tested against a stub
export type Maturity = 'DECLARED' | 'IMPLEMENTED' | 'TESTED'

export type AuthType = 'OAUTH2_AUTHORIZATION_CODE' | 'OAUTH2_CLIENT_CREDENTIALS' | 'API_KEY' | 'BASIC'

export interface AuthMethodView {
  type: AuthType
  pkce?: boolean | null
  defaultScopes?: string[]
}

// ConnectorView: the manifest of an installed connector
export interface Connector {
  id: string
  provider: string
  homepage: string | null
  documentation: string | null
  version: string
  sdkVersion: string
  description: string
  authMethods: AuthMethodView[]
  capabilities: Partial<Record<Capability, Maturity>>
  resources: { name: string; label: string; dynamic: boolean }[]
  actions: { name: string; label: string; sensitive: boolean }[]
  syncDirections: string[]
  webhooks: { signatureScheme: string; events: string[] } | null
  rateLimit: { requestsPerSecond: number; burst: number; scope: string } | null
  requiredPermissions: string[]
  needsProviderConfig: boolean
  providerConfigured: boolean
}

// GET /usage: one metric's count on one UTC day. a day with nothing counted has no row
export interface UsageRow {
  day: string
  metric: string
  count: number
}

export type ConnectionStatus = 'ACTIVE' | 'NEEDS_REAUTH' | 'DISABLED' | 'ERROR'

export type ConnectionHealth = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'FAILING'

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'DEAD'

export interface ConnectionHealthView {
  id: string
  connectorId: string
  name: string
  status: ConnectionStatus
  health: ConnectionHealth
  lastValidatedAt: string | null
  lastError: string | null
  // set while the replica that answered pauses the connection after a provider 429
  rateLimitedUntil: string | null
}

// HealthView
export interface Health {
  // every status, zero included
  connections: Partial<Record<ConnectionStatus, number>>
  // every connection not ACTIVE, or DEGRADED or FAILING
  failing: ConnectionHealthView[]
  // only the statuses that have jobs
  jobs: Partial<Record<JobStatus, number>>
}

// JobView
export interface Job {
  id: string
  kind: string
  status: JobStatus
  attempts: number
  maxAttempts: number
  nextAttemptAt: string
  lastError: string | null
  errorKind: string | null
  // false: a permanent error, retrying as it is fails again
  retryable: boolean
  correlationId: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export type EventStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED'

// what this module shows of an EventView
export interface IntegrationEvent {
  eventId: string
  connectionId: string
  provider: string
  resourceType: string | null
  resourceId: string | null
  eventType: string
  receivedAt: string
  correlationId: string
  status: EventStatus
  processedAt: string | null
  error: string | null
}

export interface EventPage {
  content: IntegrationEvent[]
  nextCursor: string | null
}

export interface ConnectionOption {
  id: string
  connectorId: string
  name: string
}
