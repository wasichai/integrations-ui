# Frontend development

The React side of [Wasichai Integrations](https://github.com/wasichai/integrations). Architecture, API and decisions
are documented there; this page covers working in this repository.

## Read first (in wasichai/integrations)

- [Architecture overview](https://github.com/wasichai/integrations/blob/main/docs/architecture/overview.md) ·
  [REST API](https://github.com/wasichai/integrations/blob/main/docs/architecture/api.md) ·
  [Security model](https://github.com/wasichai/integrations/blob/main/docs/architecture/security-model.md) ·
  [Sync semantics](https://github.com/wasichai/integrations/blob/main/docs/architecture/sync-semantics.md)
- ADRs: [OAuth flows](https://github.com/wasichai/integrations/blob/main/docs/adr/0006-oauth-flows.md),
  [Event envelope and webhooks](https://github.com/wasichai/integrations/blob/main/docs/adr/0007-event-envelope-and-webhooks.md),
  [Sync semantics and conflicts](https://github.com/wasichai/integrations/blob/main/docs/adr/0009-sync-semantics-and-conflicts.md),
  [Multi-tenancy and permissions](https://github.com/wasichai/integrations/blob/main/docs/adr/0011-multi-tenancy-and-permissions.md),
  [all ADRs](https://github.com/wasichai/integrations/blob/main/docs/adr/README.md)
- The platform: [wasichai-ui](https://github.com/wasichai/wasichai-ui) (module registry, primitives, test helpers)

## Requirements and layout

Node 26, Yarn 1. `packages/*` are the yarn workspaces. `@wasichai/core`, `@wasichai/ui` and `@wasichai/testing` are
installed from GitHub Packages: export `NODE_AUTH_TOKEN` (a token with `read:packages`) before `yarn install`.
`tooling/` holds `run-ordered.mjs` (builds packages in dependency order), `check-release.mjs` and
`publish-packages.mjs` (see [Releasing](releasing.md)).

## Commands

```bash
yarn install
yarn format:check && yarn lint   # prettier + tsc per workspace
yarn test                        # vitest in every package
yarn test:tooling                # node --test tooling/*.test.mjs
yarn build                       # every package, in dependency order
```

## A new module package

Copy `packages/integrations` (package.json, vite.config.ts, tsconfig*.json, src/test/setup.ts, boundaries, i18n and
module tests), rename it, add it to `EXPECTED_PUBLIC` in `tooling/check-release.mjs` and its `package.json` to the
`extra-files` of `release-please-config.json`.
