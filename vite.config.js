import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { createSheetsTokenMiddleware } from './server/googleSheetsAuth.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sheetsTokenMiddleware = createSheetsTokenMiddleware(env)

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'google-sheets-token-api',
        configureServer(server) {
          server.middlewares.use(sheetsTokenMiddleware)
        },
        configurePreviewServer(server) {
          server.middlewares.use(sheetsTokenMiddleware)
        },
      },
    ],
  }
})
