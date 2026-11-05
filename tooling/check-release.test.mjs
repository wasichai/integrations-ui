// fixture repo on disk: two public packages and a private one. each test breaks one thing and expects
// exactly that problem back.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { checkReleaseConfig, checkReleasePlease, checkVersion, entryPoints, EXPECTED_PUBLIC, packDryRun } from './check-release.mjs'

const EXPECTED = ['@wasichai/a', '@wasichai/b']

function write(root, path, contents) {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, JSON.stringify(contents, null, 4))
}

const lib = (name, extra = {}) => ({
  name,
  version: '0.1.0',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './package.json': './package.json' },
  files: ['dist'],
  publishConfig: { registry: 'https://npm.pkg.github.com' },
  peerDependencies: { '@wasichai/core': '*', '@wasichai/ui': '*', react: '^19.3.0' },
  ...extra
})

const bump = (dir) => ({ type: 'json', path: `packages/${dir}/package.json`, jsonpath: '$.version' })

const releasePlease = () => ({
  config: { packages: { '.': { 'release-type': 'node', 'extra-files': [bump('a'), bump('b')] } } },
  manifest: { '.': '0.1.0' }
})

function withFixture(change, check, changeRelease = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-release-'))
  try {
    const packages = { a: lib('@wasichai/a'), b: lib('@wasichai/b'), smoke: { name: '@wasichai/smoke', version: '0.1.0', private: true } }
    change(packages)
    for (const [dir, manifest] of Object.entries(packages)) write(root, `packages/${dir}/package.json`, manifest)
    const release = releasePlease()
    changeRelease(release)
    if (release.config) write(root, 'release-please-config.json', release.config)
    if (release.manifest) write(root, '.release-please-manifest.json', release.manifest)
    check(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('a consistent repo has no problems', () => {
  withFixture(
    () => {},
    (root) => assert.deepEqual(checkReleaseConfig(root, EXPECTED), [])
  )
})

test('a private package that loses its flag would leak', () => {
  withFixture(
    (packages) => delete packages.smoke.private,
    (root) => assert.deepEqual(checkReleaseConfig(root, EXPECTED), ['@wasichai/smoke would be published but is not in the expected public set'])
  )
})

test('core as a dependency would install a second copy', () => {
  withFixture(
    (packages) => (packages.a.dependencies = { '@wasichai/core': '^1.7.0' }),
    (root) => assert.deepEqual(checkReleaseConfig(root, EXPECTED), ['@wasichai/a depends on @wasichai/core: make it a peerDependency'])
  )
})

test('a package missing from the public set is reported', () => {
  withFixture(
    (packages) => (packages.b.private = true),
    (root) => assert.deepEqual(checkReleaseConfig(root, EXPECTED), ['@wasichai/b is expected to be published but is missing or private'])
  )
})

test('entry points cover main, types and every exports target', () => {
  assert.deepEqual(entryPoints(lib('@wasichai/a')), ['dist/index.js', 'dist/index.d.ts', 'package.json'])
})

test('a tarball without its entry points or with sources is refused', () => {
  withFixture(
    () => {},
    (root) => {
      const pack = (dir) => (dir.endsWith('a') ? ['package.json', 'dist/index.js', 'src/index.ts'] : ['package.json', 'dist/index.js', 'dist/index.d.ts'])
      assert.deepEqual(packDryRun(root, { pack }), ['@wasichai/a tarball lacks dist/index.d.ts', '@wasichai/a tarball ships src/'])
    }
  )
})

test('release-please bumps every public package on the version it is at', () => {
  withFixture(
    () => {},
    (root) => assert.deepEqual(checkReleasePlease(root), [])
  )
})

test('a public package release-please does not bump is reported', () => {
  withFixture(
    () => {},
    (root) => assert.deepEqual(checkReleasePlease(root), ['@wasichai/b is not bumped by release-please: add packages/b/package.json to extra-files']),
    (release) => (release.config.packages['.']['extra-files'] = [bump('a')])
  )
})

test('a package off the release-please version is reported', () => {
  withFixture(
    (packages) => (packages.a.version = '0.2.0'),
    (root) => assert.deepEqual(checkReleasePlease(root), ['@wasichai/a has version 0.2.0, release-please is at 0.1.0'])
  )
})

test('no release-please manifest is reported', () => {
  withFixture(
    () => {},
    (root) => assert.deepEqual(checkReleasePlease(root), ['release-please-config.json or .release-please-manifest.json is missing or not JSON']),
    (release) => (release.manifest = null)
  )
})

test('every public package must carry the version being released', () => {
  withFixture(
    (packages) => (packages.smoke.version = '9.9.9'),
    (root) => {
      assert.deepEqual(checkVersion(root, '0.1.0'), [])
      assert.deepEqual(checkVersion(root, '0.2.0'), [
        '@wasichai/a has version 0.1.0, the release is 0.2.0',
        '@wasichai/b has version 0.1.0, the release is 0.2.0'
      ])
      assert.deepEqual(checkVersion(root, 'v0.2.0'), ["a release version is X.Y.Z, got 'v0.2.0'"])
    }
  )
})

// this repository itself: every package in packages/ is expected, bumped by release-please and on its version
test('the repository publishes exactly its module packages, all on one version line', () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  assert.deepEqual(EXPECTED_PUBLIC, ['@wasichai/integrations', '@wasichai/integration-sync', '@wasichai/integration-workflows'])
  assert.deepEqual(checkReleaseConfig(repoRoot), [])
  assert.deepEqual(checkReleasePlease(repoRoot), [])
})
