import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Label } from '@wasichai/ui'
import { FieldError, NONE, Pick, Text, type Option } from './fields'
import {
  CONDITION_OPS,
  conditionWithOp,
  EDGE_FIELDS,
  literalOf,
  literalText,
  messagesAt,
  operandKind,
  operandOf,
  operandText,
  removeStep,
  renameStep,
  setEdge,
  setTriggerType,
  STEP_ID,
  stepsOf,
  TRIGGER_NODE,
  TRIGGER_TYPES,
  updateStep,
  updateTrigger,
  WRITE_OPERATIONS,
  type OperandKind
} from './graph'
import type { Condition, ConditionOp, Operand, ResourceWrite, Step, Violation, WorkflowGraph, WriteOperation } from './types'

// the keys the panel draws a field for; any other violation is listed at the top of the panel
const SHOWN = new Set([
  'type',
  'next',
  'then',
  'else',
  'rejected',
  'join',
  'onError',
  'branches',
  'connectionId',
  'action',
  'write',
  'input',
  'condition',
  'duration',
  'title',
  'timeout',
  'eventType',
  'cron',
  'zone'
])

interface Props {
  graph: WorkflowGraph
  selected: string
  violations: Violation[] | undefined
  connections: Option[]
  onChange: (graph: WorkflowGraph) => void
  onSelect: (id: string | null) => void
}

// the form of the selected node: its own fields by type, then its edges
export function Inspector({ graph, selected, violations, connections, onChange, onSelect }: Props) {
  const { t } = useTranslation('integration-workflows')
  const unshown = (violations ?? []).filter((violation) => !SHOWN.has(violation.field.split(/[.[]/)[0]))
  const step = stepsOf(graph).find((candidate) => candidate.id === selected)
  const title = selected === TRIGGER_NODE ? t('designer.trigger') : step ? `${step.id} · ${t(`stepType.${step.type}`)}` : ''

  return (
    <section aria-label={t('designer.inspector', { node: title })} className="space-y-4">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {unshown.length > 0 ? (
        <ul className="space-y-1 text-xs text-danger" role="alert">
          {unshown.map((violation, index) => (
            <li key={index}>{violation.field ? `${violation.field}: ${violation.message}` : violation.message}</li>
          ))}
        </ul>
      ) : null}
      {selected === TRIGGER_NODE ? (
        <TriggerForm graph={graph} violations={violations} connections={connections} onChange={onChange} />
      ) : step ? (
        <StepForm graph={graph} step={step} violations={violations} connections={connections} onChange={onChange} onSelect={onSelect} />
      ) : null}
    </section>
  )
}

function edgeOptions(graph: WorkflowGraph, self: string | null, none: string): Option[] {
  return [
    { value: NONE, label: none },
    ...stepsOf(graph)
      .filter((step) => step.id !== self)
      .map((step) => ({ value: step.id, label: step.id }))
  ]
}

function TriggerForm({ graph, violations, connections, onChange }: Omit<Props, 'selected' | 'onSelect'>) {
  const { t } = useTranslation('integration-workflows')
  const trigger = graph.trigger ?? {}
  const at = (field: string) => messagesAt(violations, field)
  return (
    <div className="space-y-4">
      <Pick
        id="trigger-type"
        label={t('designer.triggerType')}
        value={trigger.type ?? ''}
        onChange={(value) => onChange(setTriggerType(graph, value as never))}
        options={TRIGGER_TYPES.map((type) => ({ value: type, label: t(`triggerType.${type}`) }))}
        placeholder={t('designer.pick')}
        error={at('type')}
      />
      {trigger.type === 'event' ? (
        <>
          <Pick
            id="trigger-connection"
            label={t('designer.connection')}
            value={trigger.connectionId ?? ''}
            onChange={(value) => onChange(updateTrigger(graph, { connectionId: value }))}
            options={connections}
            placeholder={t('designer.pick')}
            error={at('connectionId')}
          />
          <Text
            id="trigger-event"
            label={t('designer.eventType')}
            value={trigger.eventType ?? ''}
            onChange={(value) => onChange(updateTrigger(graph, { eventType: value }))}
            hint={t('designer.eventTypeHint')}
            error={at('eventType')}
          />
        </>
      ) : null}
      {trigger.type === 'schedule' ? (
        <>
          <Text
            id="trigger-cron"
            label={t('designer.cron')}
            value={trigger.cron ?? ''}
            onChange={(value) => onChange(updateTrigger(graph, { cron: value }))}
            hint={t('designer.cronHint')}
            error={at('cron')}
            mono
          />
          <Text
            id="trigger-zone"
            label={t('designer.zone')}
            value={trigger.zone ?? ''}
            onChange={(value) => onChange(updateTrigger(graph, { zone: value }))}
            hint={t('designer.zoneHint')}
            error={at('zone')}
          />
        </>
      ) : null}
      {trigger.type === 'webhook' ? <p className="text-xs text-ink-muted">{t('designer.webhookHint')}</p> : null}
      <Pick
        id="trigger-next"
        label={t('edge.next')}
        value={trigger.next ?? NONE}
        onChange={(value) => onChange(setEdge(graph, TRIGGER_NODE, 'next', value === NONE ? null : value))}
        options={edgeOptions(graph, null, t('designer.noEdge'))}
        error={at('next')}
      />
    </div>
  )
}

function StepForm({ graph, step, violations, connections, onChange, onSelect }: Omit<Props, 'selected'> & { step: Step }) {
  const { t } = useTranslation('integration-workflows')
  const at = (field: string) => messagesAt(violations, field)
  const patch = (changes: Partial<Step>) => onChange(updateStep(graph, step.id, changes))
  const [id, setId] = useState(step.id)
  const [idError, setIdError] = useState<string | null>(null)
  useEffect(() => {
    setId(step.id)
    setIdError(null)
  }, [step.id])

  // a rename lands on blur: every keystroke would move the selection
  const rename = () => {
    if (id === step.id) return
    if (!STEP_ID.test(id)) return setIdError(t('designer.idInvalid'))
    if (stepsOf(graph).some((candidate) => candidate.id === id)) return setIdError(t('designer.idTaken'))
    setIdError(null)
    onChange(renameStep(graph, step.id, id))
    onSelect(id)
  }

  return (
    <div className="space-y-4">
      <Text id="step-id" label={t('designer.stepId')} value={id} onChange={setId} onBlur={rename} error={idError ?? undefined} hint={t('designer.idHint')} />
      {step.type === 'action' ? <ActionFields step={step} at={at} connections={connections} patch={patch} /> : null}
      {step.type === 'condition' || step.type === 'branch' ? (
        <ConditionFields condition={step.condition} at={(field) => at(`condition${field ? `.${field}` : ''}`)} onChange={(condition) => patch({ condition })} />
      ) : null}
      {step.type === 'delay' ? (
        <Text
          id="step-duration"
          label={t('designer.duration')}
          value={step.duration ?? ''}
          onChange={(duration) => patch({ duration })}
          hint={t('designer.durationHint')}
          error={at('duration')}
          mono
        />
      ) : null}
      {step.type === 'approval' ? (
        <>
          <Text id="step-title" label={t('designer.approvalTitle')} value={step.title ?? ''} onChange={(title) => patch({ title })} error={at('title')} />
          <Text
            id="step-timeout"
            label={t('designer.timeout')}
            value={step.timeout ?? ''}
            onChange={(timeout) => patch({ timeout })}
            hint={t('designer.timeoutHint')}
            error={at('timeout')}
            mono
          />
        </>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{t('designer.edges')}</legend>
        {(EDGE_FIELDS[step.type] ?? []).map((field) =>
          field === 'branches' ? (
            <Branches key={field} graph={graph} step={step} at={at} onChange={onChange} />
          ) : (
            <Pick
              key={field}
              id={`step-${field}`}
              label={t(`edge.${field}`)}
              value={step[field] ?? NONE}
              onChange={(value) => onChange(setEdge(graph, step.id, field, value === NONE ? null : value))}
              options={edgeOptions(graph, step.id, t('designer.noEdge'))}
              error={at(field)}
            />
          )
        )}
        {step.type === 'end' ? <p className="text-xs text-ink-muted">{t('designer.endHint')}</p> : null}
      </fieldset>
      <Button
        variant="secondary"
        onClick={() => {
          onChange(removeStep(graph, step.id))
          onSelect(null)
        }}
      >
        <Trash2 className="size-4" />
        {t('designer.removeStep')}
      </Button>
    </div>
  )
}

function Branches({
  graph,
  step,
  at,
  onChange
}: {
  graph: WorkflowGraph
  step: Step
  at: (field: string) => string | undefined
  onChange: (graph: WorkflowGraph) => void
}) {
  const { t } = useTranslation('integration-workflows')
  const options = edgeOptions(graph, step.id, t('designer.noEdge'))
  const branches = step.branches ?? []
  return (
    <div className="space-y-2">
      {branches.map((target, index) => (
        <Pick
          key={index}
          id={`step-branch-${index}`}
          label={t('designer.branchN', { n: index + 1 })}
          value={target}
          onChange={(value) => onChange(setEdge(graph, step.id, `branches[${index}]`, value === NONE ? null : value))}
          options={options}
          error={at(`branches[${index}]`)}
        />
      ))}
      <Pick
        id="step-branch-new"
        label={t('designer.addBranch')}
        value=""
        onChange={(value) => value !== NONE && onChange(setEdge(graph, step.id, 'branches', value))}
        options={options.filter((option) => option.value !== NONE && !branches.includes(option.value))}
        placeholder={t('designer.pick')}
        error={branches.length === 0 ? at('branches') : undefined}
      />
    </div>
  )
}

function ActionFields({
  step,
  at,
  connections,
  patch
}: {
  step: Step
  at: (field: string) => string | undefined
  connections: Option[]
  patch: (changes: Partial<Step>) => void
}) {
  const { t } = useTranslation('integration-workflows')
  const writing = step.write !== undefined
  const write: ResourceWrite = step.write ?? {}
  const setWrite = (changes: Partial<ResourceWrite>) => patch({ write: { ...write, ...changes } })
  const operation = write.operation
  return (
    <>
      <Pick
        id="step-connection"
        label={t('designer.connection')}
        value={step.connectionId ?? ''}
        onChange={(connectionId) => patch({ connectionId })}
        options={connections}
        placeholder={t('designer.pick')}
        error={at('connectionId')}
      />
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-ink">{t('designer.actionKind')}</legend>
        {(['action', 'write'] as const).map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="action-kind"
              className="h-4 w-4 accent-brand"
              checked={kind === 'write' ? writing : !writing}
              // the other kind's keys go: an action is a connector action or a write, never both
              onChange={() => patch(kind === 'write' ? { action: undefined, write: { operation: 'upsert' } } : { write: undefined, action: '' })}
            />
            {t(`designer.kind.${kind}`)}
          </label>
        ))}
      </fieldset>
      {writing ? (
        <>
          <Text
            id="step-resource"
            label={t('designer.resource')}
            value={write.resource ?? ''}
            onChange={(resource) => setWrite({ resource })}
            error={at('write.resource')}
          />
          <Pick
            id="step-operation"
            label={t('designer.operation')}
            value={operation ?? ''}
            onChange={(value) => setWrite({ operation: value as WriteOperation })}
            options={WRITE_OPERATIONS.map((op) => ({ value: op, label: t(`operation.${op}`) }))}
            placeholder={t('designer.pick')}
            error={at('write.operation')}
          />
          {operation === 'update' || operation === 'delete' ? (
            <OperandField
              id="step-record-id"
              label={t('designer.recordId')}
              operand={write.recordId}
              onChange={(recordId) => setWrite({ recordId })}
              error={at('write.recordId')}
            />
          ) : null}
          {operation === 'upsert' ? (
            <>
              <Text
                id="step-external-field"
                label={t('designer.externalIdField')}
                value={write.externalIdField ?? ''}
                onChange={(externalIdField) => setWrite({ externalIdField })}
                error={at('write.externalIdField')}
              />
              <OperandField
                id="step-external-id"
                label={t('designer.externalId')}
                operand={write.externalId}
                onChange={(externalId) => setWrite({ externalId })}
                error={at('write.externalId')}
              />
            </>
          ) : null}
        </>
      ) : (
        <Text id="step-action" label={t('designer.action')} value={step.action ?? ''} onChange={(action) => patch({ action })} error={at('action')} />
      )}
      {operation === 'delete' && writing ? null : <InputRows input={step.input ?? {}} at={at} onChange={(input) => patch({ input })} />}
    </>
  )
}

// a reference or a json literal, as a kind select and one text box
function OperandField({
  id,
  label,
  operand,
  onChange,
  error
}: {
  id: string
  label: string
  operand: Operand | undefined
  onChange: (operand: Operand) => void
  error?: string
}) {
  const { t } = useTranslation('integration-workflows')
  const kind = operandKind(operand)
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <Pick
          id={`${id}-kind`}
          label={t('designer.operandKind', { field: label })}
          value={kind}
          onChange={(value) => onChange(operandOf(value as OperandKind, operandText(operand)))}
          options={[
            { value: 'ref', label: t('designer.ref') },
            { value: 'value', label: t('designer.value') }
          ]}
        />
        <Text id={id} label={label} value={operandText(operand)} onChange={(text) => onChange(operandOf(kind, text))} mono />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

// input: {field: operand}. rows keep their order; renaming a field rebuilds the object in place
function InputRows({
  input,
  at,
  onChange
}: {
  input: Record<string, Operand>
  at: (field: string) => string | undefined
  onChange: (input: Record<string, Operand>) => void
}) {
  const { t } = useTranslation('integration-workflows')
  const entries = Object.entries(input)
  const rebuild = (next: [string, Operand][]) => onChange(Object.fromEntries(next))
  const free = () => {
    let n = entries.length + 1
    while (`field${n}` in input) n++
    return `field${n}`
  }
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{t('designer.input')}</legend>
      {entries.length === 0 ? <p className="text-xs text-ink-muted">{t('designer.noInput')}</p> : null}
      {entries.map(([field, operand], index) => (
        <div key={index} className="space-y-1.5 rounded border border-border p-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`input-${index}-field`}>{t('designer.inputField', { n: index + 1 })}</Label>
              <Input
                id={`input-${index}-field`}
                value={field}
                autoComplete="off"
                onChange={(event) => rebuild(entries.map((entry, i) => (i === index ? [event.target.value, entry[1]] : entry)))}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('designer.removeInput', { field })}
              onClick={() => rebuild(entries.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <OperandField
            id={`input-${index}-operand`}
            label={t('designer.inputValue', { field })}
            operand={operand}
            onChange={(next) => rebuild(entries.map((entry, i) => (i === index ? [entry[0], next] : entry)))}
            error={at(`input.${field}`)}
          />
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange({ ...input, [free()]: { ref: 'trigger.payload' } })}>
        <Plus className="size-4" />
        {t('designer.addInput')}
      </Button>
      <FieldError id="input-error" message={entries.length === 0 ? at('input') : undefined} />
    </fieldset>
  )
}

// the closed condition set: a leaf as fields, a group (and, or, not) as json of its members
function ConditionFields({
  condition,
  at,
  onChange
}: {
  condition: Condition | undefined
  at: (field: string) => string | undefined
  onChange: (condition: Condition) => void
}) {
  const { t } = useTranslation('integration-workflows')
  const op = condition?.op
  const group = op === 'and' || op === 'or' || op === 'not'
  const membersKey = op === 'not' ? 'condition' : 'conditions'
  const [json, setJson] = useState(() => JSON.stringify(group ? (condition?.[membersKey] ?? null) : null, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  useEffect(() => {
    if (group) setJson(JSON.stringify(condition?.[membersKey] ?? (op === 'not' ? {} : []), null, 2))
    // only when the op changes: typing must not be reformatted under the cursor
  }, [op])

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{t('designer.condition')}</legend>
      <Pick
        id="condition-op"
        label={t('designer.op')}
        value={op ?? ''}
        onChange={(value) => onChange(conditionWithOp(condition, value as ConditionOp))}
        options={CONDITION_OPS.map((value) => ({ value, label: t(`op.${value}`) }))}
        placeholder={t('designer.pick')}
        error={at('op') ?? (op ? undefined : at(''))}
      />
      {op && !group ? (
        <Text
          id="condition-ref"
          label={t('designer.conditionRef')}
          value={condition?.ref ?? ''}
          onChange={(ref) => onChange({ ...condition, ref })}
          error={at('ref')}
          hint={t('designer.refHint')}
          mono
        />
      ) : null}
      {op === 'equals' || op === 'notEquals' || op === 'gt' || op === 'lt' ? (
        <Text
          id="condition-value"
          label={t('designer.conditionValue')}
          value={literalText(condition?.value)}
          onChange={(text) => onChange({ ...condition, value: literalOf(text) })}
          error={at('value')}
          hint={t('designer.literalHint')}
          mono
        />
      ) : null}
      {op === 'in' ? (
        <Text
          id="condition-values"
          label={t('designer.conditionValues')}
          value={(condition?.values ?? []).map(literalText).join('\n')}
          onChange={(text) =>
            onChange({
              ...condition,
              values: text
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map(literalOf)
            })
          }
          error={at('values')}
          hint={t('designer.valuesHint')}
          multiline
          mono
        />
      ) : null}
      {group ? (
        <Text
          id="condition-members"
          label={t(op === 'not' ? 'designer.negated' : 'designer.members')}
          value={json}
          onChange={(text) => {
            setJson(text)
            try {
              onChange({ op, [membersKey]: JSON.parse(text) })
              setJsonError(null)
            } catch {
              setJsonError(t('designer.badJson'))
            }
          }}
          error={jsonError ?? at(membersKey)}
          hint={t('designer.membersHint')}
          multiline
          mono
        />
      ) : null}
    </fieldset>
  )
}
