import { useEffect, useState, type RefObject } from 'react'

/**
 * Responsive layout of the Lyric Manager, driven by the manager's own width (not the window's:
 * the app sidebar takes a fixed slice of the window first).
 *
 *   wide      Tracks | Timeline | Inspector, shared React rail width
 *   standard  Tracks | Timeline | Inspector, shared React rail width
 *   laptop    Timeline | Inspector — Tracks & Versions becomes a slide-over drawer
 *   narrow    Timeline only — Tracks & Versions and the Inspector are slide-over drawers
 *
 * Breakpoints come from the minimum useful width of each region instead of device sizes:
 * both rails remain docked above 1260px of manager space; below that the Tracks rail
 * becomes a drawer. Below 900px both rails become drawers. Expanded rail widths share
 * React's CSS measurements (354px desktop, 324px medium, 294px narrow drawers).
 */
export type LyricLayoutMode = 'wide' | 'standard' | 'laptop' | 'narrow'

export const LYRIC_LAYOUT_BREAKPOINTS = {
  /** At or above: wide workspace mode (rail width is shared with React). */
  wide: 1500,
  /** At or above: both rails docked. */
  standard: 1260,
  /** At or above: Inspector docked, Tracks & Versions is a drawer. Below: both are drawers. */
  laptop: 900,
} as const

export function resolveLyricLayoutMode(width: number | null | undefined): LyricLayoutMode {
  // Unknown width (first paint, or no ResizeObserver) keeps the primary desktop layout.
  if (width === null || width === undefined || !Number.isFinite(width) || width <= 0) return 'wide'
  if (width >= LYRIC_LAYOUT_BREAKPOINTS.wide) return 'wide'
  if (width >= LYRIC_LAYOUT_BREAKPOINTS.standard) return 'standard'
  if (width >= LYRIC_LAYOUT_BREAKPOINTS.laptop) return 'laptop'
  return 'narrow'
}

export function lyricLayoutDrawers(mode: LyricLayoutMode): { left: boolean; right: boolean } {
  return { left: mode === 'laptop' || mode === 'narrow', right: mode === 'narrow' }
}

/** Tracks the element's width and resolves it to a layout mode. */
export function useLyricLayoutMode(ref: RefObject<HTMLElement | null>): LyricLayoutMode {
  const [mode, setMode] = useState<LyricLayoutMode>('wide')

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setMode(resolveLyricLayoutMode(element.getBoundingClientRect().width))
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return mode
}
