import type {
  ConflictStrategy,
  DateKind,
  DeletePolicy,
  EncodedValue,
  FieldMapping,
  Owner,
  SyncDefinition,
  SyncDefinitionRequest,
  SyncDirection,
  Transform,
  TransformType,
  Violation
} from './types'

// the wizard edits strings; the request is built only on save. a transform's params stay typed-in text
export interface TransformDraft {
  type: TransformType
  value: string
  // enumMap: one "from=to" per line
  map: string
  zone: string
  a: DateKind
  b: DateKind
  scale: string
  equals: string
  then: string
  otherwise: string
}

export interface MappingDraft {
  // react key only, never sent
  uid: number
  aField: string
  bField: string
  transform: TransformDraft
  owner: Owner
  conflictStrategy: ConflictStrategy
}

export interface DefinitionDraft {
  name: string
  aConnection: string
  aResource: string
  bConnection: string
  bResource: string
  direction: SyncDirection | ''
  deletePolicy: DeletePolicy
  scheduleSeconds: string
  reconcileSeconds: string
  matchA: string
  matchB: string
  mappings: MappingDraft[]
}

export const TRANSFORM_TYPES: TransformType[] = ['copy', 'static', 'default', 'enumMap', 'dateTime', 'number', 'conditional']
export const DIRECTIONS: SyncDirection[] = ['A_TO_B', 'B_TO_A', 'BIDIRECTIONAL']
export const OWNERS: Owner[] = ['BOTH', 'A', 'B']
export const STRATEGIES: ConflictStrategy[] = ['MANUAL', 'SOURCE_WINS', 'A_WINS', 'B_WINS', 'LAST_WRITE_WINS']
export const DELETE_POLICIES: DeletePolicy[] = ['FLAG', 'IGNORE', 'PROPAGATE']

let nextUid = 1

export const blankTransform = (): TransformDraft => ({
  type: 'copy',
  value: '',
  map: '',
  zone: 'UTC',
  a: 'DATETIME',
  b: 'DATETIME',
  scale: '2',
  equals: '',
  then: '',
  otherwise: ''
})

// owner BOTH needs a bidirectional definition: a new row follows the direction
export function blankMapping(direction: SyncDirection | ''): MappingDraft {
  return {
    uid: nextUid++,
    aField: '',
    bField: '',
    transform: blankTransform(),
    owner: direction === 'A_TO_B' ? 'A' : direction === 'B_TO_A' ? 'B' : 'BOTH',
    conflictStrategy: 'MANUAL'
  }
}

export function blankDraft(): DefinitionDraft {
  return {
    name: '',
    aConnection: '',
    aResource: '',
    bConnection: '',
    bResource: '',
    direction: 'A_TO_B',
    deletePolicy: 'FLAG',
    scheduleSeconds: '',
    reconcileSeconds: '',
    matchA: '',
    matchB: '',
    mappings: [blankMapping('A_TO_B')]
  }
}

const text = (value: unknown) => (value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value))

function transformDraft(transform: Transform | null): TransformDraft {
  const draft = blankTransform()
  if (!transform) return draft
  switch (transform.type) {
    case 'static':
    case 'default':
      return { ...draft, type: transform.type, value: text(transform.value) }
    case 'enumMap':
      return {
        ...draft,
        type: 'enumMap',
        map: Object.entries(transform.map)
          .map(([from, to]) => `${from}=${to}`)
          .join('\n')
      }
    case 'dateTime':
      return { ...draft, type: 'dateTime', zone: transform.zone || 'UTC', a: transform.a ?? 'DATETIME', b: transform.b ?? 'DATETIME' }
    case 'number':
      return { ...draft, type: 'number', scale: String(transform.scale) }
    case 'conditional':
      return { ...draft, type: 'conditional', equals: text(transform.equals), then: text(transform.then), otherwise: text(transform.else) }
    default:
      return draft
  }
}

export function draftOf(definition: SyncDefinition): DefinitionDraft {
  return {
    name: definition.name,
    aConnection: definition.a.connectionId ?? '',
    aResource: definition.a.resource ?? '',
    bConnection: definition.b.connectionId ?? '',
    bResource: definition.b.resource ?? '',
    direction: definition.direction,
    deletePolicy: definition.deletePolicy,
    scheduleSeconds: definition.scheduleSeconds === null ? '' : String(definition.scheduleSeconds),
    reconcileSeconds: definition.reconcileSeconds === null ? '' : String(definition.reconcileSeconds),
    matchA: definition.matchOn?.aField ?? '',
    matchB: definition.matchOn?.bField ?? '',
    mappings: definition.mappings.map((mapping) => ({
      uid: nextUid++,
      aField: mapping.aField ?? '',
      bField: mapping.bField ?? '',
      transform: transformDraft(mapping.transform),
      owner: mapping.owner,
      conflictStrategy: mapping.conflictStrategy
    }))
  }
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const seconds = (value: string) => (value.trim() === '' ? null : Number(value))

export function transformOf(draft: TransformDraft): Transform | null {
  switch (draft.type) {
    case 'copy':
      return null
    case 'static':
    case 'default':
      return { type: draft.type, value: draft.value }
    case 'enumMap':
      return {
        type: 'enumMap',
        map: Object.fromEntries(
          draft.map
            .split('\n')
            .map((line) => line.split('='))
            .filter((parts) => parts.length >= 2 && parts[0].trim() !== '')
            .map(([from, ...to]) => [from.trim(), to.join('=').trim()])
        )
      }
    case 'dateTime':
      return { type: 'dateTime', zone: draft.zone.trim(), a: draft.a, b: draft.b }
    case 'number':
      return { type: 'number', scale: Number(draft.scale) }
    case 'conditional':
      return { type: 'conditional', equals: draft.equals, then: draft.then, else: draft.otherwise }
  }
}

export function requestOf(draft: DefinitionDraft): SyncDefinitionRequest {
  const mappings: FieldMapping[] = draft.mappings.map((mapping) => ({
    aField: orNull(mapping.aField),
    bField: orNull(mapping.bField),
    transform: transformOf(mapping.transform),
    owner: mapping.owner,
    conflictStrategy: mapping.conflictStrategy
  }))
  return {
    name: draft.name.trim(),
    a: { connectionId: orNull(draft.aConnection), resource: orNull(draft.aResource) },
    b: { connectionId: orNull(draft.bConnection), resource: orNull(draft.bResource) },
    direction: draft.direction === '' ? null : draft.direction,
    deletePolicy: draft.deletePolicy,
    scheduleSeconds: seconds(draft.scheduleSeconds),
    reconcileSeconds: seconds(draft.reconcileSeconds),
    matchOn: draft.matchA || draft.matchB ? { aField: orNull(draft.matchA), bField: orNull(draft.matchB) } : null,
    mappings
  }
}

// the paths the wizard draws next to a field; anything else goes to the banner
const MAPPING_PATH = /^mappings\[(\d+)\]\.(aField|bField|owner|conflictStrategy|transform)(\..+)?$/
const FORM_PATHS = [
  'name',
  'mappings',
  'direction',
  'deletePolicy',
  'scheduleSeconds',
  'reconcileSeconds',
  'a.connectionId',
  'a.resource',
  'b.connectionId',
  'b.resource'
]

export interface PlacedViolations {
  form: Record<string, string>
  // row index -> column -> message
  rows: Record<number, Record<string, string>>
  rest: Violation[]
}

export function placeViolations(violations: Violation[]): PlacedViolations {
  const placed: PlacedViolations = { form: {}, rows: {}, rest: [] }
  for (const violation of violations) {
    const row = MAPPING_PATH.exec(violation.field)
    if (row) {
      const cells = (placed.rows[Number(row[1])] ??= {})
      cells[row[2]] = cells[row[2]] ? `${cells[row[2]]}; ${violation.message}` : violation.message
    } else if (FORM_PATHS.includes(violation.field) || violation.field.startsWith('matchOn')) {
      const key = violation.field.startsWith('matchOn') ? 'matchOn' : violation.field
      placed.form[key] = placed.form[key] ? `${placed.form[key]}; ${violation.message}` : violation.message
    } else placed.rest.push(violation)
  }
  return placed
}

// a stored value as a person reads it
export function showValue(value: EncodedValue | null | undefined): string {
  if (!value || value.t === 'null') return '—'
  if (Array.isArray(value.v)) return value.v.join(', ')
  if (value.t === 'json') return JSON.stringify(value.v)
  if (value.t === 'ref') return `${value.r ?? ''}#${String(value.v)}`
  return String(value.v)
}
