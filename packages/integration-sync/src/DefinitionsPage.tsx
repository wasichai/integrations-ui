import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, PageHeader, QueryState, useWasichaiLinks } from '@wasichai/core'
import { Button, Card, Table, Td, Th } from '@wasichai/ui'
import { connectionOptionsQuery, definitionsQuery } from './api'
import { DefinitionStatusBadge, Time } from './badges'
import { useCanManageSync } from './permissions'
import type { SideRef } from './types'

// "Connection name · resource". the connection list is the integrations module's, read under its key
export function SideLabel({ side }: { side: SideRef }) {
  const { data: connections = [] } = useQuery(connectionOptionsQuery())
  const connection = connections.find((candidate) => candidate.id === side.connectionId)
  return (
    <span>
      <span className="text-ink">{connection?.name ?? side.connectionId ?? '—'}</span>
      <span className="block text-xs text-ink-muted">{side.resource ?? '—'}</span>
    </span>
  )
}

export function DefinitionsPage() {
  const { t } = useTranslation(['integration-sync', 'common'])
  const links = useWasichaiLinks()
  const query = useQuery(definitionsQuery())
  const canManage = useCanManageSync()

  const create = canManage ? (
    <Button asChild>
      <Link to={links.to('integration-sync:newDefinition')}>
        <Plus className="size-4" />
        {t('definitions.new')}
      </Link>
    </Button>
  ) : null

  return (
    <>
      <PageHeader title={t('definitions.title')} subtitle={t('definitions.subtitle')} actions={create} />
      <div className="p-4 md:p-8">
        <QueryState query={query}>
          {(definitions) =>
            definitions.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title={t('definitions.empty')} description={t('definitions.emptyHint')} headingLevel={2}>
                {create}
              </EmptyState>
            ) : (
              <Card>
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('definitions.name')}</Th>
                      <Th>{t('definitions.sideA')}</Th>
                      <Th>{t('definitions.direction')}</Th>
                      <Th>{t('definitions.sideB')}</Th>
                      <Th>{t('definitions.status')}</Th>
                      <Th>{t('definitions.updated')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {definitions.map((definition) => (
                      <tr key={definition.id}>
                        <Td>
                          <Link to={links.to('integration-sync:definition', { definitionId: definition.id })} className="font-medium hover:underline">
                            {definition.name}
                          </Link>
                        </Td>
                        <Td>
                          <SideLabel side={definition.a} />
                        </Td>
                        <Td className="text-ink-muted">{t(`direction.${definition.direction}`)}</Td>
                        <Td>
                          <SideLabel side={definition.b} />
                        </Td>
                        <Td>
                          <DefinitionStatusBadge status={definition.status} />
                        </Td>
                        <Td>
                          <Time value={definition.updatedAt} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )
          }
        </QueryState>
      </div>
    </>
  )
}
