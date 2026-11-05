import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: here('./src/index.ts'), formats: ['es'], fileName: 'index' },
    rolldownOptions: {
      // deep imports too (xyflow's css): the consumer's bundler resolves them
      external: (id: string) => external.some((dep) => id === dep || id.startsWith(`${dep}/`))
    },
    sourcemap: true
  },
  // @wasichai/core, ui and testing come built from GitHub Packages: no aliases to their sources
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
})
