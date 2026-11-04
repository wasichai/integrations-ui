// integrations shapes. mirror the views of wasichai/integrations (/api/integrations/...): cast, not parsed.

export type Capability = 'AUTHENTICATION' | 'DISCOVERY' | 'READ' | 'CHANGE_FEED' | 'WRITE' | 'UPSERT' | 'WEBHOOKS' | 'ACTIONS'

// how far a connector got with a capability: declared in the manifest, implemented, or tested against a stub
export type Maturity = 'DECLARED' | 'IMPLEMENTED' | 'TESTED'

export type AuthType = 'OAUTH2_AUTHORIZATION_CODE' | 'OAUTH2_CLIENT_CREDENTIALS' | 'API_KEY' | 'BASIC'

export interface AuthMethodView {
  type: AuthType
  // oauth authorization code only
  pkce?: boolean | null
  defaultScopes?: string[]
}

export interface ResourceView {
  name: string
  label: string
  dynamic: boolean
}

export interface ActionView {
  name: string
  label: string
  sensitive: boolean
}

export interface WebhookView {
  signatureScheme: string
  events: string[]
}

export interface RateLimitView {
  requestsPerSecond: number
  burst: number
  scope: string
}

// ConnectorView: the manifest as declared, plus whether this tenant registered its provider app
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
  resources: ResourceView[]
  actions: ActionView[]
  syncDirections: string[]
  webhooks: WebhookView | null
  rateLimit: RateLimitView | null
  requiredPermissions: string[]
  needsProviderConfig: boolean
  providerConfigured: boolean
}

// the tenant's oauth app. the secret is write-only: only whether one is set comes back
export interface ProviderConfig {
  id: string
  connectorId: string
  clientId: string
  clientSecretSet: boolean
  scopes: string[]
  options: Record<string, string>
  // the ETag: If-Match "<version>" on a replace
  version: number
  createdAt: string
  updatedAt: string
}

export interface ProviderConfigRequest {
  clientId: string
  // absent keeps the stored secret, '' clears it
  clientSecret?: string
  scopes: string[]
  options: Record<string, string>
}

export type ConnectionStatus = 'ACTIVE' | 'NEEDS_REAUTH' | 'DISABLED' | 'ERROR'

export type ConnectionHealth = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'FAILING'

export interface Connection {
  id: string
  connectorId: string
  name: string
  providerAccountId: string | null
  displayName: string | null
  status: ConnectionStatus
  authType: AuthType
  scopes: string[]
  metadata: Record<string, string>
  health: ConnectionHealth
  lastValidatedAt: string | null
  lastError: string | null
  version: number
  createdAt: string
  updatedAt: string
}

// api key, basic or client credentials. oauth authorization code goes through OAuthStartRequest
export interface CreateConnectionRequest {
  connectorId: string
  name?: string
  authType: AuthType
  apiKey?: string
  username?: string
  password?: string
  scopes?: string[]
}

export interface OAuthStartRequest {
  connectorId: string
  name?: string
}

export interface OAuthStart {
  authorizationUrl: string
  expiresAt: string
}

// a failed test is an answer, not an error: ok false with the provider's reason
export interface ConnectionTest {
  ok: boolean
  error: string | null
  retryable: boolean | null
  connection: Connection
}

export type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'CHOICE' | 'MULTI_CHOICE' | 'REFERENCE' | 'JSON'

// sdk ResourceDescriptor: native names, no canonical model
export interface ResourceDescriptor {
  name: string
  label: string
  description?: string | null
}

export interface FieldDescriptor {
  name: string
  label: string
  type: FieldType
  required: boolean
  readOnly: boolean
  externalId: boolean
  options: string[]
  nativeType?: string | null
}

export interface ResourceSchema {
  resource: string
  label: string
  fields: FieldDescriptor[]
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'DEAD'

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

export interface ConnectionHealthView {
  id: string
  connectorId: string
  name: string
  status: ConnectionStatus
  health: ConnectionHealth
  lastValidatedAt: string | null
  lastError: string | null
  rateLimitedUntil: string | null
}

export interface Health {
  connections: Partial<Record<ConnectionStatus, number>>
  // every connection not ACTIVE, or DEGRADED or FAILING
  failing: ConnectionHealthView[]
  jobs: Partial<Record<JobStatus, number>>
}

export type EndpointStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED'

export interface WebhookEndpoint {
  id: string
  connectionId: string
  connectorId: string
  // what to register at the provider
  url: string
  status: EndpointStatus
  secretSet: boolean
  lastDeliveryAt: string | null
  createdAt: string
}

export interface CreateEndpointRequest {
  // the secret a provider app shows at registration; absent for handshake providers
  secret?: string
}

export interface VerificationToken {
  token: string
}

export type EventSource = 'WEBHOOK' | 'POLL' | 'SYNC' | 'SYSTEM'

export type EventStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED'

// the event envelope (ADR-0007 of wasichai/integrations)
export interface IntegrationEvent {
  eventId: string
  tenantId: string
  connectionId: string
  provider: string
  providerEventId: string | null
  resourceType: string | null
  resourceId: string | null
  eventType: string
  occurredAt: string | null
  receivedAt: string
  schemaVersion: number
  correlationId: string
  causationId: string | null
  source: EventSource
  status: EventStatus
  processedAt: string | null
  error: string | null
  payload: unknown
  metadata: unknown
}

// keyset page: nextCursor null on the last one
export interface EventPage {
  content: IntegrationEvent[]
  nextCursor: string | null
}
