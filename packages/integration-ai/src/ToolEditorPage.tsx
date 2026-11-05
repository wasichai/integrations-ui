import { useQuery } from '@tanstack/react-query'
import { Plus, Save, X } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, PageHeader, QueryState, formError, useRoles, useWasichaiLinks, type FieldViolation } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Textarea } from '@wasichai/ui'
import { connectionOptionsQuery, connectorOptionQuery, resourceOptionsQuery, toolQuery, useCreateTool, useSaveTool } from './api'
import { Json } from './badges'
import { FieldError, Pick, Text, type Option } from './fields'
import { useCanManageTools } from './permissions'
import { defaultApproval, operationsFor, parseSchema, placeViolations } from './schema'
import type { Tool, ToolKind, ToolOperation, ToolRequest } from './types'

const CHECKBOX = 'h-4 w-4 accent-brand'
const FIELDS = [
  'name',
  'description',
  'connectionId',
  'action',
  'resource',
  'operation',
  'externalIdField',
  'inputSchema',
  'allowedRoles',
  'rateLimitPerMinute'
]
// a start an administrator fills in: the backend closes every object (additionalProperties: false)
const STARTER_SCHEMA = JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2)
const MAX_ROLES = 50

export function ToolEditorPage() {
  const { toolName } = useParams()
  const query = useQuery(toolQuery(toolName))
  if (!toolName) return <ToolForm tool={null} />
  // a reload after a 412 remounts the form on the new version
  return <QueryState query={query}>{(tool) => <ToolForm key={tool.version} tool={tool} onReload={() => void query.refetch()} />}</QueryState>
}

interface Draft {
  connectionId: string
  kind: ToolKind
  action: string
  resource: string
  operation: ToolOperation | ''
  externalIdField: string
  name: string
  description: string
  roles: string[]
  approvalRequired: boolean
  // once set by hand, the kind and operation no longer move it
  approvalTouched: boolean
  rateLimit: string
  enabled: boolean
  schemaText: string
}

function draftOf(tool: Tool | null): Draft {
  if (!tool) {
    return {
      connectionId: '',
      kind: 'ACTION',
      action: '',
      resource: '',
      operation: '',
      externalIdField: '',
      name: '',
      description: '',
      roles: [],
      approvalRequired: true,
      approvalTouched: false,
      rateLimit: '60',
      enabled: true,
      schemaText: STARTER_SCHEMA
    }
  }
  return {
    connectionId: tool.connectionId,
    kind: tool.kind,
    action: tool.action ?? '',
    resource: tool.resource ?? '',
    operation: tool.operation ?? '',
    externalIdField: tool.externalIdField ?? '',
    name: tool.name,
    description: tool.description,
    roles: tool.allowedRoles,
    approvalRequired: tool.approvalRequired,
    approvalTouched: true,
    rateLimit: String(tool.rateLimitPerMinute),
    enabled: tool.enabled,
    schemaText: tool.kind === 'ACTION' ? JSON.stringify(tool.inputSchema, null, 2) : STARTER_SCHEMA
  }
}

function requestOf(draft: Draft, inputSchema: unknown): ToolRequest {
  const common = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    connectionId: draft.connectionId,
    allowedRoles: draft.roles,
    approvalRequired: draft.approvalRequired,
    rateLimitPerMinute: Number(draft.rateLimit),
    enabled: draft.enabled
  }
  if (draft.kind === 'ACTION') return { ...common, action: draft.action, inputSchema }
  return {
    ...common,
    resource: draft.resource.trim(),
    // the backend takes any case
    operation: draft.operation.toLowerCase(),
    ...(draft.operation === 'UPSERT' ? { externalIdField: draft.externalIdField.trim() } : {})
  }
}

// with the current value kept, so an edit never loses what the tool holds
const withCurrent = (options: Option[], current: string): Option[] =>
  current && !options.some((option) => option.value === current) ? [{ value: current, label: current }, ...options] : options

function ToolForm({ tool, onReload }: { tool: Tool | null; onReload?: () => void }) {
  const { t } = useTranslation(['integration-ai', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const canManage = useCanManageTools()
  const create = useCreateTool()
  const save = useSaveTool()
  const [draft, setDraft] = useState<Draft>(() => draftOf(tool))
  const [violations, setViolations] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState<{ message: string; rest: FieldViolation[]; stale: boolean } | null>(null)

  const connections = useQuery(connectionOptionsQuery())
  const connection = connections.data?.find((candidate) => candidate.id === draft.connectionId)
  const connector = useQuery(connectorOptionQuery(connection?.connectorId))
  const discovers = Boolean(connector.data?.capabilities.DISCOVERY)
  const discovered = useQuery({ ...resourceOptionsQuery(draft.connectionId || undefined), enabled: Boolean(draft.connectionId) && discovers })

  const update = (patch: Partial<Draft>) =>
    setDraft((current) => {
      const next = { ...current, ...patch }
      return next.approvalTouched ? next : { ...next, approvalRequired: defaultApproval(next.kind, next.operation || null) }
    })

  const back = tool ? links.to('integration-ai:tool', { toolName: tool.name }) : links.to('integration-ai:tools')
  const busy = create.isPending || save.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setProblem(null)
    const local: Record<string, string> = {}
    if (!draft.name.trim()) local.name = t('editor.required')
    if (!draft.description.trim()) local.description = t('editor.required')
    if (!draft.connectionId) local.connectionId = t('editor.required')
    let inputSchema: unknown
    if (draft.kind === 'ACTION') {
      if (!draft.action) local.action = t('editor.required')
      const parsed = parseSchema(draft.schemaText)
      if ('error' in parsed) local.inputSchema = t(`editor.schema.${parsed.error}`)
      else inputSchema = parsed.schema
    } else {
      if (!draft.resource.trim()) local.resource = t('editor.required')
      if (!draft.operation) local.operation = t('editor.required')
      if (draft.operation === 'UPSERT' && !draft.externalIdField.trim()) local.externalIdField = t('editor.required')
    }
    const rate = Number(draft.rateLimit)
    if (!Number.isInteger(rate) || rate < 1 || rate > 10000) local.rateLimitPerMinute = t('editor.rateRange')
    setViolations(local)
    if (Object.keys(local).length > 0) return

    const request = requestOf(draft, inputSchema)
    try {
      const saved = tool ? await save.mutateAsync({ name: tool.name, version: tool.version, request }) : await create.mutateAsync(request)
      navigate(links.to('integration-ai:tool', { toolName: saved.name }))
    } catch (cause) {
      const { message, violations: found } = formError(cause)
      const placed = placeViolations(found, FIELDS)
      setViolations(placed.byField)
      const stale = cause instanceof ApiError && cause.status === 412
      setProblem({ message: stale ? t('editor.stale') : message, rest: placed.rest, stale })
    }
  }

  if (!canManage) {
    return (
      <>
        <PageHeader title={t(tool ? 'editor.editTitle' : 'editor.newTitle')} />
        <div className="p-4 md:p-8">
          <Alert tone="warning">{t('editor.notAllowed')}</Alert>
        </div>
      </>
    )
  }

  const connectionOptions = withCurrent(
    (connections.data ?? []).map((candidate) => ({ value: candidate.id, label: `${candidate.name} (${candidate.connectorId})` })),
    draft.connectionId
  )
  const actionOptions = withCurrent(
    (connector.data?.actions ?? []).map((action) => ({
      value: action.name,
      label: action.sensitive ? t('editor.sensitive', { label: action.label }) : action.label
    })),
    draft.action
  )
  const declared = (connector.data?.resources ?? []).filter((resource) => !resource.dynamic)
  const resourceOptions = withCurrent(
    [...(discovered.data ?? []), ...declared.filter((resource) => !discovered.data?.some((found) => found.name === resource.name))].map((resource) => ({
      value: resource.name,
      label: resource.label
    })),
    draft.resource
  )
  const operationOptions = withCurrent(
    operationsFor(connector.data).map((op) => ({ value: op, label: t(`operation.${op}`) })),
    draft.operation
  )
  const noActions = connector.data && !connector.data.capabilities.ACTIONS

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={back} className="text-sm text-ink-muted hover:text-ink">
            {tool ? tool.name : t('tools.title')}
          </Link>
        }
        title={t(tool ? 'editor.editTitle' : 'editor.newTitle')}
        subtitle={t('editor.subtitle')}
      />
      <form onSubmit={(event) => void submit(event)} className="space-y-5 p-4 md:p-8" noValidate>
        {problem ? (
          <Alert tone="danger">
            <p>{problem.message}</p>
            {problem.rest.length ? (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {problem.rest.map((violation) => (
                  <li key={`${violation.field}-${violation.message}`}>
                    {violation.field}: {violation.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {problem.stale && onReload ? (
              <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={onReload}>
                {t('editor.reload')}
              </Button>
            ) : null}
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('editor.what')}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Pick
                id="tool-connection"
                label={t('tools.connection')}
                value={draft.connectionId}
                onChange={(connectionId) => update({ connectionId, action: '', resource: '' })}
                options={connectionOptions}
                placeholder={t('editor.pickConnection')}
                error={violations.connectionId}
              />
              {connections.isError ? <p className="mt-1 text-xs text-warning">{t('tools.connectionsUnavailable')}</p> : null}
            </div>
            <fieldset className="space-y-1.5 md:col-span-2">
              <legend className="text-sm font-medium text-ink">{t('editor.kind')}</legend>
              <div className="flex flex-wrap gap-4">
                {(['ACTION', 'RESOURCE'] as ToolKind[]).map((kind) => (
                  <label key={kind} className="flex items-center gap-2 text-sm text-ink">
                    <input type="radio" name="tool-kind" className={CHECKBOX} checked={draft.kind === kind} onChange={() => update({ kind })} />
                    {t(`kind.${kind}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {draft.kind === 'ACTION' ? (
              <div className="md:col-span-2">
                <Pick
                  id="tool-action"
                  label={t('editor.action')}
                  value={draft.action}
                  onChange={(action) => update({ action })}
                  options={actionOptions}
                  placeholder={t('editor.pickAction')}
                  error={violations.action}
                />
                {noActions ? <p className="mt-1 text-xs text-warning">{t('editor.noActions')}</p> : null}
              </div>
            ) : (
              <>
                {resourceOptions.length > 0 ? (
                  <Pick
                    id="tool-resource"
                    label={t('editor.resource')}
                    value={draft.resource}
                    onChange={(resource) => update({ resource })}
                    options={resourceOptions}
                    placeholder={t('editor.pickResource')}
                    error={violations.resource}
                  />
                ) : (
                  <Text
                    id="tool-resource"
                    label={t('editor.resource')}
                    value={draft.resource}
                    onChange={(resource) => update({ resource })}
                    error={violations.resource}
                    hint={discovered.isError ? t('editor.resourcesUnavailable') : undefined}
                  />
                )}
                <Pick
                  id="tool-operation"
                  label={t('editor.operation')}
                  value={draft.operation}
                  onChange={(operation) => update({ operation: operation as ToolOperation })}
                  options={operationOptions}
                  placeholder={t('editor.pickOperation')}
                  error={violations.operation}
                />
                {draft.operation === 'UPSERT' ? (
                  <Text
                    id="tool-external-id"
                    label={t('editor.externalIdField')}
                    value={draft.externalIdField}
                    onChange={(externalIdField) => update({ externalIdField })}
                    error={violations.externalIdField}
                    hint={t('editor.externalIdHint')}
                  />
                ) : null}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('editor.forTheModel')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Text
              id="tool-name"
              label={t('tools.name')}
              value={draft.name}
              onChange={(name) => update({ name })}
              error={violations.name}
              hint={t('editor.nameHint')}
              mono
            />
            <Text
              id="tool-description"
              label={t('editor.description')}
              value={draft.description}
              onChange={(description) => update({ description })}
              error={violations.description}
              hint={t('editor.descriptionHint')}
              multiline
            />
            {draft.kind === 'ACTION' ? (
              <div className="space-y-1.5">
                <Label htmlFor="tool-schema">{t('editor.inputSchema')}</Label>
                <Textarea
                  id="tool-schema"
                  rows={12}
                  className="font-mono text-xs"
                  value={draft.schemaText}
                  onChange={(event) => update({ schemaText: event.target.value })}
                  aria-invalid={violations.inputSchema ? true : undefined}
                  aria-describedby={violations.inputSchema ? 'tool-schema-error' : 'tool-schema-hint'}
                />
                {violations.inputSchema ? (
                  <FieldError id="tool-schema-error" message={violations.inputSchema} />
                ) : (
                  <p id="tool-schema-hint" className="text-xs text-ink-muted">
                    {t('editor.schemaHint')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">{t('editor.derivedSchema')}</p>
                {tool?.kind === 'RESOURCE' ? <Json value={tool.inputSchema} label={t('editor.derivedSchema')} /> : null}
                <p className="text-xs text-ink-muted">{t('editor.derivedHint')}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('editor.policy')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Roles roles={draft.roles} onChange={(roles) => update({ roles })} error={violations.allowedRoles} />
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className={CHECKBOX}
                  checked={draft.approvalRequired}
                  onChange={(event) => update({ approvalRequired: event.target.checked, approvalTouched: true })}
                  aria-describedby="tool-approval-hint"
                />
                {t('editor.approvalRequired')}
              </label>
              <p id="tool-approval-hint" className="text-xs text-ink-muted">
                {t('editor.approvalHint')}
              </p>
            </div>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="tool-rate">{t('editor.rateLimit')}</Label>
              <Input
                id="tool-rate"
                type="number"
                min={1}
                max={10000}
                value={draft.rateLimit}
                onChange={(event) => update({ rateLimit: event.target.value })}
                aria-invalid={violations.rateLimitPerMinute ? true : undefined}
                aria-describedby={violations.rateLimitPerMinute ? 'tool-rate-error' : 'tool-rate-hint'}
              />
              {violations.rateLimitPerMinute ? (
                <FieldError id="tool-rate-error" message={violations.rateLimitPerMinute} />
              ) : (
                <p id="tool-rate-hint" className="text-xs text-ink-muted">
                  {t('editor.rateHint')}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className={CHECKBOX} checked={draft.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
              {t('editor.enabled')}
            </label>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link to={back}>{t('common.cancel')}</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            <Save className="size-4" />
            {t(tool ? 'common.save' : 'common.create')}
          </Button>
        </div>
      </form>
    </>
  )
}

// role names as chips. the tenant's roles are offered when they can be read; any name can be typed
function Roles({ roles, onChange, error }: { roles: string[]; onChange: (roles: string[]) => void; error?: string }) {
  const { t } = useTranslation('integration-ai')
  const known = useRoles()
  const [typed, setTyped] = useState('')

  const add = () => {
    // wasichai keeps role names upper case
    const role = typed.trim().toUpperCase()
    if (role && !roles.includes(role) && roles.length < MAX_ROLES) onChange([...roles, role])
    setTyped('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="tool-role">{t('editor.roles')}</Label>
      {roles.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('editor.roles')}>
          {roles.map((role) => (
            <li key={role} className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 font-mono text-xs text-ink">
              {role}
              <button
                type="button"
                className="rounded text-ink-muted hover:text-ink"
                onClick={() => onChange(roles.filter((candidate) => candidate !== role))}
                aria-label={t('editor.removeRole', { role })}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">{t('tool.managersOnly')}</p>
      )}
      <div className="flex max-w-md gap-2">
        <Input
          id="tool-role"
          list="tool-role-options"
          value={typed}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'tool-role-error' : 'tool-role-hint'}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!typed.trim()}>
          <Plus className="size-4" />
          {t('editor.addRole')}
        </Button>
      </div>
      <datalist id="tool-role-options">
        {(known.data ?? []).map((role) => (
          <option key={role.name} value={role.name}>
            {role.label}
          </option>
        ))}
      </datalist>
      {error ? (
        <FieldError id="tool-role-error" message={error} />
      ) : (
        <p id="tool-role-hint" className="text-xs text-ink-muted">
          {t(known.isError ? 'editor.rolesUnavailable' : 'editor.rolesHint')}
        </p>
      )}
    </div>
  )
}
