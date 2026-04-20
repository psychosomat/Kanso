import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function copyPublicFiles(): import('vite').Plugin {
  return {
    name: 'copy-public-files',
    closeBundle() {
      const publicDir = path.join(__dirname, 'public')
      const outDir = path.join(__dirname, 'dist', 'client')

      if (fs.existsSync(publicDir) && fs.existsSync(outDir)) {
        const files = fs.readdirSync(publicDir)
        for (const file of files) {
          const srcPath = path.join(publicDir, file)
          const destPath = path.join(outDir, file)

          if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }
    },
  }
}

const config = defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
          typeof warning.id === 'string' &&
          (
            warning.id.includes('@tanstack/start-server-core/dist/esm/index.js') ||
            warning.id.includes('@tanstack/start-client-core/dist/esm/index.js')
          )
        ) {
          return
        }

        warn(warning)
      },
    },
  },
  plugins: [
    ...(process.env.NODE_ENV === 'development' ? [devtools()] : []),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    viteReact({
      babel: {
        plugins: [
          ['@babel/plugin-transform-typescript', {
            allowDeclareFields: true,
            isTSX: true,
          }],
        ],
      },
    }),
    copyPublicFiles(),
  ],
})

export default config
