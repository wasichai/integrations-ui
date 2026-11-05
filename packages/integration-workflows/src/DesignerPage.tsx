import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Plus, Rocket, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError, PageHeader, QueryState, formError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Badge, Button, Card, CardBody, Input, Label } from '@wasichai/ui'
import { connectionOptionsQuery, usePublishWorkflow, useSaveWorkflow, useValidateWorkflow, workflowQuery } from './api'
import { WorkflowBadges } from './badges'
import { useCanManageWorkflows } from './permissions'
import { Pick } from './fields'
import { addStep, blankStep, freeId, layout, placeViolations, setEdge, STEP_TYPES, stepsOf, TRIGGER_NODE, type PlacedViolations, type XY } from './graph'
import { Inspector } from './Inspector'
import type { StepType, Violation, Workflow, WorkflowGraph } from './types'
import { WorkflowCanvas } from './WorkflowCanvas'

const NO_VIOLATIONS: PlacedViolations = { nodes: {}, rest: [] }

// the draft's editor. lazy route: xyflow comes with this page only
export function DesignerPage() {
  const { workflowId } = useParams()
  const query = useQuery(workflowQuery(workflowId))
  return <QueryState query={query}>{(workflow) => <Designer key={workflow.id} workflow={workflow} />}</QueryState>
}

function Designer({ workflow }: { workflow: Workflow }) {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const links = useWasichaiLinks()
  const save = useSaveWorkflow()
  const validate = useValidateWorkflow()
  const publish = usePublishWorkflow()
  const canManage = useCanManageWorkflows()
  // degraded: without the connection list a step still shows (and keeps) the id it holds
  const connectionsQuery = useQuery(connectionOptionsQuery())
  const [name, setName] = useState(workflow.name)
  const [graph, setGraph] = useState<WorkflowGraph>(() => ({ ...workflow.graph, steps: stepsOf(workflow.graph) }))
  const [version, setVersion] = useState(workflow.version)
  const [current, setCurrent] = useState(workflow)
  const [dirty, setDirty] = useState(false)
  const [selected, setSelected] = useState<string | null>(TRIGGER_NODE)
  const [moved, setMoved] = useState<Record<string, XY>>({})
  const [newType, setNewType] = useState<StepType>('action')
  const [placed, setPlaced] = useState<PlacedViolations>(NO_VIOLATIONS)
  const [nameError, setNameError] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const positions = useMemo(() => ({ ...layout(graph), ...moved }), [graph, moved])
  const problems = useMemo(() => Object.fromEntries(Object.entries(placed.nodes).map(([id, list]) => [id, list.length])), [placed])

  const connections = useMemo(() => {
    const known = (connectionsQuery.data ?? []).map((connection) => ({ value: connection.id, label: connection.name }))
    // an id the list does not hold (another tenant's, deleted, or the list failed) stays pickable as itself
    const used = [graph.trigger?.connectionId, ...stepsOf(graph).map((step) => step.connectionId)].filter((id): id is string => Boolean(id))
    const unknown = [...new Set(used)].filter((id) => !known.some((option) => option.value === id)).map((id) => ({ value: id, label: id }))
    return [...known, ...unknown]
  }, [connectionsQuery.data, graph])

  const change = (next: WorkflowGraph) => {
    setGraph(next)
    setDirty(true)
    setNotice(null)
  }

  const add = () => {
    const id = freeId(graph, newType)
    change(addStep(graph, blankStep(newType, id)))
    setSelected(id)
  }

  const showProblems = (violations: Violation[], text: string) => {
    const next = placeViolations(violations, graph)
    setPlaced(next)
    setNameError(next.rest.find((violation) => violation.field === 'name')?.message)
    setMessage(text)
  }

  // the stored draft is what validate and publish read: store it first when it moved
  const store = async (): Promise<number | null> => {
    setPlaced(NO_VIOLATIONS)
    setNameError(undefined)
    setMessage(null)
    setNotice(null)
    if (!dirty && name === current.name) return version
    try {
      const saved = await save.mutateAsync({ id: workflow.id, version, request: { name: name.trim(), graph } })
      setVersion(saved.version)
      setCurrent(saved)
      setDirty(false)
      return saved.version
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 412) setMessage(t('designer.stale'))
      else {
        const problem = formError(cause)
        showProblems(problem.violations, problem.message)
      }
      return null
    }
  }

  const saveDraft = async () => {
    if ((await store()) !== null) setNotice(t('designer.saved'))
  }

  const runValidation = async () => {
    if ((await store()) === null) return
    try {
      const result = await validate.mutateAsync(workflow.id)
      if (result.valid) setNotice(t('designer.valid'))
      else showProblems(result.errors, t('designer.invalid', { count: result.errors.length }))
    } catch (cause) {
      setMessage(formError(cause).message)
    }
  }

  const runPublish = async () => {
    const stored = await store()
    if (stored === null) return
    try {
      const published = await publish.mutateAsync({ workflowId: workflow.id, version: stored })
      // publishing bumps the workflow's version
      setVersion(stored + 1)
      setCurrent((before) => ({ ...before, status: 'PUBLISHED', publishedVersion: published.number, unpublishedChanges: false, version: stored + 1 }))
      setNotice(t('designer.published', { number: published.number }))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) showProblems(cause.violations, cause.message)
      else if (cause instanceof ApiError && cause.status === 409) setMessage(t('designer.alreadyPublished'))
      else if (cause instanceof ApiError && cause.status === 412) setMessage(t('designer.stale'))
      else setMessage(formError(cause).message)
    }
  }

  const busy = save.isPending || validate.isPending || publish.isPending
  const nodeOptions = [
    { value: TRIGGER_NODE, label: t('designer.trigger') },
    ...stepsOf(graph).map((step) => ({ value: step.id, label: `${step.id} · ${t(`stepType.${step.type}`)}` }))
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-workflows:workflow', { workflowId: workflow.id })} className="text-sm text-ink-muted hover:text-ink">
            {current.name}
          </Link>
        }
        title={t('designer.title')}
        actions={
          // the server refuses a member anyway; a member reads the draft here, read only
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => void saveDraft()} disabled={busy}>
                <Save className="size-4" />
                {t('designer.save')}
              </Button>
              <Button variant="secondary" onClick={() => void runValidation()} disabled={busy}>
                <CheckCircle2 className="size-4" />
                {t('designer.validate')}
              </Button>
              <Button onClick={() => void runPublish()} disabled={busy}>
                <Rocket className="size-4" />
                {t('designer.publish')}
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <WorkflowBadges workflow={current} />
          {dirty ? <Badge>{t('designer.unsaved')}</Badge> : null}
        </div>
      </PageHeader>
      <div className="space-y-4 p-4 md:p-8">
        {notice ? (
          <Alert tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Alert>
        ) : null}
        {message ? (
          <Alert tone="danger">
            {message}
            {placed.rest.filter((violation) => violation.field !== 'name').length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {placed.rest
                  .filter((violation) => violation.field !== 'name')
                  .map((violation, index) => (
                    <li key={index}>{violation.field ? `${violation.field}: ${violation.message}` : violation.message}</li>
                  ))}
              </ul>
            ) : null}
            {Object.keys(placed.nodes).length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-2">
                {Object.entries(placed.nodes).map(([id, list]) => (
                  <li key={id}>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(id)}>
                      {t('designer.showProblems', { node: id === TRIGGER_NODE ? t('designer.trigger') : id, count: list.length })}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
        {canManage ? null : <Alert tone="notice">{t('designer.readOnly')}</Alert>}
        {connectionsQuery.isError ? <Alert tone="warning">{t('designer.connectionsUnavailable')}</Alert> : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72 space-y-1.5">
            <Label htmlFor="designer-name">{t('workflows.name')}</Label>
            <Input
              id="designer-name"
              value={name}
              maxLength={200}
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value)
                setNotice(null)
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'designer-name-error' : undefined}
            />
            {nameError ? (
              <p id="designer-name-error" className="text-xs text-danger">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="w-56">
            <Pick
              id="designer-new-type"
              label={t('designer.newStepType')}
              value={newType}
              onChange={(value) => setNewType(value as StepType)}
              options={STEP_TYPES.map((type) => ({ value: type, label: t(`stepType.${type}`) }))}
            />
          </div>
          <Button variant="secondary" onClick={add}>
            <Plus className="size-4" />
            {t('designer.addStep')}
          </Button>
          <div className="w-64">
            {/* the canvas needs a pointer; this reaches every node from the keyboard */}
            <Pick
              id="designer-node"
              label={t('designer.selectNode')}
              value={selected ?? ''}
              onChange={setSelected}
              options={nodeOptions}
              placeholder={t('designer.pick')}
            />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <Card className="h-[36rem] overflow-hidden">
            <WorkflowCanvas
              graph={graph}
              positions={positions}
              selected={selected}
              problems={problems}
              onSelect={setSelected}
              onMove={(id, at) => setMoved((before) => ({ ...before, [id]: at }))}
              onConnect={(source, handle, target) => change(setEdge(graph, source, handle, target))}
            />
          </Card>
          <Card>
            <CardBody>
              {selected ? (
                <Inspector
                  graph={graph}
                  selected={selected}
                  violations={placed.nodes[selected]}
                  connections={connections}
                  onChange={change}
                  onSelect={setSelected}
                />
              ) : (
                <p className="text-sm text-ink-muted">{t('designer.nothingSelected')}</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
