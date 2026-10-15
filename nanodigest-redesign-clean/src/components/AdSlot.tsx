import { useMemo } from 'react'

export type AdFormat = 'leaderboard' | 'in-article' | 'rectangle' | 'sidebar'

export type AdPlacement =
  | 'home-leaderboard'
  | 'archive-banner'
  | 'article-in-content'
  | 'article-sidebar'

type AdSlotConfig = {
  format: AdFormat
  /** Intended responsive sizes, shown on the development placeholder only. */
  sizeHint: string
}

const PLACEMENTS: Record<AdPlacement, AdSlotConfig> = {
  'home-leaderboard': { format: 'leaderboard', sizeHint: '728×90 / 970×90 (responsive)' },
  'archive-banner': { format: 'leaderboard', sizeHint: '728×90 / 970×90 (responsive)' },
  'article-in-content': { format: 'in-article', sizeHint: '336×280 / responsive in-article' },
  'article-sidebar': { format: 'sidebar', sizeHint: '300×600 half-page' },
}

const PREVIEW_STORAGE_KEY = 'nanoDigestAdsPreview'

/**
 * Ad slots render only in development or when preview mode is explicitly
 * requested, so the public production site never shows large empty ad boxes.
 * When real AdSense details are approved, extend this to also return true when
 * a configured publisher/unit id is present.
 */
export function adsPreviewEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('ads') === 'preview') return true
  try {
    return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

type AdSlotProps = {
  placement: AdPlacement
  className?: string
}

/**
 * Reserved, responsive area for a future Google AdSense unit.
 *
 * This component intentionally contains no advertising code and no publisher or
 * ad-slot ids. It only reserves layout space and shows a development/preview
 * placeholder. Real AdSense integration can be added inside `ad-slot-body`
 * later without changing the surrounding layout.
 */
export function AdSlot({ placement, className }: AdSlotProps) {
  const config = PLACEMENTS[placement]
  const enabled = useMemo(() => adsPreviewEnabled(), [])

  if (!enabled) return null

  return (
    <aside
      className={['ad-slot', `ad-slot--${config.format}`, `ad-slot--${placement}`, className]
        .filter(Boolean)
        .join(' ')}
      aria-label="Advertisement"
      data-ad-placement={placement}
    >
      <span className="ad-slot-label">Advertisement</span>
      <div className="ad-slot-body">
        <span className="ad-slot-format">{config.sizeHint}</span>
        <span className="ad-slot-note">Reserved ad space · {placement}</span>
      </div>
      {/*
        Future Google AdSense integration goes here once the publisher and
        ad-unit are approved:
          1. Add the AdSense loader script once in index.html.
          2. Replace `ad-slot-body` content with:
             <ins className="adsbygoogle" style={{ display: 'block' }}
                  data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                  data-ad-slot="0000000000"
                  data-ad-format="auto"
                  data-full-width-responsive="true" />
          3. Push the unit: (window.adsbygoogle = window.adsbygoogle || []).push({})
        Do not commit placeholder publisher or ad-slot ids.
      */}
    </aside>
  )
}
