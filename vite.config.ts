import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

// In-memory relay: the web app POSTs a change here; the Figma plugin GETs it.
// Avoids clipboard-read permission issues in cross-origin plugin iframes.
let pendingChange: object | null = null

function viRelay(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/vi-relay')) { next(); return }
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method === 'POST') {
    let body = ''
    req.on('data', (d: Buffer) => { body += d })
    req.on('end', () => {
      try { pendingChange = JSON.parse(body) } catch {}
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true }))
    })
  } else {
    const out = pendingChange
    pendingChange = null
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(out))
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vi-relay',
      configureServer(server) { server.middlewares.use(viRelay) },
    },
  ],
  server: {
    proxy: {
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/claude/, '/v1'),
      },
    },
  },
})
