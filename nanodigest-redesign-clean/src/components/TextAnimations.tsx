import { Fragment, useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

type WordToken = { text: string; start: number }

function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = []
  const pattern = /\S+/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    tokens.push({ text: match[0], start: match.index })
  }
  return tokens
}

/**
 * Hero headline animation in the style of tidio.com: each word rises out of
 * an overflow mask, one after another, while an accented phrase keeps the
 * brand gradient sheen.
 */
export function WordsRise({
  text,
  accent,
  className = '',
}: {
  text: string
  accent?: string
  className?: string
}) {
  const words = tokenize(text)
  const accentStart = accent ? text.indexOf(accent) : -1
  const accentEnd = accentStart >= 0 && accent ? accentStart + accent.length : -1

  return (
    <span className={`words-rise${className ? ` ${className}` : ''}`}>
      {words.map((word, index) => {
        const accented = accentStart >= 0 && word.start >= accentStart && word.start < accentEnd
        return (
          <Fragment key={`${word.text}-${index}`}>
            <span className="word">
              <span
                className={`word-inner${accented ? ' is-accent' : ''}`}
                style={{ animationDelay: `${0.15 + index * 0.085}s` }}
              >
                {word.text}
              </span>
            </span>
            {index < words.length - 1 ? ' ' : null}
          </Fragment>
        )
      })}
    </span>
  )
}

/**
 * Tidio-style text reveal: every word sits at low opacity until the block
 * scrolls into view, then words light up one at a time.
 */
export function ScrollWords({
  text,
  emphasis = [],
  className = '',
}: {
  text: string
  emphasis?: string[]
  className?: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [revealed, setRevealed] = useState(() => prefersReducedMotion())
  const words = tokenize(text)
  const emphasisSet = new Set(emphasis.map((word) => word.toLowerCase()))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(true)
      return
    }
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          setRevealed(true)
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <p
      ref={ref}
      className={`scroll-words${revealed ? ' is-revealed' : ''}${className ? ` ${className}` : ''}`}
    >
      {words.map((word, index) => {
        const bare = word.text.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase()
        const accented = emphasisSet.has(bare)
        return (
          <span
            className={`scroll-word${accented ? ' is-accent' : ''}`}
            key={`${word.text}-${index}`}
            style={{ transitionDelay: revealed ? `${index * 80}ms` : '0ms' }}
          >
            {word.text}
            {index < words.length - 1 ? ' ' : null}
          </span>
        )
      })}
    </p>
  )
}
