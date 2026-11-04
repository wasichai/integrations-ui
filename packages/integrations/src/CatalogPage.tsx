import { useQuery } from '@tanstack/react-query'
import { Plug, SearchX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState, PageHeader, QueryState, useWasichaiLinks } from '@wasichai/core'
import { Card, CardBody, CardHeader, CardTitle, Input, Label } from '@wasichai/ui'
import { connectorsQuery } from './api'
import { MaturityBadge, ToneBadge } from './badges'
import type { Capability, Connector, Maturity } from './types'

// provider, id, description and capability names: what someone types when looking for one
function matches(connector: Connector, needle: string): boolean {
  if (!needle) return true
  const haystack = [connector.provider, connector.id, connector.description, ...Object.keys(connector.capabilities)].join(' ').toLowerCase()
  return needle
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

export function CatalogPage() {
  const { t } = useTranslation(['integrations', 'common'])
  const query = useQuery(connectorsQuery())
  const [search, setSearch] = useState('')

  return (
    <>
      <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="connector-search">{t('catalog.search')}</Label>
          <Input
            id="connector-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
            autoComplete="off"
          />
        </div>
        <QueryState query={query}>
          {(connectors) => {
            if (connectors.length === 0) return <EmptyState icon={Plug} title={t('catalog.empty')} description={t('catalog.emptyHint')} headingLevel={2} />
            const shown = connectors.filter((connector) => matches(connector, search.trim()))
            if (shown.length === 0) return <EmptyState icon={SearchX} title={t('catalog.noMatches', { search: search.trim() })} headingLevel={2} />
            return (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('catalog.title')}>
                {shown.map((connector) => (
                  <li key={connector.id} className="flex">
                    <ConnectorCard connector={connector} />
                  </li>
                ))}
              </ul>
            )
          }}
        </QueryState>
      </div>
    </>
  )
}

function ConnectorCard({ connector }: { connector: Connector }) {
  const { t } = useTranslation('integrations')
  const links = useWasichaiLinks()
  const capabilities = Object.entries(connector.capabilities) as [Capability, Maturity][]

  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>
            <Link to={links.to('integrations:connector', { connectorId: connector.id })} className="hover:underline">
              {connector.provider}
            </Link>
          </CardTitle>
          <p className="text-xs text-ink-muted">
            {connector.id} · v{connector.version}
          </p>
        </div>
        <ConfigBadge connector={connector} />
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-ink">{connector.description}</p>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('catalog.capabilities')}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {capabilities.map(([capability, maturity]) => (
              <li key={capability}>
                <MaturityBadge maturity={maturity} label={t(`capability.${capability}`)} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('catalog.authMethods')}</h3>
          <p className="text-sm text-ink">{connector.authMethods.map((method) => t(`authType.${method.type}`)).join(', ')}</p>
        </div>
      </CardBody>
    </Card>
  )
}

// only an oauth connector needs the tenant's app registered first
export function ConfigBadge({ connector }: { connector: Connector }) {
  const { t } = useTranslation('integrations')
  if (!connector.needsProviderConfig) return null
  return connector.providerConfigured ? (
    <ToneBadge tone="success">{t('catalog.configured')}</ToneBadge>
  ) : (
    <ToneBadge tone="warning">{t('catalog.needsConfig')}</ToneBadge>
  )
}
