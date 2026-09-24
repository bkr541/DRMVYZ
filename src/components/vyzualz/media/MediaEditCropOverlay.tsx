import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { dragCropRect, type CropHandle, type MediaEditCrop } from '../../../features/media/edit/mediaEditModel'

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const NUDGE = 0.01
const NUDGE_LARGE = 0.05

interface MediaEditCropOverlayProps {
  /** The preview canvas the overlay must sit exactly on top of. */
  targetRef: RefObject<HTMLElement>
  /** The crop rectangle in the oriented full frame, normalized 0..1. */
  rect: MediaEditCrop
  onChange: (rect: MediaEditCrop) => void
  onApply: () => void
  onCancel: () => void
}

interface Box { left: number; top: number; width: number; height: number }

/** Tracks the target's box relative to the overlay's own positioned parent. */
function useTargetBox(targetRef: RefObject<HTMLElement>, rootRef: RefObject<HTMLElement>): Box | null {
  const [box, setBox] = useState<Box | null>(null)
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

/** Draggable crop rectangle with eight handles, drawn over the oriented preview. */
export function MediaEditCropOverlay({ targetRef, rect, onChange, onApply, onCancel }: MediaEditCropOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const box = useTargetBox(targetRef, rootRef)
  const dragRef = useRef<{ handle: CropHandle; startX: number; startY: number; start: MediaEditCrop } | null>(null)

  const beginDrag = (handle: CropHandle) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { handle, startX: event.clientX, startY: event.clientY, start: rect }
  }
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || !box || box.width <= 0 || box.height <= 0) return
    onChange(dragCropRect(drag.start, drag.handle, (event.clientX - drag.startX) / box.width, (event.clientY - drag.startY) / box.height))
  }
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current) event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
    if (event.key === 'Enter') { event.preventDefault(); onApply(); return }
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const move = delta[event.key]
    if (!move) return
    event.preventDefault()
    // Alt resizes from the bottom-right corner; plain arrows move the whole rectangle.
    onChange(dragCropRect(rect, event.altKey ? 'se' : 'move', move[0], move[1]))
  }

  return (
    <div ref={rootRef} className="mmec-root" aria-hidden={box ? undefined : true}>
      {box && (
        <div className="mmec-frame" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
          <div
            className="mmec-rect"
            role="group"
            tabIndex={0}
            aria-label="Crop area. Arrow keys move it, Alt plus arrows resize it, Enter applies, Escape cancels."
            data-testid="crop-rect"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
            }}
            onPointerDown={beginDrag('move')}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
          >
            {HANDLES.map(handle => (
              <span
                key={handle}
                className={`mmec-handle mmec-handle--${handle}`}
                data-handle={handle}
                onPointerDown={beginDrag(handle)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
