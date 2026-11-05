import type { WasichaiModule } from '@wasichai/core'
import type { ConnectionOption, ConnectorOption, Tool, ToolExecution } from '../types'

// what @wasichai/integrations declares, without importing it: the group this module fills
export const integrationsGroup: WasichaiModule = { id: 'integrations', navGroups: [{ id: 'integrations', labelKey: 'integrations:nav.group', order: 45 }] }

export const member = { admin: false, objects: {}, capabilities: [] }

export const connections: ConnectionOption[] = [
  { id: 'c1', connectorId: 'slack', name: 'Support Slack', status: 'ACTIVE' },
  { id: 'c2', connectorId: 'crm', name: 'CRM', status: 'ACTIVE' }
]

export const slack: ConnectorOption = {
  id: 'slack',
  provider: 'Slack',
  capabilities: { AUTHENTICATION: 'TESTED', ACTIONS: 'TESTED' },
  resources: [],
  actions: [{ name: 'send_message', label: 'Send a message', sensitive: false }]
}

export const crm: ConnectorOption = {
  id: 'crm',
  provider: 'CRM',
  capabilities: { DISCOVERY: 'TESTED', READ: 'TESTED', WRITE: 'IMPLEMENTED' },
  resources: [{ name: 'contacts', label: 'Contacts', dynamic: false }],
  actions: []
}

export const actionTool = (overrides: Partial<Tool> = {}): Tool => ({
  id: 't1',
  name: 'post_to_support',
  description: 'Post a message to a support channel.',
  connectionId: 'c1',
  kind: 'ACTION',
  action: 'send_message',
  resource: null,
  operation: null,
  externalIdField: null,
  inputSchema: {
    type: 'object',
    properties: {
      channel: { type: 'string', enum: ['support', 'support-escalations'] },
      text: { type: 'string', minLength: 1, maxLength: 2000 },
      urgent: { type: 'boolean' },
      priority: { type: 'integer', minimum: 1, maximum: 5 }
    },
    required: ['channel', 'text'],
    additionalProperties: false
  },
  allowedRoles: ['SUPPORT_AGENT'],
  approvalRequired: true,
  rateLimitPerMinute: 10,
  enabled: true,
  version: 3,
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-05T10:00:00Z',
  ...overrides
})

export const recordTool = (overrides: Partial<Tool> = {}): Tool => ({
  ...actionTool(),
  id: 't2',
  name: 'find_contact',
  description: 'Read one CRM contact by its id.',
  connectionId: 'c2',
  kind: 'RESOURCE',
  action: null,
  resource: 'contacts',
  operation: 'READ',
  inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1 } }, required: ['id'], additionalProperties: false },
  allowedRoles: [],
  approvalRequired: false,
  rateLimitPerMinute: 60,
  version: 1,
  ...overrides
})

export const execution = (overrides: Partial<ToolExecution> = {}): ToolExecution => ({
  id: 'x1',
  toolId: 't1',
  toolName: 'post_to_support',
  connectionId: 'c1',
  callerId: null,
  serviceAccount: 'support-bot',
  status: 'PENDING_APPROVAL',
  input: { channel: 'support', text: 'Order 17 shipped' },
  output: null,
  outputTruncated: false,
  error: null,
  errorKind: null,
  decidedBy: null,
  decidedAt: null,
  reason: null,
  correlationId: 'corr-1',
  createdAt: '2026-11-05T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  ...overrides
})
