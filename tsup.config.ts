import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['electron/main.ts', 'electron/preload.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  clean: false,
  external: ['electron'],
  sourcemap: true,
  splitting: false,
  onSuccess: 'echo "Build complete"',
})
