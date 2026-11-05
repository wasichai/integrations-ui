import { useQuery } from '@tanstack/react-query'
import { Plug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, PageHeader, QueryState, useWasichaiLinks } from '@wasichai/core'
import { Card, CardBody, Table, Td, Th } from '@wasichai/ui'
import { connectorsQuery } from './api'
import { MaturityBadge, ToneBadge } from './badges'
import { CAPABILITIES } from './constants'
import type { Connector } from './types'

// what this backend has installed: each connector's manifest version, the sdk it was built on and how far each
// capability got. read by any member; the catalog of @wasichai/integrations is where a tenant connects one
export function ConnectorsPage() {
  const { t } = useTranslation('integration-admin')
  const query = useQuery(connectorsQuery())

  return (
    <>
      <PageHeader title={t('connectors.title')} subtitle={t('connectors.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <QueryState query={query}>
          {(connectors) =>
            connectors.length === 0 ? (
              <Card>
                <EmptyState icon={Plug} title={t('connectors.empty')} description={t('connectors.emptyHint')} />
              </Card>
            ) : (
              <Installed connectors={[...connectors].sort((a, b) => a.provider.localeCompare(b.provider))} />
            )
          }
        </QueryState>
      </div>
    </>
  )
}

function Installed({ connectors }: { connectors: Connector[] }) {
  const { t } = useTranslation('integration-admin')
  const links = useWasichaiLinks()
  // the connector page is @wasichai/integrations': linked only when that module is registered
  const linked = links.has('integrations:connector')
  const sdks = [...new Set(connectors.map((connector) => connector.sdkVersion))].sort()

  return (
    <>
      <p className="text-sm text-ink-muted">
        {t('connectors.summary', { count: connectors.length })} · {t('connectors.sdks', { versions: sdks.join(', '), count: sdks.length })}
      </p>
      <Card>
        <CardBody>
          <p className="text-sm text-ink-muted">{t('connectors.maturityLegend')}</p>
        </CardBody>
        <Table>
          <thead>
            <tr>
              <Th>{t('connectors.connector')}</Th>
              <Th>{t('connectors.version')}</Th>
              <Th>{t('connectors.sdkVersion')}</Th>
              <Th>{t('connectors.auth')}</Th>
              <Th>{t('connectors.capabilities')}</Th>
            </tr>
          </thead>
          <tbody>
            {connectors.map((connector) => (
              <tr key={connector.id}>
                <Td className="max-w-xs align-top">
                  {linked ? (
                    <Link to={links.to('integrations:connector', { connectorId: connector.id })} className="font-medium hover:underline">
                      {connector.provider}
                    </Link>
                  ) : (
                    <span className="font-medium">{connector.provider}</span>
                  )}
                  <span className="block font-mono text-xs text-ink-muted">{connector.id}</span>
                  <span className="block text-xs text-ink-muted">{connector.description}</span>
                </Td>
                <Td className="align-top font-mono text-sm">{connector.version}</Td>
                <Td className="align-top font-mono text-sm">{connector.sdkVersion}</Td>
                <Td className="align-top">
                  <ul className="space-y-1 text-sm">
                    {connector.authMethods.map((method) => (
                      <li key={method.type}>
                        {t(`authType.${method.type}`)}
                        {method.pkce ? <span className="text-ink-muted"> · PKCE</span> : null}
                      </li>
                    ))}
                  </ul>
                  {connector.needsProviderConfig ? (
                    <ToneBadge tone={connector.providerConfigured ? 'success' : 'warning'}>
                      {t(connector.providerConfigured ? 'connectors.appConfigured' : 'connectors.appMissing')}
                    </ToneBadge>
                  ) : null}
                </Td>
                <Td className="align-top">
                  <ul className="flex flex-wrap gap-1" aria-label={t('connectors.capabilitiesOf', { provider: connector.provider })}>
                    {CAPABILITIES.filter((capability) => connector.capabilities[capability]).map((capability) => (
                      <li key={capability}>
                        <MaturityBadge maturity={connector.capabilities[capability]!} label={t(`capability.${capability}`)} />
                      </li>
                    ))}
                  </ul>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
