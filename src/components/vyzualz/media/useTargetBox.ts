import { useEffect, useState, type RefObject } from 'react'

export interface TargetBox { left: number; top: number; width: number; height: number }

/**
 * Tracks the target's box relative to the overlay's own positioned parent, limited to the parent (a zoomed picture can be
 * larger than the preview). Pass a changing `revision` to re-measure when the target moves without resizing (zoom, pan).
 */
export function useTargetBox(targetRef: RefObject<HTMLElement>, rootRef: RefObject<HTMLElement>, revision?: unknown): TargetBox | null {
  const [box, setBox] = useState<TargetBox | null>(null)
  useEffect(() => {
    const target = targetRef.current
    const parent = rootRef.current?.parentElement
    if (!target || !parent) return
    const measure = () => {
      const t = target.getBoundingClientRect()
      const p = parent.getBoundingClientRect()
      setBox(previous => {
        const left = Math.max(t.left, p.left), top = Math.max(t.top, p.top)
        const right = Math.min(t.right, p.right), bottom = Math.min(t.bottom, p.bottom)
        const next = { left: left - p.left, top: top - p.top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
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
  }, [targetRef, rootRef, revision])
  return box
}
