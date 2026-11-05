import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageHeader, useWasichaiConfig, useWasichaiLinks } from '@wasichai/core'
import { Alert, Card, CardBody, CardHeader, CardTitle, CopyButton } from '@wasichai/ui'
import { useCanManageTools } from './permissions'

// the revision the backend speaks (ADR-0027 of wasichai/integrations)
export const MCP_PROTOCOL_VERSION = '2025-06-18'

// the app's api base may be relative ('/api'): an MCP client needs the absolute url
export function apiUrl(apiBaseUrl: string, path: string, origin: string = window.location.origin): string {
  return new URL(`${apiBaseUrl.replace(/\/+$/, '')}${path}`, origin).href
}

// the config an MCP client takes, as docs/guides/ai-tools.md shows it
export function clientConfig(url: string): string {
  return JSON.stringify({ mcpServers: { wasichai: { type: 'http', url, headers: { Authorization: 'Bearer ${WASICHAI_TOKEN}' } } } }, null, 2)
}

// how an agent reaches the tools: nothing to change here, the endpoint is the backend's
export function McpPage() {
  const { t } = useTranslation('integration-ai')
  const config = useWasichaiConfig()
  const links = useWasichaiLinks()
  const canManage = useCanManageTools()
  const endpoint = apiUrl(config.apiBaseUrl, '/integrations/mcp')
  const tokenUrl = apiUrl(config.apiBaseUrl, '/auth/token')
  const example = clientConfig(endpoint)

  return (
    <>
      <PageHeader title={t('mcp.title')} subtitle={t('mcp.subtitle')} />
      <div className="space-y-5 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('mcp.endpoint')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-1">
              <code className="min-w-0 flex-1 break-all rounded bg-surface-muted px-2 py-1 text-xs" aria-label={t('mcp.endpoint')}>
                {endpoint}
              </code>
              <CopyButton value={endpoint} label={t('mcp.copyEndpoint')} copiedLabel={t('mcp.copied')} />
            </div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              <dt className="text-ink-muted">{t('mcp.protocol')}</dt>
              <dd>
                <code className="text-xs">{MCP_PROTOCOL_VERSION}</code>
              </dd>
              <dt className="text-ink-muted">{t('mcp.transport')}</dt>
              <dd>{t('mcp.transportValue')}</dd>
              <dt className="text-ink-muted">{t('mcp.methods')}</dt>
              <dd>
                <code className="text-xs">initialize, ping, tools/list, tools/call</code>
              </dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('mcp.auth')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p>{t('mcp.authText')}</p>
            <p>
              {t('mcp.tokenText')} <code className="break-all text-xs">POST {tokenUrl}</code>
            </p>
            <p className="text-ink-muted">{t('mcp.sameRights')}</p>
            {canManage ? (
              <Link to={links.serviceAccounts()} className="inline-block text-sm font-medium hover:underline">
                {t('mcp.serviceAccounts')}
              </Link>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>{t('mcp.example')}</CardTitle>
            <CopyButton value={example} label={t('mcp.copyExample')} copiedLabel={t('mcp.copied')} />
          </CardHeader>
          <CardBody className="space-y-3">
            <pre className="overflow-auto rounded bg-surface-muted p-2 text-xs" aria-label={t('mcp.example')}>
              {example}
            </pre>
            <p className="text-xs text-ink-muted">{t('mcp.exampleHint')}</p>
          </CardBody>
        </Card>
        <Alert tone="notice">{t('mcp.origin')}</Alert>
        <Alert tone="notice">{t('mcp.approvals')}</Alert>
      </div>
    </>
  )
}
