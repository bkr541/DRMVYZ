import { useEffect, useRef, type ElementType, type ReactNode } from 'react'
import './PageHeadingPlate.css'

// The page heading used by the top header row of React, Media Manager, Lyric
// Manager and Show Manager: the "Scan Plate" style from Layout Lab → Template
// (angled HUD plate with corner brackets, icon tag, gradient title and a ticked
// rule). The group is sized so its right edge lines up flush with the right
// edge of the page's left window; it measures that rail live, so collapsing or
// resizing the rail keeps them aligned.

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function ReactHeadingIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />
      <path d="M12 8l4 4-4 4-4-4z" />
    </svg>
  )
}

export function MediaHeadingIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M3 15.5l4.6-4.4 3.6 3.4 3-2.8L21 16" />
      <circle cx="16.5" cy="9" r="1.5" />
    </svg>
  )
}

export function LyricHeadingIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 6.5h9M4 11h6M4 15.5h5" />
      <path d="M17 5v10.2" />
      <ellipse cx="14.8" cy="16.2" rx="2.3" ry="1.8" />
      <path d="M17 5c1.6.3 3 1.2 3.4 3" />
    </svg>
  )
}

export function ShowHeadingIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="4" width="7.5" height="7.5" rx="1.6" />
      <rect x="13" y="4" width="7.5" height="7.5" rx="1.6" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.6" />
      <path d="M13 17h7.5M16.75 13.5v7" />
    </svg>
  )
}

const LEFT_RAIL_SELECTOR = '.vz-inspector--left, .rw-frame--left'
const MIN_PLATE_WIDTH = 280
const HEADER_SELECTOR = '.vz-header, .mmv-header, .lmv-header, .sm-topbar'

type PageHeadingPlateProps = {
  title: ReactNode
  icon: ReactNode
  /** Element for the title text (h1 where the page labels itself by it). Defaults to span. */
  titleAs?: ElementType
  titleId?: string
  className?: string
}

export function PageHeadingPlate({ title, icon, titleAs: Title = 'span', titleId, className = '' }: PageHeadingPlateProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const plate = ref.current
    const header = plate?.closest<HTMLElement>(HEADER_SELECTOR)
    const page = header?.parentElement
    if (!plate || !header || !page) return

    let frame = 0
    const update = () => {
      frame = 0
      const rail = page.querySelector<HTMLElement>(LEFT_RAIL_SELECTOR)
      if (!rail) { plate.style.removeProperty('--vz-page-heading-width'); return }
      const width = rail.getBoundingClientRect().right - header.getBoundingClientRect().left
      // A collapsed rail is too narrow to hold the plate, so the plate keeps a minimum width there.
      plate.style.setProperty('--vz-page-heading-width', `${Math.max(MIN_PLATE_WIDTH, Math.round(width))}px`)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }

    update()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resizeObserver?.observe(page)
    const rail = page.querySelector<HTMLElement>(LEFT_RAIL_SELECTOR)
    if (rail) resizeObserver?.observe(rail)
    // Pages swap or mount their left rail after first paint (mode changes, lazy panels).
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule)
    mutationObserver?.observe(page, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <div ref={ref} className={`vz-page-heading${className ? ` ${className}` : ''}`}>
      <span className="vz-page-heading-corner vz-page-heading-corner--tl" aria-hidden="true" />
      <span className="vz-page-heading-corner vz-page-heading-corner--bl" aria-hidden="true" />
      <div className="vz-page-heading-plate">
        <span className="vz-page-heading-icon" aria-hidden="true">{icon}</span>
        <Title id={titleId} className="vz-page-heading-title">{title}</Title>
        <span className="vz-page-heading-sweep" aria-hidden="true" />
      </div>
      <span className="vz-page-heading-rule" aria-hidden="true" />
    </div>
  )
}
