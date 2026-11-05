# Releasing

This repository releases the npm packages of Wasichai Integrations, `@wasichai/integrations`,
`@wasichai/integration-sync` and `@wasichai/integration-workflows`, on one version line of their own, to
`https://npm.pkg.github.com`. The Maven modules are released from
[wasichai/integrations](https://github.com/wasichai/integrations/blob/main/docs/development/releasing.md) the same way,
on theirs.

## Flow

1. Merge Conventional Commits (`feat(integration-sync): …`, `fix(integrations): …`) to `main`.
2. `release-please.yml` opens or updates a release PR that bumps the root `package.json` and, through `extra-files`,
   the `version` of every public package, and writes `CHANGELOG.md`.
3. Merging that PR tags `vX.Y.Z` and creates a GitHub Release.
4. The release triggers `publish.yml`: the `guards` job builds and runs
   `node tooling/check-release.mjs --pack --version X.Y.Z`; only then the `npm` job builds again and runs
   `node tooling/publish-packages.mjs X.Y.Z`, which publishes each public package and skips a version already up, so
   re-running a failed upload finishes it.

One version, not one per package: the packages ship together, none depends on another, and one tag keeps the
release notes and the backend's `api.md` in step. That is why the root package `"."` with `extra-files` is used rather
than release-please's `node-workspace` plugin.

## Guards

`tooling/check-release.mjs` fails when:

- a public package is not in `EXPECTED_PUBLIC`, or an expected one is missing or private;
- a package does not publish to `npm.pkg.github.com`, depends on a platform package, or does not peer on
  `@wasichai/core` and `@wasichai/ui` as `"*"`;
- release-please does not bump a public package (`extra-files` of `release-please-config.json`), or a package's
  version is not the manifest's;
- with `--version`, a package's version is not the release's;
- with `--pack`, a tarball lacks an entry point or ships `src/`.

CI runs it with `--pack` on every push and pull request (job "Release dry run (npm)").

## Secrets

| Secret | Needed for |
|---|---|
| `PACKAGES_TOKEN` (organization) | installing `@wasichai/core`, `ui` and `testing` in CI and in `publish.yml` |
| `RELEASE_PLEASE_TOKEN` | a release that triggers `publish.yml` (a release made with `GITHUB_TOKEN` triggers no workflow) |

Publishing itself uses the workflow's `GITHUB_TOKEN` (`packages: write`). After the first publish, give the apps that
consume these packages read access (package settings → Manage Actions access).

## A new package

Add it to `EXPECTED_PUBLIC` in `tooling/check-release.mjs` and its `package.json` to `extra-files` in
`release-please-config.json`, at the current version of `.release-please-manifest.json`.

## Locally

```bash
yarn build && node tooling/check-release.mjs --pack   # what a release would publish
yarn test:tooling                                     # the guards' own tests
```
