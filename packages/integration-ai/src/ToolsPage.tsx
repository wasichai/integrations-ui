import { useQuery } from '@tanstack/react-query'
import { Bot, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, PageHeader, QueryState, describeError, useWasichaiLinks } from '@wasichai/core'
import { Alert, Button, Card, CardBody, ConfirmDialog, Table, Td, Th } from '@wasichai/ui'
import { connectionOptionsQuery, toolsQuery, useDeleteTool } from './api'
import { ToolBadges, ToolTarget } from './badges'
import { ALL, Pick } from './fields'
import { useCanManageTools } from './permissions'
import type { Tool } from './types'

export function ToolsPage() {
  const { t } = useTranslation(['integration-ai', 'common'])
  const links = useWasichaiLinks()
  const query = useQuery(toolsQuery())
  const connections = useQuery(connectionOptionsQuery())
  const canManage = useCanManageTools()
  const [connectionId, setConnectionId] = useState(ALL)
  const [deleting, setDeleting] = useState<Tool | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const remove = useDeleteTool()

  // the list still shows when connections cannot be read: the id stands in for the name
  const connectionName = (id: string) => connections.data?.find((connection) => connection.id === id)?.name ?? id

  const create = canManage ? (
    <Button asChild>
      <Link to={links.to('integration-ai:newTool')}>
        <Plus className="size-4" />
        {t('tools.new')}
      </Link>
    </Button>
  ) : null

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      await remove.mutateAsync(deleting.name)
      setDeleting(null)
    } catch (cause) {
      setDeleteError(describeError(cause))
    }
  }

  return (
    <>
      <PageHeader title={t('tools.title')} subtitle={t('tools.subtitle')} actions={create} />
      <div className="space-y-5 p-4 md:p-8">
        {connections.isError ? <Alert tone="warning">{t('tools.connectionsUnavailable')}</Alert> : null}
        <QueryState query={query}>
          {(tools) => {
            if (tools.length === 0) {
              return (
                <EmptyState icon={Bot} title={t(canManage ? 'tools.empty' : 'tools.emptyMember')} description={t('tools.emptyHint')} headingLevel={2}>
                  {create}
                </EmptyState>
              )
            }
            // connections the tools use, even one the connections list did not answer
            const used = [...new Set(tools.map((tool) => tool.connectionId))]
            const shown = connectionId === ALL ? tools : tools.filter((tool) => tool.connectionId === connectionId)
            return (
              <Card>
                <CardBody className="max-w-xs">
                  <Pick
                    id="tools-connection"
                    label={t('tools.connection')}
                    value={connectionId}
                    onChange={setConnectionId}
                    options={[{ value: ALL, label: t('tools.allConnections') }, ...used.map((id) => ({ value: id, label: connectionName(id) }))]}
                  />
                </CardBody>
                {shown.length === 0 ? (
                  <EmptyState icon={Bot} title={t('tools.emptyFiltered')} />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t('tools.name')}</Th>
                        <Th>{t('tools.connection')}</Th>
                        <Th>{t('tools.does')}</Th>
                        <Th>{t('tools.roles')}</Th>
                        <Th>{t('tools.status')}</Th>
                        {canManage ? <Th className="w-px">{t('common.actions')}</Th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((tool) => (
                        <tr key={tool.id}>
                          <Td>
                            <Link to={links.to('integration-ai:tool', { toolName: tool.name })} className="font-mono text-sm font-medium hover:underline">
                              {tool.name}
                            </Link>
                          </Td>
                          <Td className="text-ink-muted">{connectionName(tool.connectionId)}</Td>
                          <Td className="text-ink-muted">
                            <ToolTarget tool={tool} />
                          </Td>
                          <Td className="text-xs text-ink-muted">{tool.allowedRoles.length ? tool.allowedRoles.join(', ') : t('tool.managersOnly')}</Td>
                          <Td>
                            <ToolBadges tool={tool} />
                          </Td>
                          {canManage ? (
                            <Td>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteError(null)
                                  setDeleting(tool)
                                }}
                                aria-label={t('tool.deleteNamed', { name: tool.name })}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </Td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            )
          }}
        </QueryState>
      </div>
      {deleting ? (
        <ConfirmDialog
          title={t('tool.delete')}
          description={t('tool.deleteConfirm', { name: deleting.name })}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}
