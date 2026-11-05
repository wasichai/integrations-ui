import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// a module stays installable on its own: no other module package, no other module's heavy library.
// import.meta.dirname, not new URL(.., import.meta.url): vite rewrites the latter under jsdom
const SRC = import.meta.dirname
// integration-workflows owns its canvas library, xyflow
const OWN = /^(@xyflow\/react)$/
const HEAVY = /^(maplibre-gl|terra-draw.*|@xyflow\/.+|@tiptap\/.+|@dnd-kit\/.+)$/

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

function importsOf(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'|import '([^']+)'/g)].map((match) => match[1] ?? match[2])
}

describe('integration-workflows boundaries', () => {
  it('imports no other module package and no heavy library it does not own', () => {
    const offenders = sources(SRC).flatMap((file) =>
      importsOf(file)
        .map((specifier) =>
          specifier
            .split('/')
            .slice(0, specifier.startsWith('@') ? 2 : 1)
            .join('/')
        )
        .filter((pkg) => (pkg.startsWith('@wasichai/') && pkg !== '@wasichai/core' && pkg !== '@wasichai/ui') || (HEAVY.test(pkg) && !OWN.test(pkg)))
        .map((pkg) => `${relative(SRC, file)} -> ${pkg}`)
    )
    expect(offenders).toEqual([])
  })

  // REST paths passed to api() are fine; what links must build is every in-app url handed to a
  // Link, an <a> or navigate()
  it('never spells an in-app url: links build them', () => {
    const offenders = sources(SRC).filter((file) => /(?:\bto=|\bhref=|navigate\()\{?\s*[`'"]\/(?!\/)/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((file) => relative(SRC, file))).toEqual([])
  })

  // the main entry must not drag xyflow (and its css) into an app's first bundle: only the designer's lazy route loads it
  it('keeps xyflow out of everything index.ts reaches statically', () => {
    const seen = new Set<string>()
    const visit = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      for (const specifier of importsOf(file).filter((s) => s.startsWith('.'))) {
        const base = resolve(dirname(file), specifier)
        const found = [`${base}.ts`, `${base}.tsx`].find((candidate) => statSync(candidate, { throwIfNoEntry: false })?.isFile())
        if (found) visit(found)
      }
    }
    visit(join(SRC, 'index.ts'))
    const offenders = [...seen].filter((file) => importsOf(file).some((specifier) => specifier.startsWith('@xyflow/')))
    expect(offenders.map((file) => relative(SRC, file))).toEqual([])
    expect([...seen].map((file) => relative(SRC, file))).not.toContain('DesignerPage.tsx')
  })
})
