const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * Form submissions backend (LocalWP WordPress + nanodigest-backend plugin).
 * Set VITE_WORDPRESS_URL in .env to override.
 */
export const WORDPRESS_URL = trimSlash(
  import.meta.env.VITE_WORDPRESS_URL || 'http://nano-digest.local',
)

/**
 * Content API (posts, pages, products, store) read directly from
 * the public WordPress REST API. Set VITE_CONTENT_API_URL to override.
 */
export const CONTENT_API_URL = trimSlash(
  import.meta.env.VITE_CONTENT_API_URL || 'https://nanodigest.in/wp-json',
)

type QueryValue = string | number | null | undefined

/**
 * Builds a content URL, e.g. contentUrl('/wp/v2/posts', { page: 2 }).
 * Empty/null/undefined values are dropped, matching the old Express proxy.
 */
export function contentUrl(path: string, params?: Record<string, QueryValue>): string {
  let url = `${CONTENT_API_URL}${path}`
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
