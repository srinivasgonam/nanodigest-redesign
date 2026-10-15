import { useEffect, useRef, useState } from 'react'

type TypewriterProps = {
  text: string
  accent?: string
  typeSpeed?: number
  holdDelay?: number
  clearSpeed?: number
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Typewriter({
  text,
  accent,
  typeSpeed = 65,
  holdDelay = 5000,
  clearSpeed = 40,
}: TypewriterProps) {
  const reduceMotion = useRef(prefersReducedMotion()).current
  const [count, setCount] = useState(reduceMotion ? text.length : 0)
  const timerRef = useRef<number | undefined>()

  useEffect(() => {
    if (reduceMotion) {
      setCount(text.length)
      return
    }

    let mode: 'type' | 'hold' | 'clear' = 'type'
    let idx = 0

    const tick = () => {
      if (mode === 'type') {
        if (idx < text.length) {
          idx += 1
          setCount(idx)
          timerRef.current = window.setTimeout(tick, typeSpeed)
        } else {
          mode = 'hold'
          timerRef.current = window.setTimeout(tick, holdDelay)
        }
        return
      }

      if (mode === 'hold') {
        mode = 'clear'
        timerRef.current = window.setTimeout(tick, 0)
        return
      }

      if (mode === 'clear') {
        if (idx > 0) {
          idx -= 1
          setCount(idx)
          timerRef.current = window.setTimeout(tick, clearSpeed)
        } else {
          mode = 'type'
          timerRef.current = window.setTimeout(tick, 0)
        }
        return
      }
    }

    timerRef.current = window.setTimeout(tick, 0)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [text, typeSpeed, holdDelay, clearSpeed, reduceMotion])

  const shown = text.slice(0, count)
  const accentStart = accent ? text.indexOf(accent) : -1
  const hasAccent = accentStart >= 0

  const renderSplit = (value: string) => {
    if (!hasAccent) return value
    const bodyHead = value.slice(0, accentStart)
    const bodyTail = value.slice(accentStart)
    if (!bodyTail) return bodyHead
    return (
      <>
        {bodyHead}
        <span className="typewriter-accent">{bodyTail}</span>
      </>
    )
  }

  const cursor = reduceMotion ? null : <span className="typewriter-cursor" aria-hidden="true" />

  return (
    <>
      <span className="typewriter-reserve" aria-hidden="true">
        {renderSplit(text)}
      </span>
      <span className="typewriter-shown">
        {renderSplit(shown)}
        {cursor}
      </span>
    </>
  )
}
