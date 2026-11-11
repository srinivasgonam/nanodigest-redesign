import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Static hosts (GitHub Pages) answer unknown paths with a 404 status, even
 * though 404.html then restores the route. Search engines and link previews
 * treat that as a missing page, so emit a real index.html for every fixed
 * route. Article and category pages are dynamic and still rely on 404.html.
 */
const staticRoutes = [
  'shop',
  'cart',
  'checkout',
  'my-account',
  'about',
  'advertise',
  'contact',
  'privacy-policy',
  'terms-conditions',
  'pages',
]

const staticRoutePages = (): Plugin => ({
  name: 'static-route-pages',
  apply: 'build',
  closeBundle() {
    const outDir = resolve(import.meta.dirname, 'dist')
    const html = readFileSync(resolve(outDir, 'index.html'))
    for (const route of staticRoutes) {
      mkdirSync(resolve(outDir, route), { recursive: true })
      writeFileSync(resolve(outDir, route, 'index.html'), html)
    }
  },
})

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/nanodigest-redesign/' : '/',
  plugins: [react(), staticRoutePages()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}))
