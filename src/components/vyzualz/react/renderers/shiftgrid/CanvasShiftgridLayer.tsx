import { useEffect, useMemo, useRef, useState } from 'react'
import { DrawerNotice } from '../../../shared/DrawerNotice'
import { CanvasPreloadManager, MAX_CANVAS_MEDIA_HANDLES, MAX_CANVAS_PRELOAD_QUEUE, type CanvasMediaPool } from '../../canvasPerformance'
import type { CanvasMediaItem } from '../../ReactTypes'
import { subscribeShiftgridCommand } from './ShiftgridCommandBus'
import { createShiftgridChoreographyPlan, createShiftgridPatternCycle, createShiftgridReconstructionPlan, createShiftgridScramblePlan, createShiftgridStaticPlan, ShiftgridChoreographyPlayback, shouldShiftgridResolve } from './ShiftgridChoreography'
import { createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import { createShiftgridRenderer, type ShiftgridRenderer, type ShiftgridRendererBackend } from './ShiftgridRenderer'
import { createShiftgridMosaicPlan, createShiftgridMosaicResolvePlan, ShiftgridMosaicPlayback, type ShiftgridImplementedMosaicType } from './ShiftgridMosaic'
import { isShiftgridP1ImageSource, resolveShiftgridSourceSet } from './ShiftgridSourceMedia'
import type { CanvasShiftgridSettings } from './ShiftgridSettings'
import { createShiftgridTileGeometry, resolveShiftgridGridDimensions } from './ShiftgridTileGeometry'

interface LoadedShiftgridSource { media: CanvasMediaItem; image: HTMLImageElement }
type LoadState = { status: 'idle' | 'loading' | 'ready' | 'error'; sources: readonly LoadedShiftgridSource[]; failedNames: readonly string[]; message?: string }

export function CanvasShiftgridLayer({ settings, activeMediaId, activePool, mediaItems, poolRevision = 0, trackIdentity = null, isPaused = false, onCanvasReady, onLiveFps }: {
  settings: CanvasShiftgridSettings
  activeMediaId: string | null
  activePool: CanvasMediaPool | null
  mediaItems: readonly CanvasMediaItem[]
  poolRevision?: number
  trackIdentity?: string | null
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
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle', sources: [], failedNames: [] })
  const sourceSettings = useMemo(() => ({ sourceMode: settings.sourceMode, poolSelectionMode: settings.poolSelectionMode,
    poolSourceLimit: settings.poolSourceLimit, deterministicSeed: settings.deterministicSeed }),
  [settings.deterministicSeed, settings.poolSelectionMode, settings.poolSourceLimit, settings.sourceMode])
  const sources = useMemo(() => resolveShiftgridSourceSet({ settings: sourceSettings, activeMediaId, activePool, mediaItems }),
    [activeMediaId, activePool, mediaItems, sourceSettings])

  useEffect(() => {
    const eligible = sources.media.filter(isShiftgridP1ImageSource).slice(0, MAX_CANVAS_MEDIA_HANDLES)
    if (eligible.length === 0) { setLoadState({ status: 'idle', sources: [], failedNames: [] }); return }
    const preload = new CanvasPreloadManager({ maxHandles: MAX_CANVAS_MEDIA_HANDLES })
    const scope = `shiftgrid:${trackIdentity ?? 'session'}:${sources.identity}`
    preload.setScope(scope, poolRevision)
    let cancelled = false; let finished = false; let poll = 0
    setLoadState({ status: 'loading', sources: [], failedNames: [] })
    const update = () => {
      if (cancelled || finished) return
      const snapshot = preload.getSnapshot()
      const requestCapacity = Math.max(0, MAX_CANVAS_PRELOAD_QUEUE - snapshot.queued - snapshot.loading)
      const requests = eligible.filter(media => {
        const status = preload.getReadiness(media.id).status
        return status === 'idle' || status === 'cancelled'
      }).slice(0, requestCapacity).map((media, index) => ({ media, trackIdentity: scope, poolRevision, priority: 100 - index }))
      if (requests.length > 0) preload.request(requests)
      const ready = eligible.flatMap(media => {
        const handle = preload.getHandle(media.id)
        return preload.isReady(media.id) && handle && !(typeof HTMLVideoElement !== 'undefined' && handle instanceof HTMLVideoElement)
          ? [{ media, image: handle as HTMLImageElement }]
          : []
      })
      const failed = eligible.filter(media => preload.getReadiness(media.id).status === 'error')
      if (ready.length + failed.length !== eligible.length) return
      finished = true; if (poll) window.clearInterval(poll)
      if (ready.length > 0) setLoadState({ status: 'ready', sources: ready, failedNames: failed.map(media => media.name) })
      else setLoadState({ status: 'error', sources: [], failedNames: failed.map(media => media.name), message: 'None of the selected pool images could be decoded.' })
    }
    update()
    if (!finished) poll = window.setInterval(update, 40)
    return () => { cancelled = true; window.clearInterval(poll); preload.dispose() }
  }, [poolRevision, sources.identity, sources.media, trackIdentity])

  useEffect(() => {
    const canvas = canvasRef.current; const loadedSources = loadState.sources
    if (!canvas || loadState.status !== 'ready' || loadedSources.length === 0) { onCanvasReady?.(null); return }
    let renderer: ShiftgridRenderer
    try { renderer = createShiftgridRenderer(canvas, { forceCanvas2D }) }
    catch { setLoadState(state => ({ ...state, status: 'error', message: 'Neither WebGL2 nor Canvas2D is available for SHIFTGRID.' })); return }
    try {
      const preferredCellSize = settingsRef.current.quality === 'low' ? 384 : settingsRef.current.quality === 'high' ? 768 : 512
      renderer.setSources(loadedSources.map(source => ({ id: source.media.id, element: source.image })), { preferredCellSize })
    } catch {
      renderer.dispose(); setLoadState(state => ({ ...state, status: 'error', message: 'Could not upload the selected pool images to the bounded SHIFTGRID texture atlas.' })); return
    }
    setBackend(renderer.backend); onCanvasReady?.(canvas)
    let frameId = 0; let previousAt = performance.now(); let runtime: ShiftgridChoreographyPlayback | null = null; let mosaic: ShiftgridMosaicPlayback | null = null
    let geometryKey = ''; let choreographyKey = ''; let mosaicKey = ''; let actionRevision = 0; let cycleRevision = 0; let mosaicRevision = 0; let mosaicHoldMs = 0
    let previousTargetIndex = -1; let previousAutoType: ShiftgridImplementedMosaicType | null = null
    let phase: 'choreography' | 'resolve' = 'choreography'; let manualHold = false; let fpsFrames = 0; let fpsStartedAt = previousAt
    const sourceIds = loadedSources.map(source => source.media.id)
    const initialPrimaryIndex = Math.max(0, settingsRef.current.primaryTargetMediaId ? sourceIds.indexOf(settingsRef.current.primaryTargetMediaId) : 0)
    const replaceMosaic = () => {
      if (!mosaic || !runtime) return
      const live = settingsRef.current; mosaicRevision += 1; mosaicHoldMs = 0
      const plan = createShiftgridMosaicPlan({ columns: runtime.state.columns, rows: runtime.state.rows, sourceIds, settings: live,
        initialSourceIndicesByTile: mosaic.currentSourceIndicesByTile, sequenceIndex: mosaicRevision + 1, previousTargetIndex, previousAutoType })
      previousTargetIndex = plan.targetSourceIndex
      if (plan.resolvedType !== 'singleImage') previousAutoType = plan.resolvedType
      mosaic.replacePlan(plan)
    }
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
      if (command === 'showOriginal') {
        manualHold = true; runtime.replacePlan(createShiftgridStaticPlan(runtime.state.columns, runtime.state.rows, Array.from({ length: current.length }, (_, index) => index), live.deterministicSeed))
        if (mosaic) {
          const target = live.primaryTargetMediaId ? Math.max(0, sourceIds.indexOf(live.primaryTargetMediaId)) : Math.max(0, previousTargetIndex)
          mosaic.replacePlan(createShiftgridMosaicResolvePlan({ columns: runtime.state.columns, rows: runtime.state.rows, sourceCount: sourceIds.length,
            targetSourceIndex: target, initialSourceIndicesByTile: mosaic.currentSourceIndicesByTile, settings: live }))
        }
      }
      else if (command === 'scramble') { manualHold = true; runtime.replacePlan(createShiftgridScramblePlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: current, seed: live.deterministicSeed + ++actionRevision })) }
      else if (command === 'reconstruct') {
        phase = 'resolve'; manualHold = true; runtime.replacePlan(createShiftgridReconstructionPlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: current }))
        if (mosaic) {
          const target = live.primaryTargetMediaId ? Math.max(0, sourceIds.indexOf(live.primaryTargetMediaId)) : Math.max(0, previousTargetIndex)
          mosaic.replacePlan(createShiftgridMosaicResolvePlan({ columns: runtime.state.columns, rows: runtime.state.rows, sourceCount: sourceIds.length,
            targetSourceIndex: target, initialSourceIndicesByTile: mosaic.currentSourceIndicesByTile, settings: live }))
        }
      }
      else replaceWithChoreography()
    })
    const contextLost = (event: Event) => { event.preventDefault(); renderer.dispose(); setForceCanvas2D(true); setCanvasRevision(value => value + 1) }
    canvas.addEventListener('webglcontextlost', contextLost)

    const frame = (now: number) => {
      const rect = canvas.getBoundingClientRect(); const width = Math.max(1, rect.width || canvas.clientWidth || 1); const height = Math.max(1, rect.height || canvas.clientHeight || 1)
      const live = settingsRef.current
      const deltaMs = Math.min(64, Math.max(0, now - previousAt))
      const dpr = Math.max(0.5, Math.min(2, window.devicePixelRatio || 1) * live.renderScale)
      renderer.resize(width, height, dpr)
      const primary = loadedSources[Math.max(0, live.primaryTargetMediaId ? sourceIds.indexOf(live.primaryTargetMediaId) : initialPrimaryIndex)] ?? loadedSources[0]!
      const dimensions = resolveShiftgridGridDimensions({ settings: live, sourceWidth: primary.image.naturalWidth, sourceHeight: primary.image.naturalHeight, viewportWidth: width, viewportHeight: height })
      const nextKey = `${dimensions.columns}x${dimensions.rows}:${live.tileShape}`
      const nextChoreographyKey = `${live.choreographyPattern}:${live.deterministicSeed}`
      const nextMosaicKey = `${live.mosaicType}:${live.deterministicSeed}:${live.primaryTargetMediaId ?? 'auto'}:${live.waveRoute}:${live.movementSpeed}:${live.stagger}:${live.scrambleComplexity}:${sourceIds.join('|')}`
      const geometry = createShiftgridTileGeometry({ ...live, gridColumns: dimensions.columns, gridRows: dimensions.rows }, width, height)
      if (!runtime || nextKey !== geometryKey) {
        geometryKey = nextKey; choreographyKey = nextChoreographyKey; mosaicKey = nextMosaicKey; cycleRevision = 0; mosaicRevision = 0; phase = 'choreography'
        const plan = createShiftgridChoreographyPlan({ columns: dimensions.columns, rows: dimensions.rows, settings: live })
        runtime = new ShiftgridChoreographyPlayback(geometry, plan, `${sources.identity}:${nextKey}`)
        const initialSources = Array(dimensions.columns * dimensions.rows).fill(initialPrimaryIndex)
        const mosaicPlan = createShiftgridMosaicPlan({ columns: dimensions.columns, rows: dimensions.rows, sourceIds, settings: live,
          initialSourceIndicesByTile: initialSources, sequenceIndex: live.mosaicType === 'singleImage' ? 0 : 1 })
        mosaic = new ShiftgridMosaicPlayback(mosaicPlan); previousTargetIndex = mosaicPlan.targetSourceIndex
        if (mosaicPlan.resolvedType !== 'singleImage') previousAutoType = mosaicPlan.resolvedType
      } else if (nextChoreographyKey !== choreographyKey) { choreographyKey = nextChoreographyKey; replaceWithChoreography() }
      if (mosaic && nextMosaicKey !== mosaicKey) { mosaicKey = nextMosaicKey; replaceMosaic() }
      runtime.setPaused(pausedRef.current); runtime.advance(deltaMs)
      mosaic?.setPaused(pausedRef.current); mosaic?.advance(deltaMs); previousAt = now
      if (runtime.complete && live.autoPerformance && !pausedRef.current && !manualHold) {
        if (live.reconstructionMode === 'progressiveResolve' && phase === 'choreography') {
          phase = 'resolve'; runtime.replacePlan(createShiftgridReconstructionPlan({ columns: runtime.state.columns, rows: runtime.state.rows, settings: live, initialSlotsByTile: runtime.state.currentSlotsByTile }))
        } else if (live.reconstructionMode === 'progressiveResolve' && phase === 'resolve') replaceWithChoreography()
        else if (shouldShiftgridResolve(live.reconstructionMode, 'continuous')) replaceWithChoreography()
      }
      if (mosaic?.complete && sourceIds.length > 1 && live.mosaicType !== 'singleImage' && live.autoPerformance && !pausedRef.current && !manualHold) {
        mosaicHoldMs += deltaMs
        if (mosaicHoldMs >= live.sourceHoldDurationSec * 1000) replaceMosaic()
      }
      renderer.render(createShiftgridRenderPlan({ geometry, runtime, sourceRuntime: mosaic ?? undefined, width, height,
        sourceWidth: primary.image.naturalWidth, sourceHeight: primary.image.naturalHeight,
        sources: loadedSources.map(source => ({ id: source.media.id, width: source.image.naturalWidth, height: source.image.naturalHeight })),
        fitMode: live.fitMode, easing: live.easing, snapStrength: live.snapStrength }))
      fpsFrames += 1
      if (now - fpsStartedAt >= 1000) { onLiveFps?.(Math.round(fpsFrames * 1000 / (now - fpsStartedAt))); fpsFrames = 0; fpsStartedAt = now }
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(frameId); unsubscribe(); canvas.removeEventListener('webglcontextlost', contextLost); renderer.dispose(); onCanvasReady?.(null); onLiveFps?.(0) }
  }, [canvasRevision, forceCanvas2D, loadState.sources, loadState.status, onCanvasReady, onLiveFps, settings.quality, sources.identity])

  const emptyMessage = loadState.status === 'idle'
    ? sources.media.length > 0 ? 'SHIFTGRID supports PNG, JPEG, WebP, and SVG pool sources; video sources are ignored.' : 'Select an image or SVG in CANVAS Media, or add images to the active Media Pool.'
    : loadState.status === 'error' ? loadState.message : null

  return (
    <div className={`rv-canvas-engine-surface rv-canvas-engine-surface--shiftgrid${emptyMessage ? ' rv-canvas-engine-surface--empty' : ''}`}
      role="region" aria-label="SHIFTGRID tile render surface" data-renderer-kind="shiftgrid" data-shiftgrid-source-mode={sources.mode}
      data-shiftgrid-source-count={sources.media.length} data-shiftgrid-backend={backend ?? 'pending'}>
      <canvas key={canvasRevision} ref={canvasRef} className="rv-canvas-shiftgrid-layer" aria-label="SHIFTGRID single-image tile composition" />
      {loadState.status === 'loading' && <DrawerNotice tone="info" role="status" title="SHIFTGRID">Loading retained Media Pool images…</DrawerNotice>}
      {loadState.status === 'ready' && loadState.failedNames.length > 0 && <DrawerNotice tone="warning" role="status" title="SHIFTGRID · Degraded Pool">Skipped: {loadState.failedNames.join(', ')}</DrawerNotice>}
      {emptyMessage && <DrawerNotice tone="info" role="status" title="SHIFTGRID · Media Pool">{emptyMessage}</DrawerNotice>}
    </div>
  )
}
