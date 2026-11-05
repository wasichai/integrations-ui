import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { EmptyState, PageHeader, QueryState, describeError, formError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Label, Table, Td, Th } from '@wasichai/ui'
import { useCreateWorkflow, useDeleteWorkflow, workflowsQuery } from './api'
import { Time, WorkflowBadges } from './badges'
import { useCanManageWorkflows } from './permissions'
import type { Workflow, WorkflowGraph } from './types'

// a new workflow starts runnable by hand and already connected: manual trigger -> end
export const STARTER_GRAPH: WorkflowGraph = { trigger: { type: 'manual', next: 'done' }, steps: [{ id: 'done', type: 'end' }] }

export function WorkflowsPage() {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const links = useWasichaiLinks()
  const query = useQuery(workflowsQuery())
  const canManage = useCanManageWorkflows()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Workflow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const remove = useDeleteWorkflow()

  const create = canManage ? (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" />
      {t('workflows.new')}
    </Button>
  ) : null

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await remove.mutateAsync(deleting.id)
      setDeleting(null)
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader title={t('workflows.title')} subtitle={t('workflows.subtitle')} actions={create} />
      <div className="p-4 md:p-8">
        <QueryState query={query}>
          {(workflows) =>
            workflows.length === 0 ? (
              <EmptyState icon={WorkflowIcon} title={t('workflows.empty')} description={t('workflows.emptyHint')} headingLevel={2}>
                {create}
              </EmptyState>
            ) : (
              <Card>
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('workflows.name')}</Th>
                      <Th>{t('workflows.status')}</Th>
                      <Th>{t('workflows.trigger')}</Th>
                      <Th>{t('workflows.updated')}</Th>
                      {canManage ? <Th className="w-px">{t('common.actions')}</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((workflow) => (
                      <tr key={workflow.id}>
                        <Td>
                          <Link to={links.to('integration-workflows:workflow', { workflowId: workflow.id })} className="font-medium hover:underline">
                            {workflow.name}
                          </Link>
                        </Td>
                        <Td>
                          <WorkflowBadges workflow={workflow} />
                        </Td>
                        <Td className="text-ink-muted">{workflow.graph.trigger?.type ? t(`triggerType.${workflow.graph.trigger.type}`) : '—'}</Td>
                        <Td>
                          <Time value={workflow.updatedAt} />
                        </Td>
                        {canManage ? (
                          <Td>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteError(null)
                                setDeleting(workflow)
                              }}
                              aria-label={t('workflow.deleteNamed', { name: workflow.name })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )
          }
        </QueryState>
      </div>
      {creating ? <CreateDialog onClose={() => setCreating(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title={t('workflow.delete')}
          description={t('workflow.deleteConfirm', { name: deleting.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}

// a name is all a draft needs; the designer opens next
function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(['integration-workflows', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const create = useCreateWorkflow()
  const [name, setName] = useState('')
  const [error, setError] = useState<{ message: string; field?: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError({ message: '', field: t('workflows.nameRequired') })
      return
    }
    try {
      const created = await create.mutateAsync({ name: name.trim(), graph: STARTER_GRAPH })
      navigate(links.to('integration-workflows:designer', { workflowId: created.id }))
    } catch (cause) {
      const problem = formError(cause)
      setError({ message: problem.message, field: problem.violations.find((violation) => violation.field === 'name')?.message })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-semibold">{t('workflows.new')}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">{t('workflows.newHint')}</DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="workflow-name">{t('workflows.name')}</Label>
            <Input
              id="workflow-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              aria-invalid={error?.field ? true : undefined}
              aria-describedby={error?.field ? 'workflow-name-error' : undefined}
            />
            {error?.field ? (
              <p id="workflow-name-error" className="text-xs text-danger">
                {error.field}
              </p>
            ) : null}
          </div>
          {error && !error.field ? <Alert tone="danger">{error.message}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t('common.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
