import { useEffect, useRef, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { resolvePixGridOutputRect } from './PixGridAuthoring'
import {
  isPixGridSemanticTargetActive,
  resolvePixGridSemanticTargetCells,
} from './PixGridSemanticTarget'

export interface PixGridSemanticTargetOverlayProps {
  signFrameIndex: number | null
}

export function PixGridSemanticTargetOverlay({ signFrameIndex }: PixGridSemanticTargetOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const state = useReactStore(store => store.pixGridState)
  const active = isPixGridSemanticTargetActive(state)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) })
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(size.width * dpr))
    const height = Math.max(1, Math.round(size.height * dpr))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size.width, size.height)

    const output = resolvePixGridOutputRect({
      viewportWidth: size.width,
      viewportHeight: size.height,
      matrixWidth: state.matrixWidth,
      matrixHeight: state.matrixHeight,
      zoom: state.editor.zoom,
      panX: state.editor.panX,
      panY: state.editor.panY,
    })
    const cells = resolvePixGridSemanticTargetCells(state, signFrameIndex ?? 0)
    const cellWidth = output.width / state.matrixWidth
    const cellHeight = output.height / state.matrixHeight

    context.save()
    context.beginPath()
    context.rect(output.left, output.top, output.width, output.height)
    context.clip()
    context.fillStyle = 'rgba(0, 0, 0, 0.28)'
    context.fillRect(output.left, output.top, output.width, output.height)
    context.fillStyle = 'rgba(74, 199, 219, 0.48)'
    context.strokeStyle = 'rgba(255, 255, 255, 0.92)'
    context.lineWidth = Math.max(0.5, Math.min(1.5, Math.min(cellWidth, cellHeight) * 0.2))
    for (const cell of cells) {
      const left = output.left + cell.x * cellWidth
      const top = output.top + cell.y * cellHeight
      context.fillRect(left, top, cellWidth, cellHeight)
      if (cellWidth >= 3 && cellHeight >= 3) context.strokeRect(left + 0.5, top + 0.5, cellWidth - 1, cellHeight - 1)
    }
    context.restore()

    const selectedLayer = state.layers.find(layer => layer.id === state.editor.selectedLayerId)
    const label = selectedLayer ? `${selectedLayer.name} · ${cells.length.toLocaleString()} cells` : 'Semantic target'
    context.font = '12px sans-serif'
    const labelWidth = Math.min(output.width - 16, Math.max(150, context.measureText(label).width + 20))
    context.fillStyle = 'rgba(0, 0, 0, 0.82)'
    context.fillRect(output.left + 8, output.top + 8, labelWidth, 24)
    context.fillStyle = '#ffffff'
    context.fillText(label, output.left + 18, output.top + 24, Math.max(20, labelWidth - 20))
  }, [active, signFrameIndex, size, state])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      className="rv-pix-grid-semantic-target-overlay"
      aria-label="Selected PixGrid semantic component cells"
      data-testid="pix-grid-semantic-target-overlay"
      data-sign-frame={signFrameIndex ?? 0}
    />
  )
}
