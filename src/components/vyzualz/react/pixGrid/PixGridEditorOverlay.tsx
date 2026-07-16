import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import {
  applyPixGridPoints,
  createPixGridSelection,
  deletePixGridLayer,
  fillPixGridRegion,
  movePixGridSelection,
  pixGridCellRectToView,
  pixGridLinePoints,
  pixGridRectanglePoints,
  pixGridViewPointToCell,
  resolvePixGridOutputRect,
  type PixGridCellPoint,
} from './PixGridAuthoring'
import type { PixGridEditorTool, PixGridState } from './PixGridTypes'

interface PointerOperation {
  pointerId: number
  start: PixGridCellPoint
  last: PixGridCellPoint
  startClientX: number
  startClientY: number
  basePanX: number
  basePanY: number
  tool: PixGridEditorTool
}

const TOOL_LABELS: Array<{ tool: PixGridEditorTool; label: string; shortcut?: string }> = [
  { tool: 'select', label: 'Select' },
  { tool: 'pan', label: 'Pan' },
  { tool: 'pencil', label: 'Pencil' },
  { tool: 'eraser', label: 'Eraser' },
  { tool: 'fill', label: 'Fill' },
  { tool: 'eyedropper', label: 'Pick' },
  { tool: 'rectangle', label: 'Rect' },
  { tool: 'line', label: 'Line' },
  { tool: 'marquee', label: 'Marquee' },
  { tool: 'move', label: 'Move' },
]

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.isContentEditable || element?.closest('input, textarea, select, [contenteditable="true"]'))
}

function editFor(state: PixGridState) {
  if (state.editorTool === 'eraser') return state.editor.eraserMode === 'restore' ? { kind: 'restore' as const } : { kind: 'off' as const }
  return { kind: 'paint' as const, color: state.editor.paintColor, opacity: state.editor.paintOpacity }
}

function selectionPoints(state: PixGridState): PixGridCellPoint[] {
  const selection = state.editor.selection
  if (!selection) return []
  const points: PixGridCellPoint[] = []
  for (let y = selection.y; y < selection.y + selection.height; y += 1) {
    for (let x = selection.x; x < selection.x + selection.width; x += 1) points.push({ x, y })
  }
  return points
}


export function shouldShowPixGridEditorOverlay(activeEngineId: string, authoringOverlayVisible: boolean): boolean {
  return activeEngineId === 'pixGrid' && authoringOverlayVisible
}

export function PixGridEditorOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const operationRef = useRef<PointerOperation | null>(null)
  const previewEndRef = useRef<PixGridCellPoint | null>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const beginHistory = useReactStore(store => store.beginPixGridHistoryTransaction)
  const commitHistory = useReactStore(store => store.commitPixGridHistoryTransaction)
  const cancelHistory = useReactStore(store => store.cancelPixGridHistoryTransaction)
  const undo = useReactStore(store => store.undoPixGridEdit)
  const redo = useReactStore(store => store.redoPixGridEdit)

  const viewport = useCallback((current: PixGridState = useReactStore.getState().pixGridState) => ({
    viewportWidth: size.width,
    viewportHeight: size.height,
    matrixWidth: current.matrixWidth,
    matrixHeight: current.matrixHeight,
    zoom: current.editor.zoom,
    panX: current.editor.panX,
    panY: current.editor.panY,
  }), [size])

  const updateEditor = useCallback((patch: Partial<PixGridState['editor']>) => {
    const current = useReactStore.getState().pixGridState
    setState({ editor: { ...current.editor, ...patch } })
  }, [setState])

  const pointFromEvent = useCallback((event: React.PointerEvent<HTMLCanvasElement>, clamp = false) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return pixGridViewPointToCell(event.clientX - rect.left, event.clientY - rect.top, viewport(), clamp)
  }, [viewport])

  useEffect(() => () => {
    if (operationRef.current) cancelHistory()
  }, [cancelHistory])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
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
    if (!canvas) return
    let animationFrame = 0
    const draw = () => {
      const current = useReactStore.getState().pixGridState
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
      const output = resolvePixGridOutputRect(viewport(current))
      const source = canvas.parentElement?.querySelector<HTMLCanvasElement>('.rv-pix-grid-surface-host canvas:not([hidden])')
      context.save()
      context.fillStyle = 'rgba(0,0,0,0.35)'
      context.fillRect(0, 0, size.width, size.height)
      context.beginPath()
      context.rect(output.left, output.top, output.width, output.height)
      context.clip()
      if (source) context.drawImage(source, output.left, output.top, output.width, output.height)
      context.restore()
      context.strokeStyle = 'rgba(74,199,219,0.9)'
      context.lineWidth = 1
      context.strokeRect(output.left + 0.5, output.top + 0.5, output.width - 1, output.height - 1)

      if (current.editor.guidesVisible) {
        const cellWidth = output.width / current.matrixWidth
        const cellHeight = output.height / current.matrixHeight
        const every = current.editor.zoom >= 3 ? 1 : current.editor.zoom >= 1.5 ? 2 : current.editor.zoom >= 0.8 ? 5 : 10
        context.strokeStyle = 'rgba(74,199,219,0.18)'
        context.lineWidth = 0.5
        context.beginPath()
        for (let x = 0; x <= current.matrixWidth; x += every) {
          const px = output.left + x * cellWidth
          context.moveTo(px, output.top)
          context.lineTo(px, output.top + output.height)
        }
        for (let y = 0; y <= current.matrixHeight; y += every) {
          const py = output.top + y * cellHeight
          context.moveTo(output.left, py)
          context.lineTo(output.left + output.width, py)
        }
        context.stroke()
      }

      if (current.editor.selection) {
        const selection = pixGridCellRectToView(current.editor.selection, viewport(current))
        context.fillStyle = 'rgba(74,199,219,0.12)'
        context.strokeStyle = 'rgba(255,255,255,0.95)'
        context.setLineDash([5, 3])
        context.fillRect(selection.left, selection.top, selection.width, selection.height)
        context.strokeRect(selection.left + 0.5, selection.top + 0.5, selection.width - 1, selection.height - 1)
        context.setLineDash([])
      }

      const operation = operationRef.current
      const previewEnd = previewEndRef.current
      if (operation && previewEnd && (operation.tool === 'line' || operation.tool === 'rectangle' || operation.tool === 'marquee')) {
        const selection = pixGridCellRectToView(createPixGridSelection(operation.start, previewEnd), viewport(current))
        context.strokeStyle = 'rgba(255,255,255,0.95)'
        context.setLineDash([4, 3])
        context.strokeRect(selection.left + 0.5, selection.top + 0.5, selection.width - 1, selection.height - 1)
        context.setLineDash([])
      }
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [size, viewport])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const current = useReactStore.getState().pixGridState
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (event.key === 'Escape') {
        if (operationRef.current) {
          cancelHistory()
          operationRef.current = null
          previewEndRef.current = null
        } else updateEditor({ selection: null })
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        const points = selectionPoints(current)
        if (points.length > 0) {
          beginHistory()
          applyState(applyPixGridPoints(current, points, { kind: 'restore' }))
          commitHistory()
        } else if (current.editor.selectedLayerId) {
          applyState(deletePixGridLayer(current, current.editor.selectedLayerId))
        }
        return
      }
      if (current.editor.selection && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
        const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
        applyState(movePixGridSelection(current, current.editor.selection, dx, dy))
      }
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [applyState, beginHistory, cancelHistory, commitHistory, redo, undo, updateEditor])

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = useReactStore.getState().pixGridState
    const point = pointFromEvent(event, current.editorTool === 'pan')
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)

    if (current.editorTool === 'fill') {
      beginHistory()
      applyState(fillPixGridRegion(current, point, editFor({ ...current, editorTool: 'pencil' })))
      commitHistory()
      return
    }
    if (current.editorTool === 'eyedropper') {
      const source = event.currentTarget.parentElement?.querySelector<HTMLCanvasElement>('.rv-pix-grid-surface-host canvas:not([hidden])')
      if (source) {
        const sample = document.createElement('canvas')
        sample.width = 1
        sample.height = 1
        const context = sample.getContext('2d')
        if (context) {
          context.drawImage(source, point.x / current.matrixWidth * source.width, point.y / current.matrixHeight * source.height, Math.max(1, source.width / current.matrixWidth), Math.max(1, source.height / current.matrixHeight), 0, 0, 1, 1)
          const pixel = context.getImageData(0, 0, 1, 1).data
          updateEditor({ paintColor: `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, '0')).join('')}` })
        }
      }
      return
    }

    operationRef.current = {
      pointerId: event.pointerId,
      start: point,
      last: point,
      startClientX: event.clientX,
      startClientY: event.clientY,
      basePanX: current.editor.panX,
      basePanY: current.editor.panY,
      tool: current.editorTool,
    }
    previewEndRef.current = point
    if (current.editorTool === 'pencil' || current.editorTool === 'eraser') {
      beginHistory()
      applyState(applyPixGridPoints(current, [point], editFor(current)))
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const operation = operationRef.current
    if (!operation || operation.pointerId !== event.pointerId) return
    const current = useReactStore.getState().pixGridState
    if (operation.tool === 'pan') {
      const output = resolvePixGridOutputRect(viewport(current))
      updateEditor({
        panX: operation.basePanX + (event.clientX - operation.startClientX) / Math.max(1, output.width),
        panY: operation.basePanY + (event.clientY - operation.startClientY) / Math.max(1, output.height),
      })
      return
    }
    const point = pointFromEvent(event)
    if (!point) return
    previewEndRef.current = point
    if (operation.tool === 'pencil' || operation.tool === 'eraser') {
      if (point.x === operation.last.x && point.y === operation.last.y) return
      applyState(applyPixGridPoints(current, pixGridLinePoints(operation.last, point), editFor(current)))
      operation.last = point
    }
  }

  const cancelPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const operation = operationRef.current
    if (!operation || operation.pointerId !== event.pointerId) return
    if (operation.tool === 'pencil' || operation.tool === 'eraser') cancelHistory()
    operationRef.current = null
    previewEndRef.current = null
  }

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const operation = operationRef.current
    if (!operation || operation.pointerId !== event.pointerId) return
    const current = useReactStore.getState().pixGridState
    const end = previewEndRef.current ?? operation.last
    if (operation.tool === 'pencil' || operation.tool === 'eraser') commitHistory()
    else if (operation.tool === 'line') {
      beginHistory()
      applyState(applyPixGridPoints(current, pixGridLinePoints(operation.start, end), editFor({ ...current, editorTool: 'pencil' })))
      commitHistory()
    } else if (operation.tool === 'rectangle') {
      beginHistory()
      applyState(applyPixGridPoints(current, pixGridRectanglePoints(operation.start, end), editFor({ ...current, editorTool: 'pencil' })))
      commitHistory()
    } else if (operation.tool === 'marquee' || operation.tool === 'select') {
      updateEditor({ selection: createPixGridSelection(operation.start, end) })
    } else if (operation.tool === 'move' && current.editor.selection) {
      applyState(movePixGridSelection(current, current.editor.selection, end.x - operation.start.x, end.y - operation.start.y))
    }
    operationRef.current = null
    previewEndRef.current = null
  }

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const current = useReactStore.getState().pixGridState
    updateEditor({ zoom: Math.max(0.25, Math.min(16, current.editor.zoom * Math.exp(-event.deltaY * 0.0015))) })
  }

  return (
    <div className="rv-pix-grid-editor-overlay" data-testid="pix-grid-editor-overlay">
      <div className="rv-pix-grid-editor-toolbar" role="toolbar" aria-label="PixGrid editor tools">
        {TOOL_LABELS.map(item => (
          <button
            key={item.tool}
            type="button"
            className={state.editorTool === item.tool ? 'is-active' : ''}
            aria-pressed={state.editorTool === item.tool}
            onClick={() => setState({ editorTool: item.tool })}
          >
            {item.label}
          </button>
        ))}
        <span className="rv-pix-grid-editor-zoom">{Math.round(state.editor.zoom * 100)}%</span>
      </div>
      <canvas
        ref={canvasRef}
        className="rv-pix-grid-editor-canvas"
        aria-label="PixGrid logical cell editor"
        data-interactive-cell-count="0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={cancelPointer}
        onWheel={onWheel}
      />
    </div>
  )
}
