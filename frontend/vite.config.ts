import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const certPath = path.resolve(__dirname, '.cert/cert.pem')
const keyPath = path.resolve(__dirname, '.cert/key.pem')
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)

export default defineConfig({
  plugins: [react()],
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
})