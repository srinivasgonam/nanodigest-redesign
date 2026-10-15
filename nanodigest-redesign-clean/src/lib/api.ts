const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * Form submissions backend (LocalWP WordPress + nanodigest-backend plugin).
 * Set VITE_WORDPRESS_URL in .env to override.
 */
export const WORDPRESS_URL = trimSlash(
  import.meta.env.VITE_WORDPRESS_URL || 'http://nano-digest.local',
)

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
 * Public form endpoint on the LocalWP WordPress install,
 * e.g. formUrl('newsletter') -> http://nano-digest.local/wp-json/nanodigest/v1/newsletter
 */
export function formUrl(route: string): string {
  return `${WORDPRESS_URL}/wp-json/nanodigest/v1/${route}`
}
