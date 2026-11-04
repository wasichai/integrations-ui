import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError, PageHeader, QueryState, formError, useWasichaiLinks } from '@wasichai/core'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from '@wasichai/ui'
import { connectionOptionsQuery, definitionQuery, resourceOptionsQuery, schemaOptionsQuery, useSaveDefinition, useValidateDefinition } from './api'
import {
  blankDraft,
  blankMapping,
  blankTransform,
  DELETE_POLICIES,
  DIRECTIONS,
  draftOf,
  OWNERS,
  placeViolations,
  requestOf,
  STRATEGIES,
  TRANSFORM_TYPES,
  type DefinitionDraft,
  type MappingDraft,
  type PlacedViolations,
  type TransformDraft
} from './draft'
import type { DateKind, SyncDefinition } from './types'

const NO_VIOLATIONS: PlacedViolations = { form: {}, rows: {}, rest: [] }
const DATE_KINDS: DateKind[] = ['DATETIME', 'DATE']
const CHECKBOX = 'h-4 w-4 accent-brand'

interface Option {
  value: string
  label: string
}

// a labelled select with its violation underneath. radix refuses '' as an item value, so '' is "nothing picked"
function Pick({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  error?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function Text({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  hint
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  ) : null
}

// new: blank draft. edit: the stored definition, replaced with its version as If-Match
export function DefinitionWizardPage() {
  const { definitionId } = useParams()
  const query = useQuery(definitionQuery(definitionId))
  if (!definitionId) return <Wizard initial={null} />
  return <QueryState query={query}>{(definition) => <Wizard key={definition.id} initial={definition} />}</QueryState>
}

function Wizard({ initial }: { initial: SyncDefinition | null }) {
  const { t } = useTranslation(['integration-sync', 'common'])
  const links = useWasichaiLinks()
  const [draft, setDraft] = useState<DefinitionDraft>(() => (initial ? draftOf(initial) : blankDraft()))
  // advanced shows the transform column; a stored definition with any transform opens with it
  const [advanced, setAdvanced] = useState(() => draft.mappings.some((mapping) => mapping.transform.type !== 'copy'))
  const [saved, setSaved] = useState<{ id: string; version: number } | null>(initial ? { id: initial.id, version: initial.version } : null)
  const [placed, setPlaced] = useState<PlacedViolations>(NO_VIOLATIONS)
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const save = useSaveDefinition()
  const validate = useValidateDefinition()
  const busy = save.isPending || validate.isPending

  const connections = useQuery(connectionOptionsQuery())
  const aResources = useQuery(resourceOptionsQuery(draft.aConnection || null))
  const bResources = useQuery(resourceOptionsQuery(draft.bConnection || null))
  const aSchema = useQuery(schemaOptionsQuery(draft.aConnection || null, draft.aResource || null))
  const bSchema = useQuery(schemaOptionsQuery(draft.bConnection || null, draft.bResource || null))

  const connectionOptions = (connections.data ?? []).map((connection) => ({ value: connection.id, label: `${connection.name} (${connection.connectorId})` }))
  const resourceOptions = (data: { name: string; label: string }[] | undefined) =>
    (data ?? []).map((resource) => ({ value: resource.name, label: resource.label }))
  const fieldOptions = (data: { fields: { name: string; label: string; type: string }[] } | undefined) =>
    (data?.fields ?? []).map((field) => ({ value: field.name, label: `${field.label} · ${field.type}` }))
  const aFields = fieldOptions(aSchema.data)
  const bFields = fieldOptions(bSchema.data)

  const set = (patch: Partial<DefinitionDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const setMapping = (uid: number, patch: Partial<MappingDraft>) =>
    setDraft((current) => ({ ...current, mappings: current.mappings.map((mapping) => (mapping.uid === uid ? { ...mapping, ...patch } : mapping)) }))
  const setTransform = (uid: number, patch: Partial<TransformDraft>) =>
    setDraft((current) => ({
      ...current,
      mappings: current.mappings.map((mapping) => (mapping.uid === uid ? { ...mapping, transform: { ...mapping.transform, ...patch } } : mapping))
    }))

  const toggleAdvanced = (on: boolean) => {
    setAdvanced(on)
    // back to simple: every row copies again, nothing hidden is sent
    if (!on) setDraft((current) => ({ ...current, mappings: current.mappings.map((mapping) => ({ ...mapping, transform: blankTransform() })) }))
  }

  const store = async (): Promise<SyncDefinition | null> => {
    setPlaced(NO_VIOLATIONS)
    setMessage(null)
    setNotice(null)
    try {
      const stored = await save.mutateAsync({ id: saved?.id ?? null, version: saved?.version ?? null, request: requestOf(draft) })
      setSaved({ id: stored.id, version: stored.version })
      return stored
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 412) setMessage(t('wizard.stale'))
      else {
        const problem = formError(cause)
        setPlaced(placeViolations(problem.violations))
        setMessage(problem.message)
      }
      return null
    }
  }

  const saveDraft = async () => {
    if (await store()) setNotice(t('wizard.saved'))
  }

  // saved first: the server validates a stored definition against the live schemas of both sides
  const runValidation = async () => {
    const stored = await store()
    if (!stored) return
    try {
      const result = await validate.mutateAsync(stored.id)
      if (result.valid) setNotice(t('wizard.valid'))
      else {
        setPlaced(placeViolations(result.errors))
        setMessage(t('wizard.invalid'))
      }
    } catch (cause) {
      setMessage(formError(cause).message)
    }
  }

  const side = (label: 'a' | 'b') => {
    const connection = label === 'a' ? draft.aConnection : draft.bConnection
    const resource = label === 'a' ? draft.aResource : draft.bResource
    const resources = label === 'a' ? aResources : bResources
    const schema = label === 'a' ? aSchema : bSchema
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t(label === 'a' ? 'wizard.sideA' : 'wizard.sideB')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Pick
            id={`side-${label}-connection`}
            label={t('wizard.connection')}
            value={connection}
            // another connection has other resources: the resource and every field of this side start over
            onChange={(value) => set(label === 'a' ? { aConnection: value, aResource: '', matchA: '' } : { bConnection: value, bResource: '', matchB: '' })}
            options={connectionOptions}
            placeholder={t('wizard.pickConnection')}
            error={placed.form[`${label}.connectionId`]}
          />
          <Pick
            id={`side-${label}-resource`}
            label={t('wizard.resource')}
            value={resource}
            onChange={(value) => set(label === 'a' ? { aResource: value, matchA: '' } : { bResource: value, matchB: '' })}
            options={resourceOptions(resources.data)}
            placeholder={t('wizard.pickResource')}
            error={placed.form[`${label}.resource`]}
            disabled={!connection || resources.isPending}
          />
          {resources.isError ? <Alert tone="danger">{t('wizard.resourcesFailed', { error: resources.error.message })}</Alert> : null}
          {schema.isError ? <Alert tone="danger">{t('wizard.schemaFailed', { error: schema.error.message })}</Alert> : null}
        </CardBody>
      </Card>
    )
  }

  const title = initial ? t('wizard.editTitle', { name: initial.name }) : t('wizard.newTitle')

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-sync:definitions')} className="text-sm text-ink-muted hover:text-ink">
            {t('definitions.title')}
          </Link>
        }
        title={title}
        subtitle={t('wizard.subtitle')}
      />
      <form className="space-y-5 p-4 md:p-8" noValidate onSubmit={(event) => event.preventDefault()}>
        <Card>
          <CardHeader>
            <CardTitle>{t('wizard.basics')}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Text id="definition-name" label={t('wizard.name')} value={draft.name} onChange={(name) => set({ name })} error={placed.form.name} />
            <Pick
              id="definition-direction"
              label={t('wizard.direction')}
              value={draft.direction}
              onChange={(value) => set({ direction: value as DefinitionDraft['direction'] })}
              options={DIRECTIONS.map((value) => ({ value, label: t(`direction.${value}`) }))}
              error={placed.form.direction}
            />
            <Pick
              id="definition-delete-policy"
              label={t('wizard.deletePolicy')}
              value={draft.deletePolicy}
              onChange={(value) => set({ deletePolicy: value as DefinitionDraft['deletePolicy'] })}
              options={DELETE_POLICIES.map((value) => ({ value, label: t(`deletePolicy.${value}`) }))}
              error={placed.form.deletePolicy}
            />
            <Text
              id="definition-schedule"
              label={t('wizard.schedule')}
              type="number"
              value={draft.scheduleSeconds}
              onChange={(scheduleSeconds) => set({ scheduleSeconds })}
              error={placed.form.scheduleSeconds}
              hint={t('wizard.scheduleHint')}
            />
            <Text
              id="definition-reconcile"
              label={t('wizard.reconcile')}
              type="number"
              value={draft.reconcileSeconds}
              onChange={(reconcileSeconds) => set({ reconcileSeconds })}
              error={placed.form.reconcileSeconds}
              hint={t('wizard.reconcileHint')}
            />
          </CardBody>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {side('a')}
          {side('b')}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('wizard.matchOn')}</CardTitle>
            <p className="text-xs text-ink-muted">{t('wizard.matchOnHint')}</p>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Pick
              id="match-a"
              label={t('wizard.fieldA')}
              value={draft.matchA}
              onChange={(matchA) => set({ matchA })}
              options={aFields}
              placeholder={t('wizard.none')}
              disabled={aFields.length === 0}
              error={placed.form.matchOn}
            />
            <Pick
              id="match-b"
              label={t('wizard.fieldB')}
              value={draft.matchB}
              onChange={(matchB) => set({ matchB })}
              options={bFields}
              placeholder={t('wizard.none')}
              disabled={bFields.length === 0}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t('wizard.mappings')}</CardTitle>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className={CHECKBOX} checked={advanced} onChange={(event) => toggleAdvanced(event.target.checked)} />
              {t('wizard.advanced')}
            </label>
          </CardHeader>
          <CardBody className="space-y-4">
            {placed.form.mappings ? <Alert tone="danger">{placed.form.mappings}</Alert> : null}
            <ol className="space-y-4">
              {draft.mappings.map((mapping, index) => (
                <MappingRow
                  key={mapping.uid}
                  index={index}
                  mapping={mapping}
                  advanced={advanced}
                  aFields={aFields}
                  bFields={bFields}
                  errors={placed.rows[index] ?? {}}
                  onChange={(patch) => setMapping(mapping.uid, patch)}
                  onTransform={(patch) => setTransform(mapping.uid, patch)}
                  onRemove={
                    draft.mappings.length > 1
                      ? () => setDraft((current) => ({ ...current, mappings: current.mappings.filter((m) => m.uid !== mapping.uid) }))
                      : undefined
                  }
                />
              ))}
            </ol>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDraft((current) => ({ ...current, mappings: [...current.mappings, blankMapping(current.direction)] }))}
            >
              <Plus className="size-4" />
              {t('wizard.addMapping')}
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-3">
          {message ? (
            <Alert tone="danger" title={message}>
              {placed.rest.length ? placed.rest.map((violation) => `${violation.field}: ${violation.message}`).join(' — ') : null}
            </Alert>
          ) : null}
          {notice ? (
            <Alert tone="success" onDismiss={() => setNotice(null)}>
              {notice}{' '}
              {saved ? (
                <Link to={links.to('integration-sync:definition', { definitionId: saved.id })} className="underline">
                  {t('wizard.open')}
                </Link>
              ) : null}
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void saveDraft()} disabled={busy}>
              {t('wizard.save')}
            </Button>
            <Button type="button" onClick={() => void runValidation()} disabled={busy}>
              {t('wizard.validate')}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

function MappingRow({
  index,
  mapping,
  advanced,
  aFields,
  bFields,
  errors,
  onChange,
  onTransform,
  onRemove
}: {
  index: number
  mapping: MappingDraft
  advanced: boolean
  aFields: Option[]
  bFields: Option[]
  errors: Record<string, string>
  onChange: (patch: Partial<MappingDraft>) => void
  onTransform: (patch: Partial<TransformDraft>) => void
  onRemove?: () => void
}) {
  const { t } = useTranslation('integration-sync')
  const id = `mapping-${mapping.uid}`
  const transform = mapping.transform

  let params: ReactNode = null
  if (advanced) {
    if (transform.type === 'static' || transform.type === 'default') {
      params = <Text id={`${id}-value`} label={t('transform.value')} value={transform.value} onChange={(value) => onTransform({ value })} />
    } else if (transform.type === 'enumMap') {
      params = (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-map`}>{t('transform.map')}</Label>
          <Textarea id={`${id}-map`} value={transform.map} onChange={(event) => onTransform({ map: event.target.value })} aria-describedby={`${id}-map-hint`} />
          <p id={`${id}-map-hint`} className="text-xs text-ink-muted">
            {t('transform.mapHint')}
          </p>
        </div>
      )
    } else if (transform.type === 'dateTime') {
      params = (
        <>
          <Text id={`${id}-zone`} label={t('transform.zone')} value={transform.zone} onChange={(zone) => onTransform({ zone })} />
          <Pick
            id={`${id}-date-a`}
            label={t('transform.kindA')}
            value={transform.a}
            onChange={(value) => onTransform({ a: value as DateKind })}
            options={DATE_KINDS.map((value) => ({ value, label: t(`dateKind.${value}`) }))}
          />
          <Pick
            id={`${id}-date-b`}
            label={t('transform.kindB')}
            value={transform.b}
            onChange={(value) => onTransform({ b: value as DateKind })}
            options={DATE_KINDS.map((value) => ({ value, label: t(`dateKind.${value}`) }))}
          />
        </>
      )
    } else if (transform.type === 'number') {
      params = <Text id={`${id}-scale`} label={t('transform.scale')} type="number" value={transform.scale} onChange={(scale) => onTransform({ scale })} />
    } else if (transform.type === 'conditional') {
      params = (
        <>
          <Text id={`${id}-equals`} label={t('transform.equals')} value={transform.equals} onChange={(equals) => onTransform({ equals })} />
          <Text id={`${id}-then`} label={t('transform.then')} value={transform.then} onChange={(then) => onTransform({ then })} />
          <Text id={`${id}-else`} label={t('transform.else')} value={transform.otherwise} onChange={(otherwise) => onTransform({ otherwise })} />
        </>
      )
    }
  }

  return (
    <li className="rounded-md border border-border p-4" aria-label={t('wizard.mappingN', { n: index + 1 })}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t('wizard.mappingN', { n: index + 1 })}</h3>
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t('wizard.removeMapping', { n: index + 1 })}>
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Pick
          id={`${id}-a`}
          label={t('wizard.fieldA')}
          value={mapping.aField}
          onChange={(aField) => onChange({ aField })}
          options={aFields}
          placeholder={t('wizard.pickField')}
          error={errors.aField}
        />
        <Pick
          id={`${id}-b`}
          label={t('wizard.fieldB')}
          value={mapping.bField}
          onChange={(bField) => onChange({ bField })}
          options={bFields}
          placeholder={t('wizard.pickField')}
          error={errors.bField}
        />
        <Pick
          id={`${id}-owner`}
          label={t('wizard.owner')}
          value={mapping.owner}
          onChange={(value) => onChange({ owner: value as MappingDraft['owner'] })}
          options={OWNERS.map((value) => ({ value, label: t(`owner.${value}`) }))}
          error={errors.owner}
        />
        <Pick
          id={`${id}-strategy`}
          label={t('wizard.conflictStrategy')}
          value={mapping.conflictStrategy}
          onChange={(value) => onChange({ conflictStrategy: value as MappingDraft['conflictStrategy'] })}
          options={STRATEGIES.map((value) => ({ value, label: t(`strategy.${value}`) }))}
          error={errors.conflictStrategy}
        />
        {advanced ? (
          <Pick
            id={`${id}-transform`}
            label={t('wizard.transform')}
            value={transform.type}
            onChange={(value) => onTransform({ type: value as TransformDraft['type'] })}
            options={TRANSFORM_TYPES.map((value) => ({ value, label: t(`transform.types.${value}`) }))}
            error={errors.transform}
          />
        ) : null}
        {params}
      </div>
      {!advanced && errors.transform ? <FieldError id={`${id}-transform-error`} message={errors.transform} /> : null}
    </li>
  )
}
