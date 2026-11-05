import type { FieldViolation } from '@wasichai/core'
import type { ConnectorOption, ExecutionStatus, JsonSchema, ToolKind, ToolOperation } from './types'

export const OPERATIONS: ToolOperation[] = ['READ', 'LIST', 'CREATE', 'UPDATE', 'UPSERT', 'DELETE']
export const EXECUTION_STATUSES: ExecutionStatus[] = ['PENDING_APPROVAL', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REJECTED']
export const ERROR_KINDS = [
  'rate_limited',
  'auth_expired',
  'not_found',
  'permission_denied',
  'transient',
  'conflict',
  'permanent',
  'unsupported',
  'unexpected',
  'cancelled'
] as const

// the backend's default (ToolCatalog): anything that changes the provider waits for a person
export function defaultApproval(kind: ToolKind, operation: ToolOperation | null): boolean {
  return kind === 'ACTION' || operation === null || !['READ', 'LIST'].includes(operation)
}

// what the connector declares: READ reads and lists, WRITE creates, updates and deletes, UPSERT upserts
export function operationsFor(connector: ConnectorOption | undefined): ToolOperation[] {
  if (!connector) return OPERATIONS
  const has = (capability: string) => Boolean(connector.capabilities[capability])
  return OPERATIONS.filter((op) => (op === 'READ' || op === 'LIST' ? has('READ') : op === 'UPSERT' ? has('UPSERT') : has('WRITE')))
}

// the action schema textarea: a JSON object, or why not
export function parseSchema(text: string): { schema: Record<string, unknown> } | { error: 'json' | 'object' } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { error: 'json' }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { error: 'object' }
  return { schema: value as Record<string, unknown> }
}

export interface SimpleField {
  name: string
  type: 'string' | 'number' | 'integer' | 'boolean'
  options: string[] | null
  required: boolean
  label: string
  description: string | null
}

// a form only for a flat object of strings, numbers, booleans and string enums. anything else: null, JSON instead
export function simpleFields(schema: JsonSchema): SimpleField[] | null {
  if (schema.type !== 'object') return null
  const required = schema.required ?? []
  const fields: SimpleField[] = []
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const type = property.type
    if (type !== 'string' && type !== 'number' && type !== 'integer' && type !== 'boolean') return null
    if (property.enum && !property.enum.every((value) => typeof value === 'string')) return null
    fields.push({
      name,
      type,
      options: (property.enum as string[] | undefined) ?? null,
      required: required.includes(name),
      label: property.title ?? name,
      description: property.description ?? null
    })
  }
  return fields
}

// form strings to the input: blanks left out (the schema says what is required), numbers as numbers
export function formInput(fields: SimpleField[], values: Record<string, string | boolean>): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (field.type === 'boolean') {
      if (value !== undefined) input[field.name] = value === true
    } else if (typeof value === 'string' && value.trim() !== '') {
      input[field.name] = field.type === 'string' ? value : Number(value)
    }
  }
  return input
}

// violations by the form field they belong to (allowedRoles[2] -> allowedRoles, inputSchema.properties.x -> inputSchema);
// the rest is shown at the top
export function placeViolations(violations: FieldViolation[], fields: string[]): { byField: Record<string, string>; rest: FieldViolation[] } {
  const byField: Record<string, string> = {}
  const rest: FieldViolation[] = []
  for (const violation of violations) {
    const field = fields.find((name) => violation.field === name || violation.field.startsWith(`${name}.`) || violation.field.startsWith(`${name}[`))
    if (!field) {
      rest.push(violation)
      continue
    }
    const text = violation.field === field ? violation.message : `${violation.field}: ${violation.message}`
    byField[field] = byField[field] ? `${byField[field]}; ${text}` : text
  }
  return { byField, rest }
}
