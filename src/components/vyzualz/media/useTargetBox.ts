import { useEffect, useState, type RefObject } from 'react'

export interface TargetBox { left: number; top: number; width: number; height: number }

/** Tracks the target's box relative to the overlay's own positioned parent. */
export function useTargetBox(targetRef: RefObject<HTMLElement>, rootRef: RefObject<HTMLElement>): TargetBox | null {
  const [box, setBox] = useState<TargetBox | null>(null)
  useEffect(() => {
    const target = targetRef.current
    const parent = rootRef.current?.parentElement
    if (!target || !parent) return
    const measure = () => {
      const t = target.getBoundingClientRect()
      const p = parent.getBoundingClientRect()
      setBox(previous => {
        const next = { left: t.left - p.left, top: t.top - p.top, width: t.width, height: t.height }
        return previous && previous.left === next.left && previous.top === next.top
          && previous.width === next.width && previous.height === next.height ? previous : next
      })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(target)
    observer?.observe(parent)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [targetRef, rootRef])
  return box
}
