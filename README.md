# integrations-ui

The React packages of [Wasichai Integrations](https://github.com/wasichai/integrations): Wasichai modules that let an
app connect to external systems (catalog, connections, webhooks, health), keep records in sync between them, run
workflows across them and expose them to AI agents as tools (also over MCP). They plug into an app built with
[wasichai-ui](https://github.com/wasichai/wasichai-ui) and are published as `@wasichai/*` to GitHub Packages. The
backend, every ADR and the API contract live in [wasichai/integrations](https://github.com/wasichai/integrations).

```tsx
import { WasichaiApp } from '@wasichai/core'
import { integrationsModule } from '@wasichai/integrations'
import { integrationSyncModule } from '@wasichai/integration-sync'
import { integrationWorkflowsModule } from '@wasichai/integration-workflows'
import { integrationAiModule } from '@wasichai/integration-ai'

<WasichaiApp
  config={{ apiBaseUrl: '/api' }}
  modules={[integrationsModule(), integrationSyncModule(), integrationWorkflowsModule(), integrationAiModule()]}
/>
```

| Package | What |
|---|---|
| `@wasichai/integrations` | connector catalog, provider apps, connections (OAuth and API key), resources, webhooks, events, health |
| `@wasichai/integration-sync` | sync definitions (wizard, field mapping), runs and conflicts; needs `@wasichai/integrations` registered |
| `@wasichai/integration-workflows` | workflow designer, versions, runs and approvals, webhook url; needs `@wasichai/integrations` registered |
| `@wasichai/integration-ai` | AI tools (roles, approval, limit), approvals, execution history, MCP endpoint; needs `@wasichai/integrations` registered |

Install (`.npmrc`: `@wasichai:registry=https://npm.pkg.github.com` plus a token with `read:packages`):
`yarn add @wasichai/integrations @wasichai/core @wasichai/ui`.

OAuth sends the browser back to the backend's `wasichai.integrations.oauth.return-url`: point it at the app's
connections page (`/integrations/connections` with the default base path), which reads `status`, `error` and
`connectionId` from the query string.

## Layout

```
packages/   @wasichai/integrations, @wasichai/integration-sync, @wasichai/integration-workflows, @wasichai/integration-ai
tooling/    run-ordered (build in dependency order), check-release (what a release publishes), publish-packages
docs/       pointers to the backend docs, releasing
```

## Commands

```bash
yarn install && yarn lint && yarn test && yarn build
yarn test:tooling
```

Development: [docs/README.md](docs/README.md).
