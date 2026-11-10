import { useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { FrameCadence } from '../../../../lib/frameCadence'
import './CastPreviewWindow.css'

interface CastPreviewWindowProps {
  id: string
  anchor: HTMLButtonElement | null
  sourceRef: MutableRefObject<HTMLCanvasElement | null>
  onClose: () => void
}

export function CastPreviewWindow({ id, anchor, sourceRef, onClose }: CastPreviewWindowProps) {
  const windowRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [bounds, setBounds] = useState({ left: 8, top: 8, width: 280, height: 176 })
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const movedRef = useRef(false)

  useLayoutEffect(() => {
    const engine = anchor?.closest('.rv-shell')?.querySelector<HTMLElement>('.rv-engine-dropdown-trigger')
    const position = () => {
      const card = engine?.getBoundingClientRect()
      const trigger = anchor?.getBoundingClientRect()
      const width = Math.max(1, Math.min(card?.width || 280, window.innerWidth - 16))
      const height = Math.max(1, Math.min((card?.height || 88) * 2, window.innerHeight - 16))
      setBounds(previous => ({ width, height,
        left: Math.max(8, Math.min(movedRef.current ? previous.left : (trigger?.right ?? width + 8) - width, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(movedRef.current ? previous.top : (trigger?.top ?? height + 16) - height - 8, window.innerHeight - height - 8)),
      }))
    }
    position()
    windowRef.current?.focus({ preventScroll: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    if (engine) observer?.observe(engine)
    window.addEventListener('resize', position)
    return () => { observer?.disconnect(); window.removeEventListener('resize', position) }
  }, [anchor])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: false })
    if (!canvas || !context) return
    const cadence = new FrameCadence(30)
    let frame = 0
    const draw = (now: number) => {
      if (cadence.due(now) && !document.hidden) {
        const source = sourceRef.current
        context.fillStyle = '#000'
        context.fillRect(0, 0, canvas.width, canvas.height)
        if (source && source.width > 0 && source.height > 0) {
          const scale = Math.min(canvas.width / source.width, canvas.height / source.height)
          const width = source.width * scale
          const height = source.height * scale
          try {
            context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
          } catch { /* A monitor must never interrupt the cast during a relay handoff. */ }
        }
      }
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [sourceRef])

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    movedRef.current = true
    setBounds(previous => ({ ...previous,
      left: Math.max(8, Math.min(drag.left + event.clientX - drag.x, window.innerWidth - previous.width - 8)),
      top: Math.max(8, Math.min(drag.top + event.clientY - drag.y, window.innerHeight - previous.height - 8)),
    }))
  }

  return createPortal(
    <section ref={windowRef} tabIndex={-1} id={id} role="dialog" aria-modal="false" aria-label="Cast preview" className="rv-cast-preview-window"
      style={bounds} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      }}>
      <header className="rw-window-header rv-cast-preview-header" onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
        <AppIcon kind="monitor" />
        <span>Cast preview</span>
        <button type="button" className="rv-cast-trigger" aria-label="Close cast preview" title="Close cast preview" onClick={onClose}>
          <AppIcon kind="close" />
        </button>
      </header>
      <canvas ref={canvasRef} width={Math.max(1, Math.round(bounds.width - 2))} height={Math.max(1, Math.round(bounds.height - 34))}
        aria-label="Current cast visual" className="rv-cast-preview-canvas" />
    </section>, document.body,
  )
}
