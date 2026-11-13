import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Three builds:
 *
 *   npm run build       GitHub Pages preview, served under /nanodigest-redesign/
 *   npm run build:node  for the bundled Express server, served from the domain root
 *   npm run build:wp    for the WordPress theme (see scripts/package-wordpress.mjs)
 *
 * The WordPress build uses relative asset paths because the files live inside
 * the theme folder, and writes a manifest so the theme can find them.
 */
const builds = {
  production: { base: '/nanodigest-redesign/', outDir: 'dist', staticPages: true },
  node: { base: '/', outDir: 'dist', staticPages: false },
  wordpress: { base: './', outDir: 'dist-wp', staticPages: false },
} as const

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

export default defineConfig(({ command, mode }) => {
  const build = builds[mode as keyof typeof builds] ?? builds.production
  const isWordPress = mode === 'wordpress'

  return {
    base: command === 'build' ? build.base : '/',
    plugins: [react(), ...(build.staticPages ? [staticRoutePages()] : [])],
    build: {
      outDir: build.outDir,
      manifest: isWordPress,
      // The theme prints its own page; the GitHub Pages redirect helper in
      // public/ has no place there.
      copyPublicDir: !isWordPress,
    },
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
  }
})
