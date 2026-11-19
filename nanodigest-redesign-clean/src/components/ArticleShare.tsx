import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { buildShareLinks, formatCount } from '../lib/articleShare.js'
import type { ArticleStats, ShareNetwork } from '../lib/api'

type Props = {
  /** Public address of the article that gets shared. */
  url: string
  title: string
  /** Totals, or null when the site has no counter (static preview). */
  stats: ArticleStats | null
  onShare: (network: ShareNetwork) => void
  /** "top" also shows the totals; "bottom" is the buttons only. */
  variant: 'top' | 'bottom'
}

async function copyToClipboard(text: string) {
  try {
    // A browser that neither answers nor refuses must not leave the button stuck.
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 2000)),
    ])
    return true
  } catch {
    /* clipboard blocked: fall back to a temporary text box */
  }
  try {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(box)
    return copied
  } catch {
    return false
  }
}

export function ArticleShare({ url, title, stats, onShare, variant }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<number | undefined>(undefined)
  const links = buildShareLinks({ url, title })

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  if (links.length === 0) return null

  const copyLink = async () => {
    const copied = await copyToClipboard(url)
    setCopyState(copied ? 'copied' : 'failed')
    window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2500)
    if (copied) onShare('copy')
  }

  return (
    <div className={`article-share article-share--${variant}`}>
      {variant === 'top' && stats && (
        <dl className="article-share-stats" aria-label="Article totals">
          <div>
            <dd>{formatCount(stats.shares)}</dd>
            <dt>Shares</dt>
          </div>
          <div>
            <dd>{formatCount(stats.views)}</dd>
            <dt>Views</dt>
          </div>
        </dl>
      )}
      <div className="article-share-actions" role="group" aria-label="Share this article">
        {links.map((link) => (
          <a
            key={link.network}
            className={`share-button share-button--${link.network}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${link.label}`}
            onClick={() => onShare(link.network)}
          >
            <Icon name={link.network === 'x' ? 'x' : link.network} size={17} />
            <span>{link.label}</span>
          </a>
        ))}
        <button type="button" className="share-button share-button--copy" onClick={copyLink}>
          <Icon name="link" size={17} />
          <span>{copyState === 'copied' ? 'Link copied' : copyState === 'failed' ? 'Copy failed' : 'Copy link'}</span>
        </button>
        <span className="article-share-live" role="status" aria-live="polite">
          {copyState === 'copied' ? 'Link copied to the clipboard.' : copyState === 'failed' ? 'Could not copy the link.' : ''}
        </span>
      </div>
    </div>
  )
}
