import type { WasichaiModule } from '@wasichai/core'
import type { Connector, Health, IntegrationEvent, Job } from '../types'

// what @wasichai/integrations declares, without importing it: the group this module fills
export const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

// the same, with the routes this module links to when they exist
export const integrationsRoutes: WasichaiModule = {
  ...integrationsGroup,
  basePath: 'integrations',
  routes: [
    { id: 'connector', path: 'connectors/:connectorId', component: () => null },
    { id: 'connection', path: 'connections/:connectionId', component: () => null }
  ]
}

export const member = { admin: false, objects: {}, capabilities: [] }

export const connector = (overrides: Partial<Connector> = {}): Connector => ({
  id: 'notion',
  provider: 'Notion',
  homepage: null,
  documentation: null,
  version: '1.4.0',
  sdkVersion: '1.2.0',
  description: 'Pages and databases',
  authMethods: [{ type: 'OAUTH2_AUTHORIZATION_CODE', pkce: false, defaultScopes: [] }],
  capabilities: { AUTHENTICATION: 'TESTED', READ: 'TESTED', WRITE: 'IMPLEMENTED', WEBHOOKS: 'DECLARED' },
  resources: [],
  actions: [],
  syncDirections: ['SOURCE', 'TARGET'],
  webhooks: null,
  rateLimit: { requestsPerSecond: 3, burst: 6, scope: 'connection' },
  requiredPermissions: [],
  needsProviderConfig: true,
  providerConfigured: false,
  ...overrides
})

export const health = (overrides: Partial<Health> = {}): Health => ({
  connections: { ACTIVE: 3, NEEDS_REAUTH: 1, ERROR: 0, DISABLED: 0 },
  failing: [
    {
      id: 'c1',
      connectorId: 'salesforce',
      name: 'Salesforce',
      status: 'NEEDS_REAUTH',
      health: 'FAILING',
      lastValidatedAt: '2026-11-03T09:00:00Z',
      lastError: 'authorization expired: invalid_grant',
      rateLimitedUntil: null
    }
  ],
  jobs: { SUCCEEDED: 412, DEAD: 2 },
  ...overrides
})

export const job = (overrides: Partial<Job> = {}): Job => ({
  id: 'j1',
  kind: 'integrations.sync.run',
  status: 'DEAD',
  attempts: 8,
  maxAttempts: 8,
  nextAttemptAt: '2026-11-05T10:00:00Z',
  lastError: 'provider down',
  errorKind: 'transient',
  retryable: true,
  correlationId: 'corr-1',
  createdAt: '2026-11-05T09:00:00Z',
  updatedAt: '2026-11-05T10:00:00Z',
  finishedAt: '2026-11-05T10:00:00Z',
  ...overrides
})

export const failedEvent = (overrides: Partial<IntegrationEvent> = {}): IntegrationEvent => ({
  eventId: 'e1',
  connectionId: 'c1',
  provider: 'salesforce',
  resourceType: 'Contact',
  resourceId: '003A',
  eventType: 'record.updated',
  receivedAt: '2026-11-05T10:00:00Z',
  correlationId: 'corr-2',
  status: 'FAILED',
  processedAt: null,
  error: 'listener threw',
  ...overrides
})
