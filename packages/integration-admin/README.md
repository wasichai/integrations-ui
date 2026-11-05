# @wasichai/integration-admin

Backend and docs: [wasichai/integrations](https://github.com/wasichai/integrations) (`wasichai-integrations`; contract
in `docs/architecture/api.md` › Catalog, Jobs and health, Webhooks and events, Usage; guide in
`docs/guides/operations.md`, ADR-0029).

Operating the integration platform: the connectors installed on the server with their manifest version, SDK version,
auth methods and the maturity of each capability (declared, implemented, tested); the tenant's usage per day and metric
over a date range (the last 30 UTC days by default), with totals and a bar per day; system health (connections by
status, jobs by status, rate-limit pauses, failing connections), the jobs list filtered by status and kind with retry of
dead jobs, and the failed events of every connection with replay; and the retention defaults, read only.

## Install

```
# .npmrc
@wasichai:registry=https://npm.pkg.github.com
```

```bash
yarn add @wasichai/core @wasichai/ui @wasichai/integrations @wasichai/integration-admin
```

Peers: `@wasichai/core`, `@wasichai/ui`, `react`, `react-dom`, `@tanstack/react-query`, `i18next`, `react-i18next`, `react-router`.
Dependency: `lucide-react`.

## Usage

Register `@wasichai/integrations` too: it declares the `integrations` nav group this module fills; its connector and
connection pages are linked when registered.

```tsx
import { WasichaiApp } from '@wasichai/core'
import { integrationsModule } from '@wasichai/integrations'
import { integrationAdminModule } from '@wasichai/integration-admin'

export function App() {
  return <WasichaiApp config={{ apiBaseUrl: '/api' }} modules={[integrationsModule(), integrationAdminModule()]} />
}
```

## What it adds

| Slot | Value |
|---|---|
| routes | `integration-admin:connectors` → `/integrations/admin/connectors`, `usage` → `…/admin/usage` (`?from=&to=&metric=`), `system` → `…/admin/system`, `retention` → `…/admin/retention`; all lazy |
| nav | group `integrations` (declared by `@wasichai/integrations`): Versiones de conectores (90), Uso (92), Estado del sistema (94), Retención (96) |
| i18n | namespace `integration-admin` (es, en) |

It reads `/integrations/connectors`, `/integrations/connections` and `/integrations/health` under the same query keys as
`@wasichai/integrations`, without importing it; `/integrations/usage`, `/integrations/jobs` and
`/integrations/events?status=FAILED` under its own. A retry or replay refreshes `@wasichai/integrations`' jobs, health
and events too.

Every page reads what any member may. The jobs list and its retry (`GET /jobs`, `POST /jobs/{id}/retry`) and event
replay are shown only to `admin` or `MANAGE_ORGANIZATION`; the server still decides.

## Pages

- **Connector versions**: every installed connector, its `version` and `sdkVersion`, the SDK versions in use, auth
  methods (PKCE noted), whether the tenant registered its OAuth app, and each capability with its maturity.
- **Usage**: `GET /usage?from&to&metric`. The range and metric live in the url; a range the server would refuse (`from`
  after `to`, more than 366 days, not a date) is said under the inputs and not sent. Every day of the range shows, a day
  without counters as zero. Days are UTC; counters reach the server every 30 s, so today lags a little.
- **System health**: `GET /health` (connections and jobs by status, failing connections), the rate-limit pauses it
  reports (`rateLimitedUntil` still in the future), `GET /jobs` (dead first; status and kind filters; 50, 200 or 500 rows,
  the endpoint has no cursor) with retry of a dead job, and `GET /events?status=FAILED` (cursor paged) with replay. Each
  part loads and fails on its own.
- **Retention**: the purge tasks, their default ages, what each deletes and never deletes, and the purge's settings, as
  the operations guide documents them. Retention is server configuration with no read endpoint: the page says these are
  defaults a server may have changed.

## Not shown (no endpoint yet)

- The retention a server actually runs with (`wasichai.integrations.retention.*`), and when the purge last ran.
- Rate-limit pauses of connections that are not failing, and token buckets: `/health` reports `rateLimitedUntil` only
  for failing connections, from the replica that answered.
- Scheduler state (job worker, sync and workflow schedulers, retention and usage flush ticks).

## Options

| Option | Default | Meaning |
|---|---|---|
| `basePath` | `'integrations'` | url prefix of every route |
