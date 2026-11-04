#!/usr/bin/env node
// runs one package script in every workspace, dependencies first. yarn 1 `workspaces run` goes in
// folder order, but a package's declaration build reads its @wasichai deps' dist, so order matters.
// usage: node tooling/run-ordered.mjs <script>
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// devDependencies never order a build: core tests reach @wasichai/testing through an alias
const ORDER_FIELDS = ['dependencies', 'peerDependencies']

function subdirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name))
  } catch {
    return []
  }
}

// only `*` segments, which is all the root package.json uses
export function expandWorkspaces(root, patterns) {
  const found = []
  for (const pattern of patterns) {
    let current = [root]
    for (const segment of pattern.split('/')) {
      current = current.flatMap((base) => (segment === '*' ? subdirs(base) : existsSync(join(base, segment)) ? [join(base, segment)] : []))
    }
    found.push(...current.filter((dir) => existsSync(join(dir, 'package.json'))))
  }
  return found
}

export function readWorkspaces(root, patterns) {
  return expandWorkspaces(root, patterns).map((dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return { name: manifest.name, dir, manifest }
  })
}

// depth-first, alphabetical among equals so the order is stable run to run
export function buildOrder(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]))
  const state = new Map()
  const order = []

  const visit = (pkg, trail) => {
    if (state.get(pkg.name) === 'done') return
    if (state.get(pkg.name) === 'visiting') throw new Error(`workspace cycle: ${[...trail, pkg.name].join(' -> ')}`)
    state.set(pkg.name, 'visiting')
    for (const field of ORDER_FIELDS) {
      for (const dep of Object.keys(pkg.manifest[field] ?? {}).sort()) {
        const target = byName.get(dep)
        if (target) visit(target, [...trail, pkg.name])
      }
    }
    state.set(pkg.name, 'done')
    order.push(pkg)
  }

  for (const pkg of [...packages].sort((a, b) => a.name.localeCompare(b.name))) visit(pkg, [])
  return order
}

function main([script]) {
  if (!script) {
    console.error('usage: run-ordered.mjs <script>')
    process.exit(1)
  }
  const root = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  for (const pkg of buildOrder(readWorkspaces(REPO_ROOT, root.workspaces))) {
    if (!pkg.manifest.scripts?.[script]) continue
    console.log(`\n> ${pkg.name}: yarn run ${script}`)
    execFileSync('yarn', ['run', script], { cwd: pkg.dir, stdio: 'inherit' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
