import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import {
  applyPixGridPoints,
  createPixGridSelection,
  deletePixGridLayer,
  fillPixGridRegion,
  getPixGridActiveLayers,
  getPixGridActiveScene,
  movePixGridSelection,
  pixGridCellRectToView,
  pixGridLinePoints,
  pixGridRectanglePoints,
  pixGridViewPointToCell,
  resolvePixGridOutputRect,
  selectPixGridScene,
  type PixGridCellPoint,
} from './PixGridAuthoring'
import type { PixGridEditorTool, PixGridState } from './PixGridTypes'
import { activePixGridGroups, compilePixGridGroupMask } from './PixGridGroups'
import { samplePixGridCanvasColor } from './PixGridLiveCanvas'
import { DropdownSelect } from '../../../shared/Dropdown/Dropdown'
import { isKeyboardInputTarget } from '../../../../utils/keyboardTargets'

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

interface ToolDefinition {
  tool: PixGridEditorTool
  label: string
  shortcut: string
  description: string
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  { tool: 'select', label: 'Select', shortcut: 'V', description: 'Drag to select a rectangular cell area.' },
  { tool: 'pan', label: 'Pan', shortcut: 'H', description: 'Drag the canvas without changing pixels.' },
  { tool: 'pencil', label: 'Pencil', shortcut: 'P', description: 'Draw cells with the active color.' },
  { tool: 'eraser', label: 'Eraser', shortcut: 'E', description: 'Clear cells or restore inherited artwork.' },
  { tool: 'fill', label: 'Fill', shortcut: 'F', description: 'Fill a connected region with the active color.' },
  { tool: 'eyedropper', label: 'Eyedropper', shortcut: 'I', description: 'Sample a color from the live PixGrid output.' },
  { tool: 'rectangle', label: 'Rectangle', shortcut: 'R', description: 'Drag to draw a rectangle outline.' },
  { tool: 'line', label: 'Line', shortcut: 'L', description: 'Drag to draw a straight line.' },
  { tool: 'marquee', label: 'Marquee', shortcut: 'M', description: 'Drag to create a cell selection.' },
  { tool: 'move', label: 'Move', shortcut: 'G', description: 'Drag the active selection to a new location.' },
]

const TOOL_BY_SHORTCUT = new Map(TOOL_DEFINITIONS.map(definition => [definition.shortcut.toLowerCase(), definition.tool]))
const PIXEL_EDIT_TOOLS = new Set<PixGridEditorTool>(['pencil', 'eraser', 'fill', 'rectangle', 'line', 'move'])

function isTypingTarget(target: EventTarget | null): boolean {
  return isKeyboardInputTarget(target)
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

function resolveToolDisabledReason(
  tool: PixGridEditorTool,
  state: PixGridState,
  liveCanvas: HTMLCanvasElement | null,
  targetLayer: ReturnType<typeof getPixGridActiveLayers>[number] | null,
): string | null {
  if (tool === 'eyedropper' && !liveCanvas) return 'Live PixGrid output is unavailable.'
  if (tool === 'move' && !state.editor.selection) return 'Create a selection before using Move.'
  if (!PIXEL_EDIT_TOOLS.has(tool)) return null
  if (state.editor.selectedLayerId === null) return null
  if (!targetLayer) return 'The selected layer is unavailable. Choose Scene Pixels.'
  if (targetLayer.locked) return `${targetLayer.name} is locked. Unlock it or choose Scene Pixels.`
  if (targetLayer.mediaId) return 'Imported artwork must be converted before pixel editing. Choose Scene Pixels to paint non-destructively.'
  return 'Built-in artwork remains non-destructive. Choose Scene Pixels to paint over it.'
}

export function shouldShowPixGridEditorOverlay(activeEngineId: string, authoringOverlayVisible: boolean): boolean {
  return activeEngineId === 'pixGrid' && authoringOverlayVisible
}

export interface PixGridEditorOverlayProps {
  liveCanvas: HTMLCanvasElement | null
}

export function PixGridEditorOverlay({ liveCanvas }: PixGridEditorOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const operationRef = useRef<PointerOperation | null>(null)
  const previewEndRef = useRef<PixGridCellPoint | null>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const setOverlay = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const beginHistory = useReactStore(store => store.beginPixGridHistoryTransaction)
  const commitHistory = useReactStore(store => store.commitPixGridHistoryTransaction)
  const cancelHistory = useReactStore(store => store.cancelPixGridHistoryTransaction)
  const undo = useReactStore(store => store.undoPixGridEdit)
  const redo = useReactStore(store => store.redoPixGridEdit)
  const undoCount = useReactStore(store => store.pixGridUndoStack.length)
  const redoCount = useReactStore(store => store.pixGridRedoStack.length)

  const scene = getPixGridActiveScene(state)
  const layers = getPixGridActiveLayers(state)
  const targetLayer = layers.find(layer => layer.id === state.editor.selectedLayerId) ?? null
  const activeTool = TOOL_DEFINITIONS.find(definition => definition.tool === state.editorTool) ?? TOOL_DEFINITIONS[0]
  const activeToolDisabledReason = resolveToolDisabledReason(state.editorTool, state, liveCanvas, targetLayer)
  const targetLabel = targetLayer?.name ?? 'Scene Pixels'
  const targetOptions = useMemo(() => [
    { value: 'scene', label: 'Scene Pixels' },
    ...layers.map(layer => ({ value: layer.id, label: layer.name })),
  ], [layers])

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

  const pointFromEvent = useCallback((event: React.PointerEvent<HTMLCanvasElement>, shouldClamp = false) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return pixGridViewPointToCell(event.clientX - rect.left, event.clientY - rect.top, viewport(), shouldClamp)
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
      context.save()
      context.fillStyle = 'rgba(0,0,0,0.35)'
      context.fillRect(0, 0, size.width, size.height)
      context.beginPath()
      context.rect(output.left, output.top, output.width, output.height)
      context.clip()
      if (liveCanvas) context.drawImage(liveCanvas, output.left, output.top, output.width, output.height)
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

      const visibleGroups = activePixGridGroups(current.groups).filter(group => group.visible)
      if (visibleGroups.length > 0) {
        const cellWidth = output.width / current.matrixWidth
        const cellHeight = output.height / current.matrixHeight
        context.save()
        for (const group of visibleGroups) {
          const compiled = compilePixGridGroupMask(group, current.matrixWidth, current.matrixHeight)
          context.fillStyle = group.displayColor ?? '#4ac7db'
          context.globalAlpha = group.id === current.editor.selectedGroupId ? 0.3 : 0.16
          for (const [row, startColumn, length] of compiled.runs) {
            context.fillRect(output.left + startColumn * cellWidth, output.top + row * cellHeight, length * cellWidth, cellHeight)
          }
        }
        context.restore()
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
  }, [liveCanvas, size, viewport])

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
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const nextTool = TOOL_BY_SHORTCUT.get(event.key.toLowerCase())
        if (nextTool) {
          event.preventDefault()
          setState({ editorTool: nextTool })
          return
        }
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
  }, [applyState, beginHistory, cancelHistory, commitHistory, redo, setState, undo, updateEditor])

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = useReactStore.getState().pixGridState
    const currentLayers = getPixGridActiveLayers(current)
    const currentLayer = currentLayers.find(layer => layer.id === current.editor.selectedLayerId) ?? null
    if (resolveToolDisabledReason(current.editorTool, current, liveCanvas, currentLayer)) return
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
      if (!sampleCanvasRef.current) sampleCanvasRef.current = document.createElement('canvas')
      const color = samplePixGridCanvasColor(liveCanvas, point, current.matrixWidth, current.matrixHeight, sampleCanvasRef.current)
      if (color) updateEditor({ paintColor: color })
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
        <div className="rv-pix-grid-editor-history" aria-label="Edit history">
          <button type="button" className="rv-reset-btn" disabled={undoCount === 0} onClick={undo} title="Undo (Command/Ctrl+Z)">Undo</button>
          <button type="button" className="rv-reset-btn" disabled={redoCount === 0} onClick={redo} title="Redo (Shift+Command/Ctrl+Z)">Redo</button>
        </div>
        <div className="rv-pix-grid-editor-tool-list">
          {TOOL_DEFINITIONS.map(item => {
            const disabledReason = resolveToolDisabledReason(item.tool, state, liveCanvas, targetLayer)
            return (
              <button
                key={item.tool}
                type="button"
                className={state.editorTool === item.tool ? 'is-active' : ''}
                aria-label={`${item.label} tool, shortcut ${item.shortcut}`}
                aria-pressed={state.editorTool === item.tool}
                disabled={Boolean(disabledReason)}
                title={disabledReason ?? `${item.description} Shortcut: ${item.shortcut}`}
                onClick={() => setState({ editorTool: item.tool })}
              >
                <span>{item.label}</span><kbd>{item.shortcut}</kbd>
              </button>
            )
          })}
        </div>
        <label className="rv-pix-grid-editor-color" title="Active paint color">
          <span>Color</span>
          <input
            type="color"
            aria-label="Active PixGrid paint color"
            value={state.editor.paintColor}
            onChange={event => updateEditor({ paintColor: event.target.value })}
          />
          <output>{state.editor.paintColor.toUpperCase()}</output>
        </label>
        <span className="rv-pix-grid-editor-zoom">{Math.round(state.editor.zoom * 100)}%</span>
        <button type="button" className="rv-pix-grid-editor-done" onClick={() => setOverlay(false)}>Done</button>
      </div>

      <div className="rv-pix-grid-editor-context" aria-label="PixGrid editing context">
        <p id="pix-grid-editor-instructions"><strong>Choose a tool, then draw on the center canvas.</strong> Changes save automatically.</p>
        <label>
          <span>Scene</span>
          <DropdownSelect
            aria-label="Active PixGrid scene"
            value={scene.id}
            onChange={event => setState(selectPixGridScene(state, event.target.value))}
          >
            {state.scenes.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </DropdownSelect>
        </label>
        <label>
          <span>Edit Target</span>
          <DropdownSelect
            aria-label="PixGrid edit target"
            value={state.editor.selectedLayerId ?? 'scene'}
            onChange={event => updateEditor({ selectedLayerId: event.target.value === 'scene' ? null : event.target.value })}
          >
            {targetOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </DropdownSelect>
        </label>
        <dl>
          <div><dt>Tool</dt><dd>{activeTool.label}</dd></div>
          <div><dt>Target</dt><dd>{targetLabel}</dd></div>
          <div><dt>Color</dt><dd>{state.editor.paintColor.toUpperCase()}</dd></div>
          <div><dt>Save</dt><dd>Automatic</dd></div>
        </dl>
        <span className="rv-pix-grid-editor-live-status" role="status" data-live-canvas={liveCanvas ? 'ready' : 'unavailable'}>
          {liveCanvas ? 'Live output ready' : 'Live output unavailable'}
        </span>
        {activeToolDisabledReason && (
          <div className="rv-pix-grid-editor-blocked" id="pix-grid-editor-status" role="status">
            <span>{activeToolDisabledReason}</span>
            {state.editor.selectedLayerId !== null && (
              <button type="button" onClick={() => updateEditor({ selectedLayerId: null })}>Edit Scene Pixels</button>
            )}
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="rv-pix-grid-editor-canvas"
        aria-label="PixGrid logical cell editor. Draw inside the outlined center canvas."
        aria-describedby={activeToolDisabledReason ? 'pix-grid-editor-instructions pix-grid-editor-status' : 'pix-grid-editor-instructions'}
        data-tool={state.editorTool}
        data-edit-blocked={activeToolDisabledReason ? 'true' : 'false'}
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
