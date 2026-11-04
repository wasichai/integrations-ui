# integrations-ui — the React packages of Wasichai Integrations

The frontend of the integration platform, built as Wasichai module libraries. The backend, the docs and every ADR
(frontend ones included) are in the sibling repository `integrations` ([wasichai/integrations](https://github.com/wasichai/integrations)):
read its `docs/` before changing behaviour, `docs/architecture/api.md` above all. The platform packages
(`@wasichai/core`, `@wasichai/ui`, `@wasichai/testing`) come from [wasichai/wasichai-ui](https://github.com/wasichai/wasichai-ui),
installed from GitHub Packages, never copied or aliased here.

## Non-negotiable stack

- React 19.3 (yarn 1 workspaces) + Vite 8 + Tailwind CSS 4 classes over the wasichai tokens + i18next (es default, en) +
  react-router + react-query; lucide-react icons
- Only `@wasichai/ui` primitives and `@wasichai/core` components (PageHeader, QueryState, EmptyState, ErrorState…): no
  design system of our own
- Node 26; vitest + testing-library + `@wasichai/testing` (renderWithProviders, mockFetch)
- Published as `@wasichai/*` to `npm.pkg.github.com`

## Architectural rules

1. **Wasichai-ui's rules apply** (its `CLAUDE.md`): a module registers itself (`WasichaiModule`: routes, nav, i18n),
   links come from `useWasichaiLinks()`, never a hardcoded in-app url.
2. **A module package stays installable on its own**: it imports `@wasichai/core`, `@wasichai/ui` and its own
   libraries, never another module package (each package's `boundaries.test.ts`). A read that belongs to another
   module is a `queryOptions` factory copying that module's exact path and query key.
3. **Platform packages are peers**: `@wasichai/core` and `@wasichai/ui` are `peerDependencies: "*"` and
   `devDependencies: "^1.7.0"` of every package; the app installs them once.
4. **The REST API of wasichai/integrations is the contract**: responses are cast (`api<T>()`), not parsed. A change that
   needs a new endpoint lands there first.
5. **Admin-only actions are hidden** unless the caller is `admin` or holds `MANAGE_ORGANIZATION`; the server still
   decides.
6. **No overengineering**: an abstraction needs a concrete second user.

## Working rules

- **`.editorconfig` is law** (TS/JS/YAML/MD 2 spaces, JSON 4, max 160 columns, LF, final newline). Format before
  finishing: `yarn format`. Markdown is hand-formatted to the same rules.
- **Conventional Commits** for every commit and PR title (`feat(integrations): …`, `fix(integration-sync): …`),
  enforced by commitlint; body lines ≤ 100 characters.
- Code, identifiers and comments in **English**. Comments **caveman style**: short, say why.
- Decisions are ADRs in wasichai/integrations' `docs/adr/`; change history in its `docs/HISTORY.md`.

## Commands

```bash
yarn install && yarn lint && yarn test && yarn build   # NODE_AUTH_TOKEN with read:packages
yarn test:tooling                                     # tooling/*.test.mjs
node tooling/check-release.mjs --pack                 # what a release would publish
```

## Definition of Done

Works · has tests · handles errors (loading, empty, error, degraded) · accessible (labels, buttons, keyboard) ·
documented · modules stay independent · lint, tests and build pass · formatted with `.editorconfig`.
