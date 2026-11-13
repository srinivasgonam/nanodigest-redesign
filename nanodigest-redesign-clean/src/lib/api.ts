import { runtimeRestUrl, servedByWordPress } from './runtime'

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * Form submissions backend. Resolution order (see formUrl below):
 *  0. Served by the WordPress theme – the nanodigest-backend plugin on the same site.
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
 * Content API for the browser. On WordPress it is the site's own REST API.
 * Otherwise, by default we route through the local Express backend in dev so
 * the app can fetch WordPress data without CORS issues.
 * Set VITE_CONTENT_API_URL to override when needed for a different backend.
 */
const configuredContentApiUrl = trimSlash(import.meta.env.VITE_CONTENT_API_URL || '')

export const CONTENT_API_URL = servedByWordPress
  ? runtimeRestUrl
  : import.meta.env.DEV && (!configuredContentApiUrl || configuredContentApiUrl.includes('nanodigest.in'))
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
    // WordPress with plain permalinks serves REST at "?rest_route=", so the
    // base may already carry a query string.
    if (query) url += `${url.includes('?') ? '&' : '?'}${query}`
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
  if (servedByWordPress) return `${runtimeRestUrl}/nanodigest/v1/${route}`

  if (formsApiUrl) return `${formsApiUrl}/${route}`

  if (WORDPRESS_URL && (import.meta.env.DEV || !isLocalOnlyHost(WORDPRESS_URL))) {
    return `${WORDPRESS_URL}/wp-json/nanodigest/v1/${route}`
  }

  return import.meta.env.DEV ? `/api/${route}` : null
}

export const FORMS_UNAVAILABLE_MESSAGE =
  'Online submissions are not connected on this preview yet. Please reach the Nano Digest team through nanodigest.in/contact.'

/**
 * Sends a form to the backend and returns the server's message.
 *
 * `website_url` is a trap for spam bots: the matching input is hidden from
 * people, so it is only ever filled in by scripts, and the server silently
 * drops anything that carries a value there.
 */
export async function submitForm(
  endpoint: string,
  payload: Record<string, unknown>,
  fallbackError: string,
): Promise<string> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('We could not reach the server. Check your connection and try again.')
  }

  let body: { message?: unknown } = {}
  try {
    body = await response.json()
  } catch {
    /* non-JSON reply (e.g. a firewall page): fall through to the generic message */
  }
  const message = typeof body.message === 'string' ? body.message : ''

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Too many attempts. Please wait a few minutes and try again.')
    }
    // Only show the server's wording for input problems; never for server faults.
    throw new Error(response.status >= 400 && response.status < 500 && message ? message : fallbackError)
  }

  return message
}
