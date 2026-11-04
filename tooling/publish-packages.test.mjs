// fixture packages on disk and a fake npm: what would be published, skipped or refused
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { publishPackages } from './publish-packages.mjs'

function withPackages(packages, check) {
  const root = mkdtempSync(join(tmpdir(), 'publish-packages-'))
  try {
    for (const [dir, manifest] of Object.entries(packages)) {
      mkdirSync(join(root, dir), { recursive: true })
      writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest))
    }
    check(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// already: names whose version the registry has. failing: folders whose publish is refused
function fakeNpm(already = [], failing = []) {
  const calls = []
  const npm = (args, { cwd }) => {
    calls.push(args.join(' '))
    if (args[0] === 'view') {
      const name = args[1].replace(/@[^@]+$/, '')
      return already.includes(name) ? { status: 0, stdout: '0.2.0\n', stderr: '' } : { status: 1, stdout: '', stderr: 'npm error code E404' }
    }
    return failing.some((dir) => cwd.endsWith(dir)) ? { status: 1, stdout: '', stderr: 'npm error code E403' } : { status: 0, stdout: '', stderr: '' }
  }
  return { npm, calls }
}

const packages = {
  a: { name: '@wasichai/a', version: '0.2.0' },
  b: { name: '@wasichai/b', version: '0.2.0' },
  smoke: { name: '@wasichai/smoke', version: '0.0.0', private: true }
}

test('publishes every public package, skipping what is already up', () => {
  withPackages(packages, (root) => {
    const { npm, calls } = fakeNpm(['@wasichai/a'])
    const result = publishPackages({ packagesRoot: root, version: '0.2.0', npm, log: () => {} })
    assert.deepEqual(result, { published: ['@wasichai/b'], skipped: ['@wasichai/a'] })
    assert.deepEqual(calls, ['view @wasichai/a@0.2.0 version', 'view @wasichai/b@0.2.0 version', 'publish'])
  })
})

test('refuses before any upload when a package is not at the release version', () => {
  withPackages({ ...packages, b: { name: '@wasichai/b', version: '0.1.0' } }, (root) => {
    const { npm, calls } = fakeNpm()
    assert.throws(() => publishPackages({ packagesRoot: root, version: '0.2.0', npm, log: () => {} }), /@wasichai\/b has version 0\.1\.0, expected 0\.2\.0/)
    assert.deepEqual(calls, [])
  })
})

test('a failed upload stops with npm saying why', () => {
  withPackages(packages, (root) => {
    const { npm } = fakeNpm([], ['a'])
    assert.throws(
      () => publishPackages({ packagesRoot: root, version: '0.2.0', npm, log: () => {} }),
      /npm publish @wasichai\/a@0\.2\.0 failed: npm error code E403/
    )
  })
})
