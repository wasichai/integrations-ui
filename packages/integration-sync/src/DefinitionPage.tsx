import { useQuery } from '@tanstack/react-query'
import { History, Pencil, Play, Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, ConfirmDialog, Table, Td, Th } from '@wasichai/ui'
import { definitionQuery, runsQuery, statusQuery, useDeleteDefinition, useRunDefinition, useSetDefinitionActive } from './api'
import { DefinitionStatusBadge, RunStatusBadge, Time } from './badges'
import { SideLabel } from './DefinitionsPage'
import { useCanManageSync } from './permissions'
import { SyncStatusCard } from './SyncStatusCard'
import type { RunKind, SyncDefinition } from './types'

export function DefinitionPage() {
  const { definitionId } = useParams()
  const query = useQuery(definitionQuery(definitionId))
  return <QueryState query={query}>{(definition) => <DefinitionDetail definition={definition} />}</QueryState>
}

function DefinitionDetail({ definition }: { definition: SyncDefinition }) {
  const { t } = useTranslation(['integration-sync', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const canManage = useCanManageSync()
  const setActive = useSetDefinitionActive()
  const run = useRunDefinition()
  const remove = useDeleteDefinition()
  // same query as the status card: one request
  const status = useQuery(statusQuery(definition.id))
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const active = definition.status === 'ACTIVE'

  const act = async (action: () => Promise<unknown>, done: string) => {
    setNotice(null)
    try {
      await action()
      setNotice({ tone: 'success', text: done })
    } catch (cause) {
      setNotice({ tone: 'danger', text: describeError(cause) })
    }
  }

  const runNow = (kind: RunKind) => void act(() => run.mutateAsync({ definitionId: definition.id, kind }), t('definition.runQueued'))

  const confirmDelete = async () => {
    setDeleteError(null)
    try {
      await remove.mutateAsync(definition.id)
      navigate(links.to('integration-sync:definitions'), { replace: true })
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  const open = status.data?.pendingConflicts ?? 0

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-sync:definitions')} className="text-sm text-ink-muted hover:text-ink">
            {t('definitions.title')}
          </Link>
        }
        title={definition.name}
        subtitle={t(`direction.${definition.direction}`)}
        actions={
          canManage ? (
            <>
              <Button asChild variant="secondary">
                <Link to={links.to('integration-sync:editDefinition', { definitionId: definition.id })}>
                  <Pencil className="size-4" />
                  {t('common.edit')}
                </Link>
              </Button>
              {active ? (
                <>
                  <Button onClick={() => runNow('INCREMENTAL')} disabled={run.isPending}>
                    <Play className="size-4" />
                    {t('definition.runNow')}
                  </Button>
                  <Button variant="secondary" onClick={() => runNow('RECONCILE')} disabled={run.isPending}>
                    <History className="size-4" />
                    {t('definition.reconcile')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void act(() => setActive.mutateAsync({ definitionId: definition.id, active: false }), t('definition.deactivated'))}
                    disabled={setActive.isPending}
                  >
                    <PowerOff className="size-4" />
                    {t('definition.deactivate')}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => void act(() => setActive.mutateAsync({ definitionId: definition.id, active: true }), t('definition.activated'))}
                  disabled={setActive.isPending}
                >
                  <Power className="size-4" />
                  {t('definition.activate')}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} aria-label={t('definition.delete')}>
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <DefinitionStatusBadge status={definition.status} />
          {open > 0 ? (
            <Link to={links.to('integration-sync:conflicts', undefined, { definitionId: definition.id })} className="text-warning underline">
              {t('definition.openConflicts', { count: open })}
            </Link>
          ) : null}
        </div>
      </PageHeader>
      <div className="space-y-5 p-4 md:p-8">
        {notice ? (
          <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Alert>
        ) : null}
        <SyncStatusCard definitionId={definition.id} />
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('definition.sides')}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('definitions.sideA')}</dt>
                  <dd className="text-sm">
                    <SideLabel side={definition.a} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('definitions.sideB')}</dt>
                  <dd className="text-sm">
                    <SideLabel side={definition.b} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('wizard.deletePolicy')}</dt>
                  <dd className="text-sm text-ink">{t(`deletePolicy.${definition.deletePolicy}`)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('wizard.schedule')}</dt>
                  <dd className="text-sm text-ink">
                    {definition.scheduleSeconds ? t('definition.every', { seconds: definition.scheduleSeconds }) : t('definition.manual')}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('wizard.mappings')}</CardTitle>
            </CardHeader>
            <Table>
              <thead>
                <tr>
                  <Th>{t('wizard.fieldA')}</Th>
                  <Th>{t('wizard.fieldB')}</Th>
                  <Th>{t('wizard.owner')}</Th>
                  <Th>{t('wizard.transform')}</Th>
                </tr>
              </thead>
              <tbody>
                {definition.mappings.map((mapping) => (
                  <tr key={`${mapping.aField}->${mapping.bField}`}>
                    <Td>{mapping.aField}</Td>
                    <Td>{mapping.bField}</Td>
                    <Td>{t(`owner.${mapping.owner}`)}</Td>
                    <Td className="text-ink-muted">{t(`transform.types.${mapping.transform?.type ?? 'copy'}`)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
        <Runs definitionId={definition.id} />
      </div>
      {deleting ? (
        <ConfirmDialog
          title={t('definition.delete')}
          description={t('definition.deleteConfirm', { name: definition.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(false)}
        />
      ) : null}
    </>
  )
}

function Runs({ definitionId }: { definitionId: string }) {
  const { t } = useTranslation('integration-sync')
  const query = useQuery(runsQuery(definitionId))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('runs.title')}</CardTitle>
      </CardHeader>
      <QueryState query={query}>
        {(runs) =>
          runs.length === 0 ? (
            <EmptyState icon={History} title={t('runs.empty')} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t('runs.status')}</Th>
                  <Th>{t('runs.trigger')}</Th>
                  <Th>{t('runs.queued')}</Th>
                  <Th>{t('runs.finished')}</Th>
                  <Th>{t('runs.counts')}</Th>
                  <Th>{t('runs.error')}</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <Td>
                      <RunStatusBadge status={run.status} />
                    </Td>
                    <Td className="text-ink-muted">{t(`trigger.${run.trigger}`)}</Td>
                    <Td>
                      <Time value={run.queuedAt} />
                    </Td>
                    <Td>
                      <Time value={run.finishedAt} />
                    </Td>
                    <Td className="text-xs text-ink-muted">
                      {t('runs.countsValue', {
                        read: run.read,
                        created: run.created,
                        updated: run.updated,
                        skipped: run.skipped,
                        conflicts: run.conflicts,
                        failed: run.failed
                      })}
                    </Td>
                    <Td className="max-w-sm text-xs text-danger">{run.error ?? ''}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </QueryState>
    </Card>
  )
}
