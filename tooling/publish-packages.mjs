#!/usr/bin/env node
// publishes every public package at the release version. publish.yml runs it after the guard.
// a version already on the registry is skipped: re-running a failed upload finishes it instead of hitting E409.
// usage: node tooling/publish-packages.mjs <version>
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { publicPackages } from './check-release.mjs'

// npm(args, { cwd }) -> { status, stdout, stderr }: the CLI spawns npm, the tests fake it
export function publishPackages({ packagesRoot, version, npm, log = console.log }) {
  // folder order: stable logs
  const packages = publicPackages(packagesRoot).sort((a, b) => a.dir.localeCompare(b.dir))
  // the skip check asks for `version`, npm publishes package.json's: they must match before anything uploads
  for (const { pkg } of packages) {
    if (pkg.version !== version) throw new Error(`publish-packages: ${pkg.name} has version ${pkg.version}, expected ${version}`)
  }

  const published = []
  const skipped = []
  for (const { dir, pkg } of packages) {
    const there = npm(['view', `${pkg.name}@${version}`, 'version'], { cwd: dir })
    if (there.status === 0 && there.stdout.trim() === version) {
      log(`${pkg.name}@${version} already published, skipped`)
      skipped.push(pkg.name)
      continue
    }
    const publish = npm(['publish'], { cwd: dir })
    if (publish.status !== 0) throw new Error(`publish-packages: npm publish ${pkg.name}@${version} failed: ${publish.stderr.trim()}`)
    log(`${pkg.name}@${version} published`)
    published.push(pkg.name)
  }
  return { published, skipped }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version] = process.argv.slice(2)
  const packagesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packages')
  const npm = (args, { cwd }) => {
    const run = spawnSync('npm', args, { cwd, encoding: 'utf8' })
    return { status: run.status ?? 1, stdout: run.stdout ?? '', stderr: run.stderr || String(run.error ?? '') }
  }
  try {
    if (!version) throw new Error('publish-packages: usage: publish-packages.mjs <version>')
    const { published, skipped } = publishPackages({ packagesRoot, version, npm })
    console.log(`publish-packages: ${published.length} published, ${skipped.length} already there`)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}
