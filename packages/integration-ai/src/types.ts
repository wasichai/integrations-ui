// integration-ai shapes. mirror the views of wasichai/integrations (/api/integrations/ai/...): cast, not parsed.

// ACTION: a connector action. RESOURCE: one record operation on one resource
export type ToolKind = 'ACTION' | 'RESOURCE'

// answered upper case; sent in any case
export type ToolOperation = 'READ' | 'LIST' | 'CREATE' | 'UPDATE' | 'UPSERT' | 'DELETE'

export type ExecutionStatus = 'PENDING_APPROVAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'REJECTED'

// a provider failure is an outcome, not an http error: the execution carries its kind
export type ErrorKind =
  'rate_limited' | 'auth_expired' | 'not_found' | 'permission_denied' | 'transient' | 'conflict' | 'permanent' | 'unsupported' | 'unexpected' | 'cancelled'

// the JSON Schema subset the backend accepts (api.md › Input schemas)
export interface JsonSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: unknown[]
  minLength?: number
  maxLength?: number
  format?: 'date' | 'date-time'
  minimum?: number
  maximum?: number
  items?: JsonSchema
  minItems?: number
  maxItems?: number
  title?: string
  description?: string
  additionalProperties?: boolean
}

// ToolView
export interface Tool {
  id: string
  name: string
  description: string
  connectionId: string
  kind: ToolKind
  action: string | null
  resource: string | null
  operation: ToolOperation | null
  externalIdField: string | null
  // written for an action, derived from the resource for a record tool
  inputSchema: JsonSchema
  // upper case. empty: managers only
  allowedRoles: string[]
  approvalRequired: boolean
  rateLimitPerMinute: number
  enabled: boolean
  // the ETag: If-Match "<version>" on PUT
  version: number
  createdAt: string
  updatedAt: string
}

// POST and PUT: the whole tool every time. either action (with inputSchema) or resource with operation
export interface ToolRequest {
  name: string
  description: string
  connectionId: string
  action?: string
  resource?: string
  operation?: string
  externalIdField?: string
  inputSchema?: unknown
  allowedRoles: string[]
  approvalRequired: boolean
  rateLimitPerMinute: number
  enabled: boolean
}

// ExecutionView
export interface ToolExecution {
  id: string
  // null once the tool was deleted; toolName stays
  toolId: string | null
  toolName: string
  connectionId: string
  callerId: string | null
  serviceAccount: string | null
  status: ExecutionStatus
  input: unknown
  // execute and approve answer the whole output; a stored one is its summary (masked, a string when truncated)
  output: unknown
  outputTruncated: boolean
  error: string | null
  errorKind: ErrorKind | null
  decidedBy: string | null
  decidedAt: string | null
  reason: string | null
  correlationId: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface ExecutionPage {
  content: ToolExecution[]
  nextCursor: string | null
}

// what this module reads of @wasichai/integrations' views, without importing it

export interface ConnectionOption {
  id: string
  connectorId: string
  name: string
  status: string
}

export interface ConnectorOption {
  id: string
  provider: string
  capabilities: Partial<Record<string, string>>
  resources: { name: string; label: string; dynamic: boolean }[]
  actions: { name: string; label: string; sensitive: boolean }[]
}

export interface ResourceOption {
  name: string
  label: string
  description?: string | null
}
