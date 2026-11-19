/**
 * Helpers for the article share bar: the share links for each network and the
 * short number format used for the views and shares totals.
 */

/** Networks that have a button on the share bar, plus the copy-link button. */
export const SHARE_NETWORKS = ['facebook', 'x', 'whatsapp', 'linkedin']
export const COUNTED_SHARE_NETWORKS = [...SHARE_NETWORKS, 'copy']

const LABELS = {
  facebook: 'Facebook',
  x: 'X',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
}

/**
 * Short form for a total: 504 -> "504", 1400 -> "1.4k", 12500 -> "12.5k",
 * 2000000 -> "2M". Never rounds up, so a total is never overstated.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function formatCount(value) {
  const number = Math.max(0, Math.floor(Number(value) || 0))
  if (number < 1000) return String(number)
  for (const [size, suffix] of [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ]) {
    if (number >= size) {
      const shortened = Math.floor((number / size) * 10) / 10
      return `${String(shortened).replace(/\.0$/, '')}${suffix}`
    }
  }
  return String(number)
}

/**
 * Share links for one article. Returns an empty list unless the address is a
 * plain http(s) address, so a bad value can never become a "javascript:" link.
 *
 * @param {{ url: string, title: string }} article
 * @returns {Array<{ network: 'facebook' | 'x' | 'whatsapp' | 'linkedin', label: string, href: string }>}
 */
export function buildShareLinks({ url, title }) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return []
  const address = encodeURIComponent(url)
  const text = encodeURIComponent(String(title || '').trim())
  const message = encodeURIComponent(`${String(title || '').trim()}\n${url}`.trim())

  const hrefs = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${address}`,
    x: `https://x.com/intent/post?text=${text}&url=${address}`,
    whatsapp: `https://api.whatsapp.com/send?text=${message}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${address}`,
  }

  return SHARE_NETWORKS.map((network) => ({
    network,
    label: LABELS[network],
    href: hrefs[network],
  }))
}
