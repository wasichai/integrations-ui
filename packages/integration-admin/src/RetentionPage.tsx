import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@wasichai/core'
import { Alert, Card, CardBody, CardHeader, CardTitle, Table, Td, Th } from '@wasichai/ui'
import { OPERATIONS_GUIDE, RETENTION_SETTINGS, RETENTION_TASKS } from './retention'

const PREFIX = 'wasichai.integrations.retention'

// read only: retention is server configuration and no endpoint answers it. the documented defaults, said as such
export function RetentionPage() {
  const { t } = useTranslation('integration-admin')

  return (
    <>
      <PageHeader title={t('retention.title')} subtitle={t('retention.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <Alert tone="notice">{t('retention.readOnly')}</Alert>
        <Card>
          <CardHeader>
            <CardTitle>{t('retention.tasks')}</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>{t('retention.taskName')}</Th>
                <Th>{t('retention.default')}</Th>
                <Th>{t('retention.deleted')}</Th>
                <Th>{t('retention.kept')}</Th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_TASKS.map(({ task, key, days, module }) => (
                <tr key={task}>
                  <Td className="align-top">
                    <span className="font-mono text-sm">{task}</span>
                    <span className="block text-xs text-ink-muted">{t(`retention.module.${module}`)}</span>
                  </Td>
                  <Td className="align-top">{t('retention.days', { count: days })}</Td>
                  <Td className="align-top text-sm">{t(`retention.task.${key}.deleted`)}</Td>
                  <Td className="align-top text-sm text-ink-muted">{t(`retention.task.${key}.kept`)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <CardBody>
            <p className="text-xs text-ink-muted">{t('retention.override', { property: `${PREFIX}.max-age.<task>` })}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('retention.purge')}</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr>
                <Th>{t('retention.property')}</Th>
                <Th>{t('retention.default')}</Th>
                <Th>{t('retention.meaning')}</Th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_SETTINGS.map(({ property, value }) => (
                <tr key={property}>
                  <Td className="font-mono text-xs">
                    {PREFIX}.{property}
                  </Td>
                  <Td className="font-mono text-sm">{value}</Td>
                  <Td className="text-sm">{t(`retention.setting.${property}`)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardBody className="space-y-2 text-sm">
            <p>{t('retention.beforeAge')}</p>
            <p>
              <a href={`${OPERATIONS_GUIDE}#retention`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
                {t('retention.guide')}
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{t('retention.newTab')}</span>
              </a>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
