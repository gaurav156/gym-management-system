import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const certPath = path.resolve(__dirname, '.cert/cert.pem')
const keyPath = path.resolve(__dirname, '.cert/key.pem')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const favicon = (env.VITE_GYM_LOGO_URL || '').trim() || '/logo.svg'
  const title = (env.VITE_GYM_NAME || '').trim() || 'FitZone Gym'

  return {
    plugins: [
      react(),
      {
        // Fills the favicon/title in index.html, with generic defaults when env vars are
        // empty or unset - so the repo works out of the box for any gym.
        name: 'html-branding',
        transformIndexHtml(html: string) {
          return html
            .replace(/%GYM_FAVICON%/g, escapeHtml(favicon))
            .replace(/%GYM_TITLE%/g, escapeHtml(title))
        },
      },
    ],
    server: {
      port: 5173,
      host: true,
      // Falls back to plain HTTP if certs aren't generated yet, so `npm run dev` still
      // works out of the box for anyone who hasn't run mkcert - HTTPS only kicks in once
      // .cert/cert.pem and .cert/key.pem exist (see README for setup).
      https: hasCerts
        ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
        : undefined,
    },
  }
})