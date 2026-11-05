import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { PageHeader, QueryState, useWasichaiLinks } from '@wasichai/core'
import { Card, CardBody, CardHeader, CardTitle, Table, Td, Th } from '@wasichai/ui'
import { versionQuery } from './api'
import { Time } from './badges'
import { edgesOf, stepsOf, TRIGGER_NODE } from './graph'
import type { WorkflowVersion } from './types'

// a published version never changes: read only, without the designer (and its canvas library)
export function VersionPage() {
  const { workflowId, number } = useParams()
  const query = useQuery(versionQuery(workflowId, number))
  return <QueryState query={query}>{(version) => <VersionView version={version} />}</QueryState>
}

function VersionView({ version }: { version: WorkflowVersion }) {
  const { t } = useTranslation('integration-workflows')
  const links = useWasichaiLinks()
  const edges = edgesOf(version.graph)
  const trigger = version.graph.trigger
  const goesTo = (source: string) =>
    edges
      .filter((edge) => edge.source === source)
      .map((edge) => `${t(`edge.${edge.field}`)} → ${edge.target}`)
      .join(', ') || '—'

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integration-workflows:workflow', { workflowId: version.workflowId })} className="text-sm text-ink-muted hover:text-ink">
            {t('execution.back')}
          </Link>
        }
        title={t('versions.number', { number: version.number })}
        subtitle={
          <>
            {t('versions.publishedAt')} <Time value={version.publishedAt} />
          </>
        }
      />
      <div className="space-y-5 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('versions.outline')}</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>{t('designer.stepId')}</Th>
                <Th>{t('designer.type')}</Th>
                <Th>{t('versions.edges')}</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className="font-medium">{t('designer.trigger')}</Td>
                <Td>{trigger?.type ? t(`triggerType.${trigger.type}`) : '—'}</Td>
                <Td className="text-ink-muted">{goesTo(TRIGGER_NODE)}</Td>
              </tr>
              {stepsOf(version.graph).map((step) => (
                <tr key={step.id}>
                  <Td className="font-medium">{step.id}</Td>
                  <Td>{t(`stepType.${step.type}`)}</Td>
                  <Td className="text-ink-muted">{goesTo(step.id)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('versions.json')}</CardTitle>
          </CardHeader>
          <CardBody>
            <pre className="max-h-[32rem] overflow-auto rounded bg-surface-muted p-2 text-xs" aria-label={t('versions.json')}>
              {JSON.stringify(version.graph, null, 2)}
            </pre>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
