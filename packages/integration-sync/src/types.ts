// sync shapes. mirror the views of wasichai-integrations-sync (/api/integrations/sync-definitions, /conflicts): cast, not parsed.

export type SyncDirection = 'A_TO_B' | 'B_TO_A' | 'BIDIRECTIONAL'

export type DefinitionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED'

export type DeletePolicy = 'PROPAGATE' | 'IGNORE' | 'FLAG'

export type Owner = 'A' | 'B' | 'BOTH'

// how a field changed on both sides is settled (ADR-0009). owner A or B always wins for its field
export type ConflictStrategy = 'SOURCE_WINS' | 'A_WINS' | 'B_WINS' | 'LAST_WRITE_WINS' | 'MANUAL'

export type DateKind = 'DATE' | 'DATETIME'

// the closed transform set, written A -> B. absent or copy carries the value as is
export type Transform =
  | { type: 'copy' }
  | { type: 'static'; value: unknown }
  | { type: 'default'; value: unknown }
  | { type: 'enumMap'; map: Record<string, string> }
  | { type: 'dateTime'; zone: string; a: DateKind; b: DateKind }
  | { type: 'number'; scale: number }
  | { type: 'conditional'; equals: unknown; then: unknown; else: unknown }

export type TransformType = Transform['type']

export interface SideRef {
  connectionId: string | null
  resource: string | null
}

// how an existing record of A finds its twin in B on the first run
export interface MatchOn {
  aField: string | null
  bField: string | null
}

export interface FieldMapping {
  aField: string | null
  bField: string | null
  transform: Transform | null
  owner: Owner
  conflictStrategy: ConflictStrategy
}

export interface SyncDefinition {
  id: string
  name: string
  a: SideRef
  b: SideRef
  direction: SyncDirection
  status: DefinitionStatus
  deletePolicy: DeletePolicy
  scheduleSeconds: number | null
  reconcileSeconds: number | null
  matchOn: MatchOn | null
  mappings: FieldMapping[]
  // the ETag: If-Match "<version>" on a replace
  version: number
  createdAt: string
  updatedAt: string
}

export interface SyncDefinitionRequest {
  name: string
  a: SideRef
  b: SideRef
  direction: SyncDirection | null
  deletePolicy: DeletePolicy
  scheduleSeconds: number | null
  reconcileSeconds: number | null
  matchOn: MatchOn | null
  mappings: FieldMapping[]
}

export interface Violation {
  field: string
  message: string
}

// POST /validate checks against the live schemas of both sides
export interface Validation {
  valid: boolean
  errors: Violation[]
}

export type RunKind = 'INCREMENTAL' | 'INITIAL' | 'RECONCILE'

export type RunTrigger = 'MANUAL' | 'SCHEDULE' | 'EVENT' | 'INITIAL' | 'RECONCILE'

export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED'

export interface SyncRun {
  id: string
  definitionId: string
  trigger: RunTrigger
  status: RunStatus
  read: number
  created: number
  updated: number
  skipped: number
  conflicts: number
  failed: number
  error: string | null
  queuedAt: string
  startedAt: string | null
  finishedAt: string | null
}

// a field value as the engine stores it: t is the kind, v the value (r the resource of a reference)
export interface EncodedValue {
  t: 'null' | 'text' | 'number' | 'bool' | 'date' | 'datetime' | 'choice' | 'multi' | 'ref' | 'json'
  v?: unknown
  r?: string
}

export interface ConflictField {
  // "<aField>-><bField>", the mapping it belongs to
  key: string
  aField: string
  bField: string
  a: EncodedValue
  b: EncodedValue
  // the last values both sides agreed on, when there were any
  base?: { a: EncodedValue; b: EncodedValue } | null
}

export type ConflictKind = 'FIELDS' | 'DELETED'

export type ConflictStatus = 'OPEN' | 'RESOLVED'

export interface Conflict {
  id: string
  definitionId: string
  linkId: string
  kind: ConflictKind
  fields: ConflictField[]
  status: ConflictStatus
  resolution: { choice: string; values?: Record<string, unknown> } | null
  detectedAt: string
  resolvedAt: string | null
}

// A or B takes that side for every field; CUSTOM takes values keyed by A's field names
export interface ResolveRequest {
  choice?: 'A' | 'B' | 'CUSTOM'
  values?: Record<string, unknown>
}

// what this module reads of the integrations module: its connection list and discovery.
// the full shapes belong to @wasichai/integrations, which this package never imports
export interface ConnectionOption {
  id: string
  connectorId: string
  name: string
  status: string
}

export interface ResourceOption {
  name: string
  label: string
  description?: string | null
}

export interface SchemaField {
  name: string
  label: string
  type: string
  required: boolean
  readOnly: boolean
  externalId: boolean
  options: string[]
}

export interface ResourceSchemaOption {
  resource: string
  label: string
  fields: SchemaField[]
}
