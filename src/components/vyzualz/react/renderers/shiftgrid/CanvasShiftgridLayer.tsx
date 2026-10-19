import { useEffect, useMemo, useRef, useState } from 'react'
import { DrawerNotice } from '../../../shared/DrawerNotice'
import type { CanvasMediaPool } from '../../canvasPerformance'
import type { CanvasMediaItem } from '../../ReactTypes'
import { subscribeShiftgridCommand } from './ShiftgridCommandBus'
import { createShiftgridChoreographyPlan, createShiftgridPatternCycle, createShiftgridReconstructionPlan, createShiftgridScramblePlan, createShiftgridStaticPlan, ShiftgridChoreographyPlayback, shouldShiftgridResolve } from './ShiftgridChoreography'
import { createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import { createShiftgridRenderer, type ShiftgridRenderer, type ShiftgridRendererBackend } from './ShiftgridRenderer'
import { isShiftgridP1ImageSource, resolveShiftgridSourceSet } from './ShiftgridSourceMedia'
import type { CanvasShiftgridSettings } from './ShiftgridSettings'
import { createShiftgridTileGeometry, resolveShiftgridGridDimensions } from './ShiftgridTileGeometry'

type LoadState = { status: 'idle' | 'loading' | 'ready' | 'error'; image: HTMLImageElement | null; message?: string }

export function CanvasShiftgridLayer({ settings, activeMediaId, activePool, mediaItems, isPaused = false, onCanvasReady, onLiveFps }: {
  settings: CanvasShiftgridSettings
  activeMediaId: string | null
  activePool: CanvasMediaPool | null
  mediaItems: readonly CanvasMediaItem[]
  isPaused?: boolean
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const settingsRef = useRef(settings)
  const pausedRef = useRef(isPaused)
  settingsRef.current = settings
  pausedRef.current = isPaused
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
    let frameId = 0; let previousAt = performance.now(); let runtime: ShiftgridChoreographyPlayback | null = null
    let geometryKey = ''; let choreographyKey = ''; let actionRevision = 0; let cycleRevision = 0
    let phase: 'choreography' | 'resolve' = 'choreography'; let manualHold = false; let fpsFrames = 0; let fpsStartedAt = previousAt
    const replaceWithChoreography = () => {
      if (!runtime) return
      const live = settingsRef.current; cycleRevision += 1; phase = 'choreography'; manualHold = false
      const cycle = createShiftgridPatternCycle(live.deterministicSeed)
      const pattern = live.patternChange ? cycle[cycleRevision % cycle.length]! : live.choreographyPattern
      runtime.replacePlan(createShiftgridChoreographyPlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: { ...live, choreographyPattern: pattern },
        initialSlotsByTile: runtime.state.currentSlotsByTile, seed: live.deterministicSeed + cycleRevision }))
    }
    const unsubscribe = subscribeShiftgridCommand(command => {
      if (!runtime) return
      const live = settingsRef.current; const current = runtime.state.currentSlotsByTile
      if (command === 'phraseBoundary' || command === 'dropBoundary') {
        const boundary = command === 'phraseBoundary' ? 'phrase' : 'drop'
        if (shouldShiftgridResolve(live.reconstructionMode, boundary)) {
          phase = 'resolve'; manualHold = true
          runtime.replacePlan(createShiftgridReconstructionPlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: current }))
        }
        return
      }
      if (command === 'showOriginal') { manualHold = true; runtime.replacePlan(createShiftgridStaticPlan(runtime.state.columns, runtime.state.rows, Array.from({ length: current.length }, (_, index) => index), live.deterministicSeed)) }
      else if (command === 'scramble') { manualHold = true; runtime.replacePlan(createShiftgridScramblePlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: current, seed: live.deterministicSeed + ++actionRevision })) }
      else if (command === 'reconstruct') { phase = 'resolve'; manualHold = true; runtime.replacePlan(createShiftgridReconstructionPlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: current })) }
      else replaceWithChoreography()
    })
    const contextLost = (event: Event) => { event.preventDefault(); renderer.dispose(); setForceCanvas2D(true); setCanvasRevision(value => value + 1) }
    canvas.addEventListener('webglcontextlost', contextLost)

    const frame = (now: number) => {
      const rect = canvas.getBoundingClientRect(); const width = Math.max(1, rect.width || canvas.clientWidth || 1); const height = Math.max(1, rect.height || canvas.clientHeight || 1)
      const live = settingsRef.current
      const dpr = Math.max(0.5, Math.min(2, window.devicePixelRatio || 1) * live.renderScale)
      renderer.resize(width, height, dpr)
      const dimensions = resolveShiftgridGridDimensions({ settings: live, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, viewportWidth: width, viewportHeight: height })
      const nextKey = `${dimensions.columns}x${dimensions.rows}:${live.tileShape}`
      const nextChoreographyKey = `${live.choreographyPattern}:${live.deterministicSeed}`
      const geometry = createShiftgridTileGeometry({ ...live, gridColumns: dimensions.columns, gridRows: dimensions.rows }, width, height)
      if (!runtime || nextKey !== geometryKey) {
        geometryKey = nextKey; choreographyKey = nextChoreographyKey; cycleRevision = 0; phase = 'choreography'
        const plan = createShiftgridChoreographyPlan({ columns: dimensions.columns, rows: dimensions.rows, settings: live })
        runtime = new ShiftgridChoreographyPlayback(geometry, plan, `${source?.id ?? 'source'}:${nextKey}`)
      } else if (nextChoreographyKey !== choreographyKey) { choreographyKey = nextChoreographyKey; replaceWithChoreography() }
      runtime.setPaused(pausedRef.current); runtime.advance(Math.min(64, Math.max(0, now - previousAt))); previousAt = now
      if (runtime.complete && live.autoPerformance && !pausedRef.current && !manualHold) {
        if (live.reconstructionMode === 'progressiveResolve' && phase === 'choreography') {
          phase = 'resolve'; runtime.replacePlan(createShiftgridReconstructionPlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: runtime.state.currentSlotsByTile }))
        } else if (live.reconstructionMode === 'progressiveResolve' && phase === 'resolve') replaceWithChoreography()
        else if (shouldShiftgridResolve(live.reconstructionMode, 'continuous')) replaceWithChoreography()
      }
      renderer.render(createShiftgridRenderPlan({ geometry, runtime, width, height, sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, fitMode: live.fitMode, easing: live.easing, snapStrength: live.snapStrength }))
      fpsFrames += 1
      if (now - fpsStartedAt >= 1000) { onLiveFps?.(Math.round(fpsFrames * 1000 / (now - fpsStartedAt))); fpsFrames = 0; fpsStartedAt = now }
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(frameId); unsubscribe(); canvas.removeEventListener('webglcontextlost', contextLost); renderer.dispose(); onCanvasReady?.(null); onLiveFps?.(0) }
  }, [canvasRevision, forceCanvas2D, loadState, onCanvasReady, onLiveFps, source?.id, source?.name])

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
