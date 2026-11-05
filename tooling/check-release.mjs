#!/usr/bin/env node
// guards a release before anything is uploaded: which npm packages would be published, that release-please
// bumps each of them, and what their tarballs would hold. ci.yml runs it with --pack on every push and pull
// request; publish.yml adds --version <tag version> before the upload.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// the public set, by name. a new package fails the check until someone adds it here on purpose.
// each package adds itself here when it lands
export const EXPECTED_PUBLIC = ['@wasichai/integrations', '@wasichai/integration-sync', '@wasichai/integration-workflows']

// installed from GitHub Packages, never built here: a package may only peer on them, at any version the app picked
const PLATFORM = ['@wasichai/core', '@wasichai/ui', '@wasichai/testing']

function readPackage(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return null // a folder without package.json is not a package
  }
}

export function publicPackages(packagesRoot) {
  // a workspace with no package yet publishes nothing
  if (!existsSync(packagesRoot)) return []
  return readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesRoot, entry.name))
    .map((dir) => ({ dir, pkg: readPackage(dir) }))
    .filter(({ pkg }) => pkg && pkg.private !== true)
}

// the files a consumer's import resolves to: main, types and every exports target
export function entryPoints(pkg) {
  const targets = [pkg.main, pkg.types]
  const walk = (value) => {
    if (typeof value === 'string') targets.push(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(pkg.exports)
  return [...new Set(targets.filter(Boolean).map((t) => t.replace(/^\.\//, '')))]
}

export function checkReleaseConfig(repoRoot, expected = EXPECTED_PUBLIC) {
  const problems = []
  const published = publicPackages(join(repoRoot, 'packages'))
  const names = published.map(({ pkg }) => pkg.name)

  for (const name of names) if (!expected.includes(name)) problems.push(`${name} would be published but is not in the expected public set`)
  for (const name of expected) if (!names.includes(name)) problems.push(`${name} is expected to be published but is missing or private`)

  // an unexpected package is already reported once above
  for (const { pkg } of published.filter(({ pkg }) => expected.includes(pkg.name))) {
    if (pkg.publishConfig?.registry !== 'https://npm.pkg.github.com') problems.push(`${pkg.name} does not publish to npm.pkg.github.com`)
    // a platform package in dependencies would install a second core or ui next to the app's
    for (const name of PLATFORM) {
      if (pkg.dependencies?.[name]) problems.push(`${pkg.name} depends on ${name}: make it a peerDependency`)
    }
    for (const name of ['@wasichai/core', '@wasichai/ui']) {
      if (pkg.peerDependencies?.[name] !== '*') problems.push(`${pkg.name} peerDependencies ${name} must be "*"`)
    }
  }
  return problems
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

// one version line: release-please bumps the root and, through extra-files, every public package.
// a package it does not bump would publish its old version again (E409) or drift from the tag
export function checkReleasePlease(repoRoot) {
  const config = readJson(join(repoRoot, 'release-please-config.json'))
  const manifest = readJson(join(repoRoot, '.release-please-manifest.json'))
  if (!config || !manifest) return ['release-please-config.json or .release-please-manifest.json is missing or not JSON']
  const root = config.packages?.['.']
  const version = manifest['.']
  if (!root || !version) return ['release-please releases the root package "." on one version line: configure it there']

  const problems = []
  const bumped = (root['extra-files'] ?? []).filter((file) => file?.type === 'json' && file.jsonpath === '$.version').map((file) => file.path)
  for (const { dir, pkg } of publicPackages(join(repoRoot, 'packages'))) {
    const path = `packages/${basename(dir)}/package.json`
    if (!bumped.includes(path)) problems.push(`${pkg.name} is not bumped by release-please: add ${path} to extra-files`)
    if (pkg.version !== version) problems.push(`${pkg.name} has version ${pkg.version}, release-please is at ${version}`)
  }
  return problems
}

// what publish.yml uploads is package.json's version: it must be the tag's
export function checkVersion(repoRoot, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) return [`a release version is X.Y.Z, got '${version}'`]
  return publicPackages(join(repoRoot, 'packages'))
    .filter(({ pkg }) => pkg.version !== version)
    .map(({ pkg }) => `${pkg.name} has version ${pkg.version}, the release is ${version}`)
}

export function npmPack(dir) {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: dir, encoding: 'utf8' })
  return JSON.parse(out)[0].files.map((file) => file.path)
}

// what a publish would upload: every entry point there, no sources
export function packDryRun(repoRoot, { pack = npmPack } = {}) {
  const problems = []
  for (const { dir, pkg } of publicPackages(join(repoRoot, 'packages'))) {
    const files = pack(dir)
    for (const needed of ['package.json', ...entryPoints(pkg).filter((p) => p !== 'package.json')]) {
      if (!files.includes(needed)) problems.push(`${pkg.name} tarball lacks ${needed}`)
    }
    if (files.some((file) => file.startsWith('src/'))) problems.push(`${pkg.name} tarball ships src/`)
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const problems = [...checkReleaseConfig(repoRoot), ...checkReleasePlease(repoRoot)]
  if (args.includes('--version')) problems.push(...checkVersion(repoRoot, args[args.indexOf('--version') + 1]))
  if (args.includes('--pack')) problems.push(...packDryRun(repoRoot))
  for (const problem of problems) console.error(`check-release: ${problem}`)
  if (problems.length > 0) process.exit(1)
  console.log('check-release: ok')
}
