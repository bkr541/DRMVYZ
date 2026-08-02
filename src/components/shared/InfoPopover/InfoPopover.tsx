import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import './InfoPopover.css'

const DEFAULT_WIDTH = 360
const DEFAULT_MAX_HEIGHT = 560
const DEFAULT_OFFSET = 12
const DEFAULT_VIEWPORT_PADDING = 12
const MIN_ARROW_OFFSET = 20

export type InfoPopoverPlacement = 'auto' | 'right' | 'left' | 'above' | 'below'
export type InfoPopoverAlignment = 'start' | 'center' | 'end'
export type InfoPopoverTone = 'default' | 'accent' | 'success' | 'warning'

type ResolvedPlacement = Exclude<InfoPopoverPlacement, 'auto'>

export interface InfoPopoverSection {
  label: ReactNode
  content: ReactNode
  icon?: ReactNode
  tone?: InfoPopoverTone
  className?: string
}

export interface InfoPopoverProps {
  id?: string
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  title: ReactNode
  description?: ReactNode
  sections?: readonly InfoPopoverSection[]
  children?: ReactNode
  footer?: ReactNode
  placement?: InfoPopoverPlacement
  align?: InfoPopoverAlignment
  width?: number
  maxHeight?: number
  offset?: number
  viewportPadding?: number
  closeLabel?: string
  dismissOnOutsidePress?: boolean
  restoreFocusOnClose?: boolean
  className?: string
  onOpenChange?: (open: boolean) => void
}

interface PopoverPosition {
  left: number
  top: number
  width: number
  maxHeight: number
  placement: ResolvedPlacement
  arrowOffset: number
}

function normalizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum
  return Math.max(minimum, Math.min(value, maximum))
}

function alignedCoordinate(
  anchorStart: number,
  anchorEnd: number,
  floatingSize: number,
  align: InfoPopoverAlignment,
): number {
  if (align === 'start') return anchorStart
  if (align === 'end') return anchorEnd - floatingSize
  return anchorStart + (anchorEnd - anchorStart - floatingSize) / 2
}

function resolvePlacement(
  requested: InfoPopoverPlacement,
  anchor: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  offset: number,
  viewportPadding: number,
): ResolvedPlacement {
  if (requested !== 'auto') return requested

  const available: Record<ResolvedPlacement, number> = {
    right: viewportWidth - viewportPadding - anchor.right - offset,
    left: anchor.left - viewportPadding - offset,
    below: viewportHeight - viewportPadding - anchor.bottom - offset,
    above: anchor.top - viewportPadding - offset,
  }

  const required: Record<ResolvedPlacement, number> = {
    right: popoverWidth,
    left: popoverWidth,
    below: popoverHeight,
    above: popoverHeight,
  }

  const preferredOrder: readonly ResolvedPlacement[] = ['right', 'left', 'below', 'above']
  const fittingPlacement = preferredOrder.find(candidate => available[candidate] >= required[candidate])
  if (fittingPlacement) return fittingPlacement

  return preferredOrder.reduce((best, candidate) => {
    const bestRatio = available[best] / Math.max(required[best], 1)
    const candidateRatio = available[candidate] / Math.max(required[candidate], 1)
    return candidateRatio > bestRatio ? candidate : best
  }, preferredOrder[0])
}

export function InfoPopover({
  id,
  open,
  anchorRef,
  title,
  description,
  sections = [],
  children,
  footer,
  placement = 'auto',
  align = 'center',
  width = DEFAULT_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  offset = DEFAULT_OFFSET,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  closeLabel = 'Close information',
  dismissOnOutsidePress = true,
  restoreFocusOnClose = true,
  className = '',
  onOpenChange,
}: InfoPopoverProps) {
  const generatedId = normalizeIdPart(useId())
  const baseId = id ?? `drm-info-popover-${generatedId}`
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`

  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  const requestClose = useCallback((restoreFocus: boolean) => {
    onOpenChange?.(false)
    if (restoreFocus && restoreFocusOnClose) {
      window.requestAnimationFrame(() => anchorRef.current?.focus())
    }
  }, [anchorRef, onOpenChange, restoreFocusOnClose])

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const popover = popoverRef.current
    if (!anchor || !popover || typeof window === 'undefined') return

    const anchorRect = anchor.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const viewportOffsetLeft = window.visualViewport?.offsetLeft ?? 0
    const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0
    const availableViewportWidth = Math.max(0, viewportWidth - viewportPadding * 2)
    const availableViewportHeight = Math.max(0, viewportHeight - viewportPadding * 2)
    const resolvedWidth = Math.min(width, availableViewportWidth)
    const measuredHeight = popover.scrollHeight || popoverRect.height || maxHeight
    const resolvedMaxHeight = Math.min(maxHeight, availableViewportHeight)
    const resolvedHeight = Math.min(measuredHeight, resolvedMaxHeight)
    const resolvedPlacement = resolvePlacement(
      placement,
      anchorRect,
      resolvedWidth,
      resolvedHeight,
      viewportWidth,
      viewportHeight,
      offset,
      viewportPadding,
    )

    let left = 0
    let top = 0

    if (resolvedPlacement === 'right' || resolvedPlacement === 'left') {
      left = resolvedPlacement === 'right'
        ? anchorRect.right + offset
        : anchorRect.left - offset - resolvedWidth
      top = alignedCoordinate(anchorRect.top, anchorRect.bottom, resolvedHeight, align)
    } else {
      top = resolvedPlacement === 'below'
        ? anchorRect.bottom + offset
        : anchorRect.top - offset - resolvedHeight
      left = alignedCoordinate(anchorRect.left, anchorRect.right, resolvedWidth, align)
    }

    const minimumLeft = viewportOffsetLeft + viewportPadding
    const maximumLeft = viewportOffsetLeft + viewportWidth - viewportPadding - resolvedWidth
    const minimumTop = viewportOffsetTop + viewportPadding
    const maximumTop = viewportOffsetTop + viewportHeight - viewportPadding - resolvedHeight
    left = clamp(left, minimumLeft, maximumLeft)
    top = clamp(top, minimumTop, maximumTop)

    const anchorCenterX = anchorRect.left + anchorRect.width / 2
    const anchorCenterY = anchorRect.top + anchorRect.height / 2
    const arrowAxisSize = resolvedPlacement === 'right' || resolvedPlacement === 'left'
      ? resolvedHeight
      : resolvedWidth
    const requestedArrowOffset = resolvedPlacement === 'right' || resolvedPlacement === 'left'
      ? anchorCenterY - top
      : anchorCenterX - left
    const arrowOffset = clamp(
      requestedArrowOffset,
      MIN_ARROW_OFFSET,
      Math.max(MIN_ARROW_OFFSET, arrowAxisSize - MIN_ARROW_OFFSET),
    )

    const nextPosition: PopoverPosition = {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(resolvedWidth),
      maxHeight: Math.round(resolvedMaxHeight),
      placement: resolvedPlacement,
      arrowOffset: Math.round(arrowOffset),
    }

    setPosition(current => {
      if (
        current
        && current.left === nextPosition.left
        && current.top === nextPosition.top
        && current.width === nextPosition.width
        && current.maxHeight === nextPosition.maxHeight
        && current.placement === nextPosition.placement
        && current.arrowOffset === nextPosition.arrowOffset
      ) {
        return current
      }
      return nextPosition
    })
  }, [align, anchorRef, maxHeight, offset, placement, viewportPadding, width])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }

    updatePosition()

    const handleViewportChange = () => updatePosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleViewportChange)
    if (anchorRef.current) resizeObserver?.observe(anchorRef.current)
    if (popoverRef.current) resizeObserver?.observe(popoverRef.current)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
      resizeObserver?.disconnect()
    }
  }, [anchorRef, open, sections, updatePosition])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      requestClose(true)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!dismissOnOutsidePress) return
      const target = event.target instanceof Node ? event.target : null
      if (!target) return
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      requestClose(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [anchorRef, dismissOnOutsidePress, open, requestClose])

  if (!open || typeof document === 'undefined') return null

  const popoverClassName = [
    'drm-info-popover',
    className,
  ].filter(Boolean).join(' ')
  const popoverStyle = {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    width: position?.width ?? Math.min(width, Math.max(0, window.innerWidth - viewportPadding * 2)),
    maxHeight: position?.maxHeight ?? maxHeight,
    visibility: position ? 'visible' : 'hidden',
    '--drm-info-arrow-offset': `${position?.arrowOffset ?? MIN_ARROW_OFFSET}px`,
  } as CSSProperties

  return createPortal((
    <>
      <div className="drm-info-popover-backdrop" aria-hidden="true" />
    <div
      ref={popoverRef}
      id={baseId}
      className={popoverClassName}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={description != null ? descriptionId : undefined}
      data-placement={position?.placement ?? 'right'}
      style={popoverStyle}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="drm-info-popover__header">
        <div className="drm-info-popover__heading-copy">
          <h3 id={titleId} className="drm-info-popover__title">{title}</h3>
          {description != null && (
            <div id={descriptionId} className="drm-info-popover__description">
              {description}
            </div>
          )}
        </div>

        <button
          type="button"
          className="drm-info-popover__close"
          aria-label={closeLabel}
          onClick={() => requestClose(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {(sections.length > 0 || children != null) && (
        <div className="drm-info-popover__body">
          {sections.map((section, index) => {
            const sectionClassName = [
              'drm-info-popover__section',
              section.icon != null ? 'drm-info-popover__section--with-icon' : '',
              section.className ?? '',
            ].filter(Boolean).join(' ')

            return (
              <section
                key={index}
                className={sectionClassName}
                data-tone={section.tone ?? 'default'}
              >
                {section.icon != null && (
                  <span className="drm-info-popover__section-icon" aria-hidden="true">
                    {section.icon}
                  </span>
                )}
                <div className="drm-info-popover__section-copy">
                  <div className="drm-info-popover__section-label">{section.label}</div>
                  <div className="drm-info-popover__section-content">{section.content}</div>
                </div>
              </section>
            )
          })}
          {children}
        </div>
      )}

      {footer != null && (
        <div className="drm-info-popover__footer">{footer}</div>
      )}
    </div>
    </>
  ), document.body)
}
