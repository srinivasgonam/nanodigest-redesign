import { useEffect, useMemo, useRef, useState } from 'react'
import { externalCookieBanner } from '../lib/runtime'

export type AdFormat = 'leaderboard' | 'in-article' | 'rectangle' | 'sidebar'

export type AdPlacement =
  | 'home-leaderboard'
  | 'home-mid-banner'
  | 'archive-banner'
  | 'article-in-content'
  | 'article-sidebar'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

type AdSlotConfig = {
  format: AdFormat
  /** Intended responsive sizes, shown on the placeholder only. */
  sizeHint: string
  /** AdSense ad-unit id for this placement (from a VITE_ADSENSE_SLOT_* variable). */
  slotId: string
}

/**
 * Google AdSense configuration (all optional, set at build time):
 *   VITE_ADSENSE_CLIENT            publisher id, e.g. ca-pub-1234567890123456
 *   VITE_ADSENSE_SLOT_LEADERBOARD  ad-unit id used by the banner placements
 *   VITE_ADSENSE_SLOT_IN_ARTICLE   ad-unit id used inside articles
 *   VITE_ADSENSE_SLOT_SIDEBAR      ad-unit id used by the article sidebar
 *   VITE_SHOW_AD_PLACEHOLDERS      "true" shows labelled empty ad spaces (for demos)
 */
const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT || '').trim()
const SHOW_PLACEHOLDERS = import.meta.env.VITE_SHOW_AD_PLACEHOLDERS === 'true'
const SLOT_LEADERBOARD = (import.meta.env.VITE_ADSENSE_SLOT_LEADERBOARD || '').trim()
const SLOT_IN_ARTICLE = (import.meta.env.VITE_ADSENSE_SLOT_IN_ARTICLE || '').trim()
const SLOT_SIDEBAR = (import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || '').trim()

const PLACEMENTS: Record<AdPlacement, AdSlotConfig> = {
  'home-leaderboard': {
    format: 'leaderboard',
    sizeHint: '728×90 / 970×90 (responsive)',
    slotId: SLOT_LEADERBOARD,
  },
  'home-mid-banner': {
    format: 'leaderboard',
    sizeHint: '728×90 / 970×90 (responsive)',
    slotId: SLOT_LEADERBOARD,
  },
  'archive-banner': {
    format: 'leaderboard',
    sizeHint: '728×90 / 970×90 (responsive)',
    slotId: SLOT_LEADERBOARD,
  },
  'article-in-content': {
    format: 'in-article',
    sizeHint: '336×280 / responsive in-article',
    slotId: SLOT_IN_ARTICLE,
  },
  'article-sidebar': {
    format: 'sidebar',
    sizeHint: '300×600 half-page',
    slotId: SLOT_SIDEBAR,
  },
}

const PREVIEW_STORAGE_KEY = 'nanoDigestAdsPreview'

/** Same key/event the cookie notice in App.tsx uses to record the visitor's choice. */
export const COOKIE_CHOICE_KEY = 'nano-digest-cookie-choice'
export const COOKIE_CHOICE_EVENT = 'nano-digest-cookie-choice'

const ADSENSE_SCRIPT_ID = 'nano-digest-adsense'

function cookiesAccepted(): boolean {
  // A WordPress consent plugin (CookieYes) owns the answer when it is active.
  if (externalCookieBanner) {
    return /(?:^|;\s*)cookieyes-consent=[^;]*advertisement:yes/.test(document.cookie)
  }
  try {
    return window.localStorage.getItem(COOKIE_CHOICE_KEY) === 'accepted'
  } catch {
    return false
  }
}

/** Re-renders when the visitor answers the cookie notice. */
function useCookieConsent(): boolean {
  const [accepted, setAccepted] = useState(cookiesAccepted)

  useEffect(() => {
    const update = () => setAccepted(cookiesAccepted())
    window.addEventListener(COOKIE_CHOICE_EVENT, update)
    return () => window.removeEventListener(COOKIE_CHOICE_EVENT, update)
  }, [])

  return accepted
}

/**
 * Whether labelled, empty ad spaces should be drawn. True in development, when
 * VITE_SHOW_AD_PLACEHOLDERS=true, or when previewing with ?ads=preview.
 */
export function adsPreviewEnabled(): boolean {
  if (import.meta.env.DEV || SHOW_PLACEHOLDERS) return true
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const requested = params.get('ads')
  try {
    // ?ads=preview turns the labelled spaces on and remembers it while browsing
    // (page changes drop the query string); ?ads=off turns them off again.
    if (requested === 'preview') window.localStorage.setItem(PREVIEW_STORAGE_KEY, '1')
    if (requested === 'off') window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === '1'
  } catch {
    return requested === 'preview'
  }
}

/**
 * True when ad spaces will be visible, either as placeholders or as real
 * AdSense units (publisher id configured AND the visitor accepted cookies).
 * The article layout uses this so it only reserves a sidebar column when there
 * is actually something to show in it.
 */
export function useAdsEnabled(): boolean {
  const accepted = useCookieConsent()
  const preview = useMemo(() => adsPreviewEnabled(), [])
  return preview || (Boolean(ADSENSE_CLIENT) && accepted)
}

function loadAdsenseScript() {
  if (document.getElementById(ADSENSE_SCRIPT_ID)) return
  const script = document.createElement('script')
  script.id = ADSENSE_SCRIPT_ID
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`
  document.head.appendChild(script)
}

type AdSlotProps = {
  placement: AdPlacement
  className?: string
}

/**
 * A reserved, responsive area for a Google AdSense unit.
 *
 *  - Live ads: rendered only when VITE_ADSENSE_CLIENT and this placement's
 *    ad-unit id are configured AND the visitor accepted cookies. The AdSense
 *    script is loaded lazily at that moment, never before consent.
 *  - Placeholder: a labelled empty space, shown only in development, with
 *    VITE_SHOW_AD_PLACEHOLDERS=true, or with ?ads=preview.
 *  - Otherwise nothing is rendered, so the public site never shows empty boxes.
 */
export function AdSlot({ placement, className }: AdSlotProps) {
  const config = PLACEMENTS[placement]
  const accepted = useCookieConsent()
  const preview = useMemo(() => adsPreviewEnabled(), [])
  const live = Boolean(ADSENSE_CLIENT && config.slotId) && accepted
  const requested = useRef(false)

  useEffect(() => {
    if (!live) return
    loadAdsenseScript()
    if (requested.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      requested.current = true
    } catch {
      /* AdSense blocked (ad blocker, network) – the reserved space stays empty */
    }
  }, [live])

  const classes = ['ad-slot', `ad-slot--${config.format}`, `ad-slot--${placement}`, className]
    .filter(Boolean)
    .join(' ')

  if (live) {
    return (
      <aside
        className={`${classes} ad-slot--live`}
        aria-label="Advertisement"
        data-ad-placement={placement}
      >
        <span className="ad-slot-label">Advertisement</span>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={config.slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </aside>
    )
  }

  if (!preview) return null

  return (
    <aside className={classes} aria-label="Advertisement" data-ad-placement={placement}>
      <span className="ad-slot-label">Advertisement</span>
      <div className="ad-slot-body">
        <span className="ad-slot-format">Google ad space · {config.sizeHint}</span>
        <span className="ad-slot-note">Reserved for Google AdSense · {placement}</span>
      </div>
    </aside>
  )
}
