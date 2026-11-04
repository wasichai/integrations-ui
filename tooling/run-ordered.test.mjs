// fixture workspaces on disk: the order must follow dependencies + peerDependencies, never
// devDependencies, and a real cycle must stop the build instead of looping.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { buildOrder, expandWorkspaces, readWorkspaces } from './run-ordered.mjs'

function writePackage(root, dir, manifest) {
  mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest))
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'run-ordered-'))
  writePackage(root, 'packages/testing', { name: '@wasichai/testing', peerDependencies: { '@wasichai/core': '*' } })
  writePackage(root, 'packages/core', { name: '@wasichai/core', dependencies: { '@wasichai/ui': '*', react: '19.3.0' } })
  writePackage(root, 'packages/ui', { name: '@wasichai/ui', devDependencies: { '@wasichai/testing': '*' } })
  writePackage(root, 'apps/demo', { name: 'demo-app', dependencies: { '@wasichai/core': '*' } })
  // a folder without package.json is not a workspace
  mkdirSync(join(root, 'apps/empty'), { recursive: true })
  return root
}

test('expands the workspace globs and skips folders without package.json', () => {
  const root = fixture()
  try {
    const dirs = expandWorkspaces(root, ['packages/*', 'apps/*']).map((dir) => dir.slice(root.length + 1))
    assert.deepEqual(dirs.sort(), ['apps/demo', 'packages/core', 'packages/testing', 'packages/ui'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('orders dependencies first and ignores devDependencies', () => {
  const root = fixture()
  try {
    const order = buildOrder(readWorkspaces(root, ['packages/*', 'apps/*'])).map((pkg) => pkg.name)
    assert.ok(order.indexOf('@wasichai/ui') < order.indexOf('@wasichai/core'))
    assert.ok(order.indexOf('@wasichai/core') < order.indexOf('@wasichai/testing'))
    assert.ok(order.indexOf('@wasichai/core') < order.indexOf('demo-app'))
    assert.equal(order.length, 4)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('refuses a dependency cycle', () => {
  const packages = [
    { name: 'a', dir: 'a', manifest: { name: 'a', dependencies: { b: '1' } } },
    { name: 'b', dir: 'b', manifest: { name: 'b', peerDependencies: { a: '1' } } }
  ]
  assert.throws(() => buildOrder(packages), /workspace cycle: a -> b -> a/)
})
