import { useEffect, useRef } from 'react'
import {
  CinemaRuntime,
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaCompositionDefinition,
  type CinemaCompositionInstance,
  type CinemaFrameBuildResult,
  type CinemaPersistedDefinition,
  type CinemaRuntimeSnapshot,
} from '../cinema'
import { acquireReactLiveEngineOwnership } from './renderers/ReactLiveEngineOwnership'
import { applyCanvasResolution, resolveCanvasResolution, type CanvasResolution } from './rendering/canvasResolution'
import { assertDrmvyzWebGLContextOwnershipBoundsForDevelopment } from './shaders/runtime/WebGLContextLifecycle'

export interface CinemaCanvasProps {
  frameBridge: CinemaFrameBuildResult | null
  composition: Readonly<CinemaCompositionDefinition> | null
  instance: Readonly<CinemaCompositionInstance> | null
  definitions: readonly CinemaPersistedDefinition[]
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  onRuntimeSnapshot?: (snapshot: CinemaRuntimeSnapshot) => void
}

const INITIAL_RUNTIME_SNAPSHOT: CinemaRuntimeSnapshot = {
  phase: 'initializing',
  viewport: { width: 1, height: 1, dpr: 1 },
  frameCount: 0,
  contextGeneration: 1,
  diagnostics: createCinemaDiagnosticSnapshot([]),
  graph: {
    compositionId: null, compositionRevision: null, planCacheKey: null, planCacheSize: 0, activeNodeCount: 0,
    initializedNodeCount: 0, failedNodeCount: 0, outputNodeId: null, outputRendered: false, safeOutputActive: true, modulationRouteCount: 0, activeModulationRouteCount: 0,
    performanceRuleCount: 0, activePerformanceRuleCount: 0, activePerformanceTransientCount: 0,
    diagnostics: createCinemaDiagnosticSnapshot([]),
  },
  capabilities: {
    webgl2: false,
    canvas2d: typeof CanvasRenderingContext2D !== 'undefined',
    floatColorTargets: false,
    floatBlending: false,
    textureArrays: false,
    instancing: false,
    timerQueries: false,
    maximumTextureSize: 0,
    maximumTextureUnits: 0,
  },
}

/** Production Cinema canvas. It is the only component allowed to own Cinema's live runtime. */
export function CinemaCanvas({
  frameBridge,
  composition,
  instance,
  definitions,
  onCanvasReady,
  onLiveFps,
  onRuntimeSnapshot,
}: CinemaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = useRef<CinemaRuntime | null>(null)
  const frameRef = useRef(frameBridge?.frame ?? null)
  const graphRef = useRef({ composition, instance, definitions })
  const onCanvasReadyRef = useRef(onCanvasReady)
  const onLiveFpsRef = useRef(onLiveFps)
  const onRuntimeSnapshotRef = useRef(onRuntimeSnapshot)

  frameRef.current = frameBridge?.frame ?? null
  graphRef.current = { composition, instance, definitions }
  onCanvasReadyRef.current = onCanvasReady
  onLiveFpsRef.current = onLiveFps
  onRuntimeSnapshotRef.current = onRuntimeSnapshot

  useEffect(() => {
    runtimeRef.current?.setFrame(frameRef.current)
  }, [frameBridge])

  useEffect(() => {
    const graph = graphRef.current
    runtimeRef.current?.setGraph(graph.composition, graph.instance, graph.definitions)
  }, [composition, instance, definitions])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let runtime: CinemaRuntime | null = null
    let resizeObserver: ResizeObserver | null = null
    let usingWindowResize = false
    let lastResolution: CanvasResolution | null = null
    let retired = false

    const reportSnapshot = (snapshot: CinemaRuntimeSnapshot) => {
      if (!retired) onRuntimeSnapshotRef.current?.(snapshot)
    }

    const retireOwnedResources = () => {
      if (retired) return
      retired = true
      resizeObserver?.disconnect()
      if (usingWindowResize) window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      runtime?.dispose()
      runtime = null
      runtimeRef.current = null
      onCanvasReadyRef.current?.(null)
      onLiveFpsRef.current?.(0)
    }
    const ownership = acquireReactLiveEngineOwnership('cinema', retireOwnedResources)

    const resize = () => {
      if (retired || !ownership.isCurrent()) return
      const bounds = canvas.getBoundingClientRect()
      const resolution = resolveCanvasResolution({
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        devicePixelRatio: window.devicePixelRatio,
        quality: 'high',
        previous: lastResolution,
      })
      if (!resolution.valid) return
      lastResolution = resolution
      if (runtime) runtime.resize(resolution)
      else applyCanvasResolution(canvas, resolution)
    }

    function handleVisibilityChange() {
      runtime?.setVisibilitySuspended(document.visibilityState === 'hidden')
    }

    try {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvas)
      } else {
        usingWindowResize = true
        window.addEventListener('resize', resize)
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)
      resize()

      const created = CinemaRuntime.create(canvas, {
        onSnapshot: reportSnapshot,
        onLiveFps: fps => onLiveFpsRef.current?.(fps),
      })
      if (!created.runtime) {
        reportSnapshot({
          ...INITIAL_RUNTIME_SNAPSHOT,
          phase: 'unavailable',
          diagnostics: created.diagnostics,
        })
        onCanvasReadyRef.current?.(canvas)
        ownership.markStable()
        return () => ownership.retire('unmount')
      }

      runtime = created.runtime
      runtimeRef.current = runtime
      runtime.setFrame(frameRef.current)
      runtime.setGraph(graphRef.current.composition, graphRef.current.instance, graphRef.current.definitions)
      if (lastResolution) runtime.resize(lastResolution)
      runtime.setVisibilitySuspended(document.visibilityState === 'hidden')
      runtime.start()
      onCanvasReadyRef.current?.(canvas)
      ownership.markStable()
      assertDrmvyzWebGLContextOwnershipBoundsForDevelopment('cinema')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      onRuntimeSnapshotRef.current?.({
        ...INITIAL_RUNTIME_SNAPSHOT,
        phase: 'unavailable',
        diagnostics: createCinemaDiagnosticSnapshot([
          createCinemaDiagnostic({
            code: 'CINEMA_CAPABILITY_UNAVAILABLE',
            severity: 'error',
            message: `Cinema canvas setup failed: ${message}`,
            attribution: { stage: 'cinema-canvas' },
          }),
        ]),
      })
      ownership.retire('setup-failed')
      if (import.meta.env.DEV) console.error('[CinemaCanvas] setup failed:', error)
      return
    }

    return () => ownership.retire('unmount')
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="rv-cinema-canvas"
      data-cinema-output-canvas="true"
      aria-label="Cinema live output"
    />
  )
}
