import { useEffect, useMemo, useRef, useState } from 'react'
import { DrawerNotice } from '../../../shared/DrawerNotice'
import type { CanvasMediaPool } from '../../canvasPerformance'
import type { CanvasMediaItem } from '../../ReactTypes'
import { subscribeShiftgridCommand } from './ShiftgridCommandBus'
import { ShiftgridGridRuntime } from './ShiftgridGridState'
import { createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import { createShiftgridRenderer, type ShiftgridRenderer, type ShiftgridRendererBackend } from './ShiftgridRenderer'
import { isShiftgridP1ImageSource, resolveShiftgridSourceSet } from './ShiftgridSourceMedia'
import type { CanvasShiftgridSettings } from './ShiftgridSettings'
import { createShiftgridTileGeometry, resolveShiftgridGridDimensions } from './ShiftgridTileGeometry'

type LoadState = { status: 'idle' | 'loading' | 'ready' | 'error'; image: HTMLImageElement | null; message?: string }

function transitionDuration(settings: CanvasShiftgridSettings): number {
  return Math.round(180 + (2 - settings.movementSpeed) * 410)
}

export function CanvasShiftgridLayer({ settings, activeMediaId, activePool, mediaItems, onCanvasReady, onLiveFps }: {
  settings: CanvasShiftgridSettings
  activeMediaId: string | null
  activePool: CanvasMediaPool | null
  mediaItems: readonly CanvasMediaItem[]
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [backend, setBackend] = useState<ShiftgridRendererBackend | null>(null)
  const [forceCanvas2D, setForceCanvas2D] = useState(false)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle', image: null })
  const sources = useMemo(() => resolveShiftgridSourceSet({ settings, activeMediaId, activePool, mediaItems }), [activeMediaId, activePool, mediaItems, settings])
  const source = sources.media.find(isShiftgridP1ImageSource) ?? null

  useEffect(() => {
    if (!source) { setLoadState({ status: 'idle', image: null }); return }
    let cancelled = false
    const image = new Image(); setLoadState({ status: 'loading', image: null })
    if (/^https?:/i.test(source.objectUrl)) image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => { if (!cancelled) setLoadState({ status: 'ready', image }) }
    image.onerror = () => { if (!cancelled) setLoadState({ status: 'error', image: null, message: `Could not decode ${source.name}. Use PNG, JPEG, WebP, or SVG.` }) }
    image.src = source.objectUrl
    return () => { cancelled = true; image.onload = null; image.onerror = null; image.src = '' }
  }, [source])

  useEffect(() => {
    const canvas = canvasRef.current; const image = loadState.image
    if (!canvas || loadState.status !== 'ready' || !image) { onCanvasReady?.(null); return }
    let renderer: ShiftgridRenderer
    try { renderer = createShiftgridRenderer(canvas, { forceCanvas2D }) }
    catch { setLoadState({ status: 'error', image: null, message: 'Neither WebGL2 nor Canvas2D is available for SHIFTGRID.' }); return }
    try { renderer.setSource(image) }
    catch { renderer.dispose(); setLoadState({ status: 'error', image: null, message: `Could not upload ${source?.name ?? 'the source'} to the SHIFTGRID renderer.` }); return }
    setBackend(renderer.backend); onCanvasReady?.(canvas)
    let frameId = 0; let previousAt = performance.now(); let runtime: ShiftgridGridRuntime | null = null
    let geometryKey = ''; let actionRevision = 0; let fpsFrames = 0; let fpsStartedAt = previousAt
    const duration = () => transitionDuration(settings)
    const unsubscribe = subscribeShiftgridCommand(command => {
      if (!runtime) return
      if (command === 'showOriginal') runtime.showOriginal()
      else if (command === 'scramble') runtime.scramble(settings.deterministicSeed, duration())
      else if (command === 'reconstruct') runtime.reconstruct(duration())
      else {
        const operation = actionRevision++ % 4
        if (operation === 0) runtime.swap(settings.deterministicSeed + actionRevision, duration())
        else if (operation === 1) runtime.cycleRow(actionRevision % runtime.state.rows, 1, duration())
        else if (operation === 2) runtime.cycleColumn(actionRevision % runtime.state.columns, -1, duration())
        else runtime.coordinated(settings.deterministicSeed + actionRevision, duration())
      }
    })
    const contextLost = (event: Event) => { event.preventDefault(); renderer.dispose(); setForceCanvas2D(true); setCanvasRevision(value => value + 1) }
    canvas.addEventListener('webglcontextlost', contextLost)

    const frame = (now: number) => {
      const rect = canvas.getBoundingClientRect(); const width = Math.max(1, rect.width || canvas.clientWidth || 1); const height = Math.max(1, rect.height || canvas.clientHeight || 1)
      const dpr = Math.max(0.5, Math.min(2, window.devicePixelRatio || 1) * settings.renderScale)
      renderer.resize(width, height, dpr)
      const dimensions = resolveShiftgridGridDimensions({ settings, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, viewportWidth: width, viewportHeight: height })
      const nextKey = `${dimensions.columns}x${dimensions.rows}:${settings.tileShape}`
      if (!runtime || nextKey !== geometryKey) { geometryKey = nextKey; runtime = new ShiftgridGridRuntime(createShiftgridTileGeometry({ ...settings, gridColumns: dimensions.columns, gridRows: dimensions.rows }, width, height), `${source?.id ?? 'source'}:${nextKey}`) }
      const geometry = createShiftgridTileGeometry({ ...settings, gridColumns: dimensions.columns, gridRows: dimensions.rows }, width, height)
      runtime.advance(Math.min(64, Math.max(0, now - previousAt))); previousAt = now
      renderer.render(createShiftgridRenderPlan({ geometry, runtime, width, height, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, fitMode: settings.fitMode, easing: settings.easing }))
      fpsFrames += 1
      if (now - fpsStartedAt >= 1000) { onLiveFps?.(Math.round(fpsFrames * 1000 / (now - fpsStartedAt))); fpsFrames = 0; fpsStartedAt = now }
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(frameId); unsubscribe(); canvas.removeEventListener('webglcontextlost', contextLost); renderer.dispose(); onCanvasReady?.(null); onLiveFps?.(0) }
  }, [canvasRevision, forceCanvas2D, loadState, onCanvasReady, onLiveFps, settings, source?.id, source?.name])

  const emptyMessage = !source
    ? sources.media.length > 0 ? 'Phase 1 supports a single PNG, JPEG, WebP, or SVG source. Video and multi-image choreography arrive later.' : 'Select an image or SVG in CANVAS Media, or add one to the active Media Pool.'
    : loadState.status === 'error' ? loadState.message : null

  return (
    <div className={`rv-canvas-engine-surface rv-canvas-engine-surface--shiftgrid${emptyMessage ? ' rv-canvas-engine-surface--empty' : ''}`}
      role="region" aria-label="SHIFTGRID tile render surface" data-renderer-kind="shiftgrid" data-shiftgrid-source-mode={sources.mode}
      data-shiftgrid-source-count={sources.media.length} data-shiftgrid-backend={backend ?? 'pending'}>
      <canvas key={canvasRevision} ref={canvasRef} className="rv-canvas-shiftgrid-layer" aria-label="SHIFTGRID single-image tile composition" />
      {loadState.status === 'loading' && <DrawerNotice tone="info" role="status" title="SHIFTGRID">Loading original source…</DrawerNotice>}
      {emptyMessage && <DrawerNotice tone={source ? 'warning' : 'info'} role="status" title="SHIFTGRID · Single Image">{emptyMessage}</DrawerNotice>}
    </div>
  )
}
