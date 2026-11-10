import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Thin gradient bar at the top of the viewport showing page scroll progress. */
export function PageProgress() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0
      if (ref.current) ref.current.style.transform = `scaleX(${ratio})`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return <div className="page-progress" ref={ref} aria-hidden="true" />
}

/** Counts up to `value` the first time it scrolls into view. */
export function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value)
      return
    }
    const node = ref.current
    if (!node) return
    let raf = 0
    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          run()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [value, duration])

  return <span ref={ref}>{shown.toLocaleString('en-IN')}</span>
}

/** Infinite, pause-on-hover ticker of topic names. */
export function TopicTicker({ items }: { items: string[] }) {
  if (!items.length) return null
  const row = [...items, ...items]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {row.map((item, index) => (
          <span className="ticker-item" key={`${item}-${index}`}>
            <i /> {item}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Site-wide pointer effects: a spotlight that follows the cursor inside glass cards
 * and a soft 3D tilt on the hero. Reveal-on-scroll for marked sections.
 */
export function useSiteEffects() {
  useEffect(() => {
    if (prefersReducedMotion()) return

    const onMove = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '.subject-card, .pick-story, .article-card, .stat, .newsletter-form',
      )
      if (target) {
        const rect = target.getBoundingClientRect()
        target.style.setProperty('--mx', `${event.clientX - rect.left}px`)
        target.style.setProperty('--my', `${event.clientY - rect.top}px`)
      }
      const hero = (event.target as HTMLElement | null)?.closest<HTMLElement>('.hero-story')
      if (hero) {
        const rect = hero.getBoundingClientRect()
        const px = (event.clientX - rect.left) / rect.width - 0.5
        const py = (event.clientY - rect.top) / rect.height - 0.5
        hero.style.setProperty('--tilt-x', `${(-py * 3).toFixed(2)}deg`)
        hero.style.setProperty('--tilt-y', `${(px * 4).toFixed(2)}deg`)
      }
    }
    const onLeave = (event: PointerEvent) => {
      const hero = (event.target as HTMLElement | null)?.closest<HTMLElement>('.hero-story')
      if (hero && !hero.contains(event.relatedTarget as Node | null)) {
        hero.style.setProperty('--tilt-x', '0deg')
        hero.style.setProperty('--tilt-y', '0deg')
      }
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerout', onLeave, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerout', onLeave)
    }
  }, [])
}
