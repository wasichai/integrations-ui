import type { Connection, Connector, IntegrationEvent } from '../types'

// shapes as wasichai/integrations answers them, trimmed to what a test changes

export const connector = (overrides: Partial<Connector> = {}): Connector => ({
  id: 'hubspot',
  provider: 'HubSpot',
  homepage: 'https://www.hubspot.com',
  documentation: null,
  version: '1.0.0',
  sdkVersion: '1.0',
  description: 'CRM contacts and companies',
  authMethods: [{ type: 'OAUTH2_AUTHORIZATION_CODE', pkce: true, defaultScopes: ['crm.objects.contacts.read'] }],
  capabilities: { AUTHENTICATION: 'TESTED', DISCOVERY: 'TESTED', READ: 'IMPLEMENTED', WEBHOOKS: 'DECLARED' },
  resources: [{ name: 'contacts', label: 'Contacts', dynamic: false }],
  actions: [],
  syncDirections: ['SOURCE', 'TARGET'],
  webhooks: null,
  rateLimit: { requestsPerSecond: 10, burst: 20, scope: 'connection' },
  requiredPermissions: [],
  needsProviderConfig: true,
  providerConfigured: true,
  ...overrides
})

export const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: 'c1',
  connectorId: 'hubspot',
  name: 'HubSpot ventas',
  providerAccountId: '123',
  displayName: 'Ventas SA',
  status: 'ACTIVE',
  authType: 'OAUTH2_AUTHORIZATION_CODE',
  scopes: [],
  metadata: {},
  health: 'HEALTHY',
  lastValidatedAt: '2026-11-04T10:00:00Z',
  lastError: null,
  version: 1,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
  ...overrides
})

export const event = (overrides: Partial<IntegrationEvent> = {}): IntegrationEvent => ({
  eventId: 'e1',
  tenantId: 'org-test',
  connectionId: 'c1',
  provider: 'hubspot',
  providerEventId: 'p1',
  resourceType: 'contacts',
  resourceId: '42',
  eventType: 'contact.created',
  occurredAt: null,
  receivedAt: '2026-11-04T10:00:00Z',
  schemaVersion: 1,
  correlationId: 'corr-1',
  causationId: null,
  source: 'WEBHOOK',
  status: 'PROCESSED',
  processedAt: null,
  error: null,
  payload: {},
  metadata: {},
  ...overrides
})
