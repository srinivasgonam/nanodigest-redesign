import DOMPurify from 'dompurify'

/** Video hosts allowed to appear as embedded players inside articles. */
const VIDEO_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
])

function parseUrl(value: string): URL | null {
  try {
    return new URL(value, window.location.href)
  } catch {
    return null
  }
}

let hooksInstalled = false

function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return

    // A page opened in a new tab can otherwise reach back into this one
    // through window.opener.
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }

    // Embedded players are allowed from known video hosts only, over https.
    if (node.tagName === 'IFRAME') {
      const url = parseUrl(node.getAttribute('src') || '')
      if (!url || url.protocol !== 'https:' || !VIDEO_HOSTS.has(url.hostname)) {
        node.remove()
        return
      }
      node.setAttribute('loading', 'lazy')
      node.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    }
  })
}

/**
 * Cleans HTML written in WordPress before it is placed in the page. Scripts,
 * event handlers and unknown embeds are removed; video players from the hosts
 * above are kept.
 */
export function sanitizeCmsHtml(html: string): string {
  installHooks()
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'target'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea'],
  })
}

/**
 * Turns a YouTube or Vimeo address into its embeddable player address, or ''
 * when the address is not a video we recognise.
 */
export function videoEmbedUrl(value: string | undefined | null): string {
  if (!value) return ''
  const url = parseUrl(value)
  if (!url || !/^https?:$/.test(url.protocol)) return ''
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  const validId = (id: string | null | undefined) => (id && /^[\w-]{6,20}$/.test(id) ? id : '')

  if (host === 'youtu.be') {
    const id = validId(url.pathname.split('/')[1])
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : ''
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, kind, rest] = url.pathname.split('/')
    const id = validId(kind === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(kind) ? rest : '')
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : ''
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop()
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : ''
  }
  return ''
}
