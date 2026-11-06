const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * Form submissions backend. Resolution order (see formUrl below):
 *  1. VITE_FORMS_API_URL  – any backend exposing POST {base}/newsletter, /contact,
 *     /advertise and /orders (the bundled Express API at ".../api", or a hosted one).
 *  2. VITE_WORDPRESS_URL  – WordPress + nanodigest-backend plugin. Local-only
 *     hosts (localhost, *.local) are ignored in production builds because a
 *     visitor's browser can never reach them.
 *  3. In development with nothing set, the bundled Express API through the Vite proxy.
 */
const formsApiUrl = trimSlash(import.meta.env.VITE_FORMS_API_URL || '')
export const WORDPRESS_URL = trimSlash(import.meta.env.VITE_WORDPRESS_URL || '')

const isLocalOnlyHost = (url: string) =>
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\]|[^/:]+\.(local|localhost|test))(:\d+)?(\/|$)/i.test(url)

/**
 * Content API for the browser. By default we route through the local Express
 * backend so the app can fetch WordPress data without CORS issues in dev.
 * Set VITE_CONTENT_API_URL to override when needed for a different backend.
 */
const configuredContentApiUrl = trimSlash(import.meta.env.VITE_CONTENT_API_URL || '')

export const CONTENT_API_URL =
  import.meta.env.DEV && (!configuredContentApiUrl || configuredContentApiUrl.includes('nanodigest.in'))
    ? ''
    : configuredContentApiUrl || 'https://nanodigest.in/wp-json'

type QueryValue = string | number | null | undefined

/**
 * Builds a content URL, e.g. contentUrl('/wp/v2/posts', { page: 2 }).
 * Empty/null/undefined values are dropped, matching the old Express proxy.
 * When no override is configured, requests go through the local Express API.
 */
export function contentUrl(path: string, params?: Record<string, QueryValue>): string {
  const baseUrl = CONTENT_API_URL
  const proxyPath = (() => {
    if (path.startsWith('/api/')) return path
    if (path.startsWith('/wp/v2/')) return `/api/content/${path.replace(/^\/wp\/v2\//, '')}`
    if (path.startsWith('/wc/store/v1/')) return '/api/content/store-products'
    return `/api/content${path}`
  })()

  let url = baseUrl ? `${baseUrl}${path}` : proxyPath

  if (params) {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      search.set(key, String(value))
    }
    const query = search.toString()
    if (query) url += `?${query}`
  }

  return url
}

/**
 * Endpoint for a form submission ('newsletter' | 'contact' | 'advertise' | 'orders'),
 * or null when no reachable backend is configured (e.g. the static GitHub Pages
 * preview). Callers must show a friendly message instead of firing a request
 * that is certain to fail.
 */
export function formUrl(route: string): string | null {
  if (formsApiUrl) return `${formsApiUrl}/${route}`

  if (WORDPRESS_URL && (import.meta.env.DEV || !isLocalOnlyHost(WORDPRESS_URL))) {
    return `${WORDPRESS_URL}/wp-json/nanodigest/v1/${route}`
  }

  return import.meta.env.DEV ? `/api/${route}` : null
}

export const FORMS_UNAVAILABLE_MESSAGE =
  'Online submissions are not connected on this preview yet. Please reach the Nano Digest team through nanodigest.in/contact.'
