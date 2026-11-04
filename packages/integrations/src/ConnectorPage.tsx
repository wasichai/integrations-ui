import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Plug } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, PageHeader, QueryState, formError, useWasichaiLinks, type FieldViolation } from '@wasichai/core'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  Table,
  Tabs,
  Td,
  Th
} from '@wasichai/ui'
import { connectorQuery, providerConfigQuery, useCreateConnection, useSaveProviderConfig, useStartOAuth } from './api'
import { MaturityBadge, ToneBadge } from './badges'
import { ConfigBadge } from './CatalogPage'
import { useCanManageIntegrations } from './permissions'
import { redirectTo } from './redirect'
import type { AuthType, Capability, Connector, ProviderConfig } from './types'

const CAPABILITIES: Capability[] = ['AUTHENTICATION', 'DISCOVERY', 'READ', 'CHANGE_FEED', 'WRITE', 'UPSERT', 'WEBHOOKS', 'ACTIONS']
const CHECKBOX = 'h-4 w-4 accent-brand'

// scopes are typed as one line: spaces or commas between them
const splitScopes = (text: string) => text.split(/[\s,]+/).filter(Boolean)

export function ConnectorPage() {
  const { connectorId } = useParams()
  const query = useQuery(connectorQuery(connectorId))
  return <QueryState query={query}>{(connector) => <ConnectorDetail connector={connector} />}</QueryState>
}

function ConnectorDetail({ connector }: { connector: Connector }) {
  const { t } = useTranslation(['integrations', 'common'])
  const links = useWasichaiLinks()
  const canManage = useCanManageIntegrations()
  const [connecting, setConnecting] = useState(false)

  const tabs = [
    { id: 'overview', label: t('connector.overview'), render: () => <Overview connector={connector} /> },
    { id: 'capabilities', label: t('connector.capabilities'), render: () => <Capabilities connector={connector} /> }
  ]
  if (connector.needsProviderConfig && canManage) {
    tabs.push({ id: 'provider-app', label: t('connector.providerApp'), render: () => <ProviderAppTab connector={connector} /> })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to={links.to('integrations:catalog')} className="text-sm text-ink-muted hover:text-ink">
            {t('catalog.title')}
          </Link>
        }
        title={connector.provider}
        subtitle={connector.description}
        actions={
          <>
            <ConfigBadge connector={connector} />
            {canManage ? (
              <Button onClick={() => setConnecting(true)}>
                <Plug className="size-4" />
                {t('connect.button')}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="py-4">
        <Tabs tabs={tabs} label={t('connector.tabs')} />
      </div>
      {connecting ? <ConnectDialog connector={connector} onClose={() => setConnecting(false)} /> : null}
    </>
  )
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{term}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  )
}

function Overview({ connector }: { connector: Connector }) {
  const { t } = useTranslation('integrations')
  const none = <span className="text-ink-muted">—</span>
  return (
    <div className="grid gap-5 p-4 md:p-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('connector.about')}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact term={t('connector.id')}>{connector.id}</Fact>
            <Fact term={t('connector.version')}>
              {connector.version} (SDK {connector.sdkVersion})
            </Fact>
            <Fact term={t('connector.homepage')}>{connector.homepage ? <External href={connector.homepage} /> : none}</Fact>
            <Fact term={t('connector.documentation')}>{connector.documentation ? <External href={connector.documentation} /> : none}</Fact>
            <Fact term={t('connector.syncDirections')}>
              {connector.syncDirections.length ? connector.syncDirections.map((direction) => t(`syncDirection.${direction}`)).join(', ') : none}
            </Fact>
            <Fact term={t('connector.rateLimit')}>
              {connector.rateLimit
                ? t('connector.rateLimitValue', {
                    rps: connector.rateLimit.requestsPerSecond,
                    burst: connector.rateLimit.burst,
                    scope: connector.rateLimit.scope
                  })
                : none}
            </Fact>
            <Fact term={t('connector.webhooks')}>
              {connector.webhooks ? `${connector.webhooks.signatureScheme}: ${connector.webhooks.events.join(', ') || '—'}` : none}
            </Fact>
            <Fact term={t('connector.requiredPermissions')}>{connector.requiredPermissions.join(', ') || none}</Fact>
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('catalog.authMethods')}</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2">
            {connector.authMethods.map((method) => (
              <li key={method.type} className="text-sm text-ink">
                <span className="font-medium">{t(`authType.${method.type}`)}</span>
                {method.pkce ? <span className="ml-2 text-xs text-ink-muted">PKCE</span> : null}
                {method.defaultScopes?.length ? (
                  <span className="block text-xs text-ink-muted">
                    {t('connector.defaultScopes')}: {method.defaultScopes.join(' ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('connector.resources')}</CardTitle>
        </CardHeader>
        <CardBody>
          {connector.resources.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('connector.noResources')}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {connector.resources.map((resource) => (
                <li key={resource.name}>
                  <ToneBadge tone="muted" title={resource.name}>
                    {resource.label}
                    {resource.dynamic ? ` · ${t('connector.dynamic')}` : ''}
                  </ToneBadge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('connector.actions')}</CardTitle>
        </CardHeader>
        <CardBody>
          {connector.actions.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('connector.noActions')}</p>
          ) : (
            <ul className="space-y-1">
              {connector.actions.map((action) => (
                <li key={action.name} className="text-sm text-ink">
                  {action.label} <span className="text-xs text-ink-muted">({action.name})</span>
                  {action.sensitive ? (
                    <span className="ml-2">
                      <ToneBadge tone="warning">{t('connector.sensitive')}</ToneBadge>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function External({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
      {href.replace(/^https?:\/\//, '')}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  )
}

function Capabilities({ connector }: { connector: Connector }) {
  const { t } = useTranslation('integrations')
  return (
    <div className="space-y-3 p-4 md:p-8">
      <p className="text-sm text-ink-muted">{t('connector.maturityLegend')}</p>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>{t('connector.capability')}</Th>
              <Th>{t('connector.maturity')}</Th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => {
              const maturity = connector.capabilities[capability]
              return (
                <tr key={capability}>
                  <Td>{t(`capability.${capability}`)}</Td>
                  <Td>{maturity ? <MaturityBadge maturity={maturity} /> : <span className="text-ink-muted">{t('connector.unsupported')}</span>}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

// the violations the server named per field; the rest goes to the banner
function useViolations() {
  const [message, setMessage] = useState<string | null>(null)
  const [violations, setViolations] = useState<FieldViolation[]>([])
  return {
    message,
    fieldError: (field: string) => violations.find((violation) => violation.field === field)?.message,
    reset: () => {
      setMessage(null)
      setViolations([])
    },
    show: (cause: unknown, known: string[]) => {
      const { message: text, violations: list } = formError(cause)
      const unknown = list.filter((violation) => !known.includes(violation.field))
      setMessage([text, ...unknown.map((violation) => `${violation.field}: ${violation.message}`)].join(' — '))
      setViolations(list)
    }
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  ) : null
}

// one dialog for every method. oauth leaves the app for the provider's consent page; the others are
// checked against the provider by the server before they are stored
function ConnectDialog({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const { t } = useTranslation(['integrations', 'common'])
  const links = useWasichaiLinks()
  const navigate = useNavigate()
  const methods = [...new Set(connector.authMethods.map((method) => method.type))]
  const [method, setMethod] = useState<AuthType>(methods[0])
  const [name, setName] = useState(connector.provider)
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [scopes, setScopes] = useState('')
  const errors = useViolations()
  const start = useStartOAuth()
  const create = useCreateConnection()
  const busy = start.isPending || create.isPending || start.isSuccess
  const oauth = method === 'OAUTH2_AUTHORIZATION_CODE'
  const blocked = (oauth || method === 'OAUTH2_CLIENT_CREDENTIALS') && connector.needsProviderConfig && !connector.providerConfigured

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    errors.reset()
    try {
      if (oauth) {
        const answer = await start.mutateAsync({ connectorId: connector.id, name: name.trim() })
        redirectTo(answer.authorizationUrl)
        return
      }
      const created = await create.mutateAsync({
        connectorId: connector.id,
        name: name.trim(),
        authType: method,
        ...(method === 'API_KEY' ? { apiKey } : {}),
        ...(method === 'BASIC' ? { username, password } : {}),
        ...(method === 'OAUTH2_CLIENT_CREDENTIALS' && scopes.trim() ? { scopes: splitScopes(scopes) } : {})
      })
      onClose()
      navigate(links.to('integrations:connection', { connectionId: created.id }))
    } catch (cause) {
      errors.show(cause, ['name', 'apiKey', 'username', 'password'])
    }
  }

  const field = (id: string, label: string, value: string, onChange: (value: string) => void, type = 'text', apiField = id) => {
    const problem = errors.fieldError(apiField)
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`connect-${id}`}>{label}</Label>
        <Input
          id={`connect-${id}`}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={type === 'password' ? 'new-password' : 'off'}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `connect-${id}-error` : undefined}
          required={id !== 'scopes'}
        />
        <FieldError id={`connect-${id}-error`} message={problem} />
      </div>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-lg font-semibold">{t('connect.title', { provider: connector.provider })}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-ink-muted">{t('connect.description')}</DialogDescription>
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          {field('name', t('connect.name'), name, setName)}
          {methods.length > 1 ? (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-ink">{t('connect.method')}</legend>
              {methods.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" name="connect-method" className={CHECKBOX} checked={method === type} onChange={() => setMethod(type)} />
                  {t(`authType.${type}`)}
                </label>
              ))}
            </fieldset>
          ) : null}
          {method === 'API_KEY' ? field('apiKey', t('connect.apiKey'), apiKey, setApiKey, 'password') : null}
          {method === 'BASIC' ? (
            <>
              {field('username', t('connect.username'), username, setUsername)}
              {field('password', t('connect.password'), password, setPassword, 'password')}
            </>
          ) : null}
          {method === 'OAUTH2_CLIENT_CREDENTIALS' ? field('scopes', t('connect.scopes'), scopes, setScopes) : null}
          {oauth && !blocked ? <p className="text-sm text-ink-muted">{t('connect.oauthHint', { provider: connector.provider })}</p> : null}
          {blocked ? <Alert tone="warning">{t('connect.needsConfig')}</Alert> : null}
          {errors.message ? <Alert tone="danger">{errors.message}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || blocked}>
              {oauth ? t('connect.continue', { provider: connector.provider }) : t('connect.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProviderAppTab({ connector }: { connector: Connector }) {
  const { t } = useTranslation('integrations')
  const query = useQuery(providerConfigQuery(connector.id))
  const [saved, setSaved] = useState(false)
  const defaultScopes = connector.authMethods.flatMap((method) => method.defaultScopes ?? [])

  return (
    <div className="max-w-2xl space-y-4 p-4 md:p-8">
      <p className="text-sm text-ink-muted">{t('providerApp.intro')}</p>
      {saved ? (
        <Alert tone="success" onDismiss={() => setSaved(false)}>
          {t('providerApp.saved')}
        </Alert>
      ) : null}
      <QueryState query={query}>
        {(config) => (
          // remounts on every stored version, so the form always starts from what is stored
          <ProviderConfigForm
            key={config?.version ?? 'new'}
            connectorId={connector.id}
            config={config}
            defaultScopes={defaultScopes}
            onSaved={() => setSaved(true)}
            onEdit={() => setSaved(false)}
            onReload={() => void query.refetch()}
          />
        )}
      </QueryState>
    </div>
  )
}

function ProviderConfigForm({
  connectorId,
  config,
  defaultScopes,
  onSaved,
  onEdit,
  onReload
}: {
  connectorId: string
  config: ProviderConfig | null
  defaultScopes: string[]
  onSaved: () => void
  onEdit: () => void
  onReload: () => void
}) {
  const { t } = useTranslation(['integrations', 'common'])
  const save = useSaveProviderConfig()
  const [clientId, setClientId] = useState(config?.clientId ?? '')
  // write-only: never filled from the server, empty keeps the stored one
  const [secret, setSecret] = useState('')
  const [clearSecret, setClearSecret] = useState(false)
  const [scopes, setScopes] = useState((config?.scopes ?? []).join(' '))
  const [stale, setStale] = useState(false)
  const errors = useViolations()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    errors.reset()
    setStale(false)
    try {
      await save.mutateAsync({
        connectorId,
        version: config?.version ?? null,
        request: {
          clientId: clientId.trim(),
          ...(secret !== '' ? { clientSecret: secret } : clearSecret ? { clientSecret: '' } : {}),
          scopes: splitScopes(scopes),
          options: config?.options ?? {}
        }
      })
      onSaved()
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 412) setStale(true)
      else errors.show(cause, ['clientId', 'clientSecret'])
    }
  }

  const clientIdError = errors.fieldError('clientId')
  const secretError = errors.fieldError('clientSecret')

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('providerApp.title')}</CardTitle>
        {config ? (
          config.clientSecretSet ? (
            <ToneBadge tone="success">{t('providerApp.secretSet')}</ToneBadge>
          ) : (
            <ToneBadge tone="warning">{t('providerApp.secretMissing')}</ToneBadge>
          )
        ) : (
          <ToneBadge tone="muted">{t('providerApp.notRegistered')}</ToneBadge>
        )}
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} onChange={onEdit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="provider-client-id">{t('providerApp.clientId')}</Label>
            <Input
              id="provider-client-id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              autoComplete="off"
              required
              aria-invalid={clientIdError ? true : undefined}
              aria-describedby={clientIdError ? 'provider-client-id-error' : undefined}
            />
            <FieldError id="provider-client-id-error" message={clientIdError} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-client-secret">{t('providerApp.clientSecret')}</Label>
            <Input
              id="provider-client-secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="new-password"
              placeholder={config?.clientSecretSet ? t('providerApp.secretKeep') : ''}
              disabled={clearSecret}
              aria-invalid={secretError ? true : undefined}
              aria-describedby="provider-client-secret-hint"
            />
            <p id="provider-client-secret-hint" className="text-xs text-ink-muted">
              {secretError ?? t('providerApp.secretHint')}
            </p>
            {config?.clientSecretSet ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className={CHECKBOX} checked={clearSecret} onChange={(event) => setClearSecret(event.target.checked)} />
                {t('providerApp.clearSecret')}
              </label>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-scopes">{t('providerApp.scopes')}</Label>
            <Input
              id="provider-scopes"
              value={scopes}
              onChange={(event) => setScopes(event.target.value)}
              autoComplete="off"
              aria-describedby="provider-scopes-hint"
            />
            <p id="provider-scopes-hint" className="text-xs text-ink-muted">
              {defaultScopes.length ? t('providerApp.scopesHintDefaults', { scopes: defaultScopes.join(' ') }) : t('providerApp.scopesHint')}
            </p>
          </div>
          {stale ? (
            <Alert tone="warning">
              {t('providerApp.stale')}{' '}
              <Button type="button" variant="secondary" size="sm" onClick={onReload}>
                {t('providerApp.reload')}
              </Button>
            </Alert>
          ) : null}
          {errors.message ? <Alert tone="danger">{errors.message}</Alert> : null}
          <Button type="submit" disabled={save.isPending || clientId.trim() === ''}>
            {t('common.save')}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
