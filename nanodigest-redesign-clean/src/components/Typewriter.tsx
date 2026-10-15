import { useEffect, useRef, useState } from 'react'

type TypewriterProps = {
  text: string
  typeSpeed?: number
  deleteSpeed?: number
  holdDelay?: number
  emptyDelay?: number
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Typewriter({
  text,
  typeSpeed = 65,
  deleteSpeed = 35,
  holdDelay = 2000,
  emptyDelay = 650,
}: TypewriterProps) {
  const reduceMotion = useRef(prefersReducedMotion()).current
  const [displayed, setDisplayed] = useState(reduceMotion ? text : '')

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(text)
      return
    }

    let index = 0
    let deleting = false
    let timer: number

    const tick = () => {
      if (!deleting) {
        index += 1
        setDisplayed(text.slice(0, index))
        if (index >= text.length) {
          deleting = true
          timer = window.setTimeout(tick, holdDelay)
          return
        }
        timer = window.setTimeout(tick, typeSpeed)
        return
      }

      index -= 1
      setDisplayed(text.slice(0, Math.max(index, 0)))
      if (index <= 0) {
        deleting = false
        timer = window.setTimeout(tick, emptyDelay)
        return
      }
      timer = window.setTimeout(tick, deleteSpeed)
    }

    setDisplayed('')
    timer = window.setTimeout(tick, typeSpeed)
    return () => window.clearTimeout(timer)
  }, [text, typeSpeed, deleteSpeed, holdDelay, emptyDelay, reduceMotion])

  return (
    <>
      {displayed}
      {!reduceMotion && <span className="typewriter-cursor" aria-hidden="true" />}
    </>
  )
}
