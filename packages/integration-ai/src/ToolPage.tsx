import { useQuery } from '@tanstack/react-query'
import { History, Pencil, Play, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader, QueryState, describeError, formError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, ConfirmDialog, Input, Label, Textarea } from '@wasichai/ui'
import { connectionOptionsQuery, toolQuery, useDeleteTool, useExecuteTool } from './api'
import { ExecutionStatusBadge, Json, Time, ToolBadges, ToolTarget } from './badges'
import { FieldError, Pick } from './fields'
import { useCanManageTools } from './permissions'
import { formInput, placeViolations, simpleFields, type SimpleField } from './schema'
import type { Tool, ToolExecution } from './types'

const CHECKBOX = 'h-4 w-4 accent-brand'

export function ToolPage() {
  const { toolName } = useParams()
  const query = useQuery(toolQuery(toolName))
  return <QueryState query={query}>{(tool) => <ToolDetail tool={tool} />}</QueryState>
}

function ToolDetail({ tool }: { tool: Tool }) {
  const { t } = useTranslation(['integration-ai', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const canManage = useCanManageTools()
  const connections = useQuery(connectionOptionsQuery())
  const remove = useDeleteTool()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const connection = connections.data?.find((candidate) => candidate.id === tool.connectionId)

  const confirmDelete = async () => {
    setDeleteError(null)
    try {
      await remove.mutateAsync(tool.name)
      navigate(links.to('integration-ai:tools'), { replace: true })
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-ai:tools')} className="text-sm text-ink-muted hover:text-ink">
            {t('tools.title')}
          </Link>
        }
        title={tool.name}
        subtitle={tool.description}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to={`${links.to('integration-ai:executions')}?${new URLSearchParams({ tool: tool.name })}`}>
                <History className="size-4" />
                {t('tool.executions')}
              </Link>
            </Button>
            {canManage ? (
              <>
                <Button asChild variant="secondary">
                  <Link to={links.to('integration-ai:editTool', { toolName: tool.name })}>
                    <Pencil className="size-4" />
                    {t('common.edit')}
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} aria-label={t('tool.delete')}>
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : null}
          </>
        }
      >
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <ToolBadges tool={tool} />
          <Fact label={t('tools.connection')}>{connection ? connection.name : tool.connectionId}</Fact>
          <Fact label={t('tools.does')}>
            <ToolTarget tool={tool} />
          </Fact>
          {tool.externalIdField ? <Fact label={t('editor.externalIdField')}>{tool.externalIdField}</Fact> : null}
          <Fact label={t('tools.roles')}>{tool.allowedRoles.length ? tool.allowedRoles.join(', ') : t('tool.managersOnly')}</Fact>
          <Fact label={t('editor.rateLimit')}>{tool.rateLimitPerMinute}</Fact>
          <Fact label={t('tool.updated')}>
            <Time value={tool.updatedAt} />
          </Fact>
        </dl>
      </PageHeader>
      <div className="grid gap-5 p-4 md:p-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('editor.inputSchema')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <Json value={tool.inputSchema} label={t('editor.inputSchema')} />
            {tool.kind === 'RESOURCE' ? <p className="text-xs text-ink-muted">{t('tool.derived')}</p> : null}
          </CardBody>
        </Card>
        <TryCard tool={tool} />
      </div>
      {deleting ? (
        <ConfirmDialog
          title={t('tool.delete')}
          description={t('tool.deleteConfirm', { name: tool.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-ink-muted">{label}:</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}

// calls the tool as the person signed in: the same policy an agent meets. a form for a flat schema, JSON otherwise
function TryCard({ tool }: { tool: Tool }) {
  const { t } = useTranslation('integration-ai')
  const links = useWasichaiLinks()
  const execute = useExecuteTool()
  const fields = simpleFields(tool.inputSchema)
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [text, setText] = useState('{}')
  const [violations, setViolations] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ToolExecution | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setViolations({})
    setError(null)
    setResult(null)
    let input: unknown
    if (fields) {
      input = formInput(fields, values)
    } else {
      try {
        input = JSON.parse(text || '{}')
      } catch {
        input = undefined
      }
      if (input === undefined || input === null || typeof input !== 'object' || Array.isArray(input)) {
        setViolations({ input: t('try.notObject') })
        return
      }
    }
    try {
      setResult(await execute.mutateAsync({ name: tool.name, input }))
    } catch (cause) {
      const problem = formError(cause)
      // input.<field>: under that field in the form; the whole JSON otherwise
      const names = fields ? fields.map((field) => `input.${field.name}`) : ['input']
      const placed = placeViolations(problem.violations, names)
      setViolations(Object.fromEntries(Object.entries(placed.byField).map(([key, message]) => [fields ? key.slice('input.'.length) : key, message])))
      if (placed.rest.length || !problem.violations.length) setError(describeError(cause))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('try.title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-muted">{t(tool.approvalRequired ? 'try.hintApproval' : 'try.hint')}</p>
        {!tool.enabled ? (
          <Alert tone="warning">{t('try.disabled')}</Alert>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
            {fields ? (
              fields.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('try.noInput')}</p>
              ) : (
                fields.map((field) => (
                  <TryField
                    key={field.name}
                    field={field}
                    value={values[field.name]}
                    onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                    error={violations[field.name]}
                  />
                ))
              )
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="try-input">{t('try.input')}</Label>
                <Textarea
                  id="try-input"
                  rows={8}
                  className="font-mono text-xs"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  aria-invalid={violations.input ? true : undefined}
                  aria-describedby={violations.input ? 'try-input-error' : 'try-input-hint'}
                />
                {violations.input ? (
                  <FieldError id="try-input-error" message={violations.input} />
                ) : (
                  <p id="try-input-hint" className="text-xs text-ink-muted">
                    {t('try.inputHint')}
                  </p>
                )}
              </div>
            )}
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={execute.isPending}>
                <Play className="size-4" />
                {t('try.submit')}
              </Button>
            </div>
          </form>
        )}
        {result ? (
          <div className="space-y-2 rounded border border-border p-3" role="status">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ExecutionStatusBadge status={result.status} />
              <span className="text-ink-muted">{t(`try.result.${result.status}`)}</span>
              <Link to={links.to('integration-ai:execution', { executionId: result.id })} className="text-xs text-ink-muted hover:underline">
                {t('executions.details')}
              </Link>
            </div>
            {result.error ? (
              <p className="text-xs text-danger">
                {result.errorKind ? `${t(`errorKind.${result.errorKind}`)}: ` : ''}
                {result.error}
              </p>
            ) : null}
            {result.output != null ? <Json value={result.output} label={t('execution.output')} /> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

function TryField({
  field,
  value,
  onChange,
  error
}: {
  field: SimpleField
  value: string | boolean | undefined
  onChange: (value: string | boolean) => void
  error?: string
}) {
  const { t } = useTranslation('integration-ai')
  const id = `try-${field.name}`
  const label = field.required ? field.label : t('try.optional', { label: field.label })
  if (field.type === 'boolean') {
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {label}
        </label>
        <FieldError id={`${id}-error`} message={error} />
      </div>
    )
  }
  if (field.options) {
    return (
      <Pick
        id={id}
        label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        options={field.options.map((option) => ({ value: option, label: option }))}
        error={error}
      />
    )
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={field.type === 'string' ? 'text' : 'number'}
        step={field.type === 'integer' ? 1 : 'any'}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : field.description ? `${id}-hint` : undefined}
      />
      {error ? (
        <FieldError id={`${id}-error`} message={error} />
      ) : field.description ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {field.description}
        </p>
      ) : null}
    </div>
  )
}
