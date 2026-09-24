import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import './TopEdgeResizeHandle.css'

export interface TopEdgeResizeHandleProps {
  label: string
  value: number
  min: number
  max: number
  keyboardStep?: number
  getStartValue: () => number
  onChange: (next: number) => void
}

/**
 * Row-resize splitter that sits on the top edge of a bottom-anchored panel.
 * Dragging up grows the panel, dragging down shrinks it (same behavior as the
 * Lyric Manager Lyric Management / Diagnostics windows).
 */
export function TopEdgeResizeHandle({
  label,
  value,
  min,
  max,
  keyboardStep = 12,
  getStartValue,
  onChange,
}: TopEdgeResizeHandleProps) {
  const cleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanupRef.current?.(), [])

  const clamp = (next: number) => Math.max(min, Math.min(max, next))

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    cleanupRef.current?.()
    const handle = event.currentTarget
    const startY = event.clientY
    const startValue = getStartValue()
    const ownerWindow = handle.ownerDocument.defaultView ?? window
    handle.dataset.dragging = 'true'
    const onMove = (moveEvent: globalThis.PointerEvent) => onChange(clamp(startValue - (moveEvent.clientY - startY)))
    const stop = () => {
      ownerWindow.removeEventListener('pointermove', onMove)
      ownerWindow.removeEventListener('pointerup', stop)
      ownerWindow.removeEventListener('pointercancel', stop)
      delete handle.dataset.dragging
      cleanupRef.current = null
    }
    ownerWindow.addEventListener('pointermove', onMove)
    ownerWindow.addEventListener('pointerup', stop)
    ownerWindow.addEventListener('pointercancel', stop)
    cleanupRef.current = stop
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const base = getStartValue()
    onChange(clamp(base + (event.key === 'ArrowUp' ? keyboardStep : -keyboardStep)))
  }

  return (
    <div
      className="drm-top-edge-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  )
}
