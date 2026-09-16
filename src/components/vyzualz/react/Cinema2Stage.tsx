import { useEffect, useRef, useState } from 'react'
import {
  Cinema2Runtime,
  captureCinema2WorkspacePresetState,
  restoreCinema2WorkspaceMedia,
  type Cinema2PresetId,
  type Cinema2RuntimeSnapshot,
  type Cinema2WorkspacePresetState,
} from '../cinema2'
import { acquireReactLiveEngineOwnership } from './renderers/ReactLiveEngineOwnership'
import { resolveCanvasResolution, type CanvasResolution } from './rendering/canvasResolution'
import { assertDrmvyzWebGLContextOwnershipBoundsForDevelopment } from './shaders/runtime/WebGLContextLifecycle'

export interface Cinema2StageProps {
  presetId?: Cinema2PresetId
  restoreState?: Readonly<Cinema2WorkspacePresetState> | null
  isPlaying?: boolean
  analysisActive?: boolean
  isPaused?: boolean
  activeAudioTrackId?: string | null
  bpmSync?: boolean
  bpm?: number | null
  getAudioTime?: () => number
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onRuntimeReady?: (runtime: Cinema2Runtime | null) => void
  onRuntimeSnapshot?: (snapshot: Cinema2RuntimeSnapshot | null) => void
  onRuntimeRetiring?: (state: Readonly<Cinema2WorkspacePresetState>) => void
}

function statusCopy(snapshot: Cinema2RuntimeSnapshot | null): string | null {
  if (snapshot?.phase === 'context-lost') {
    return 'WebGL2 context lost. Cinema 2.0 will resume when the context is restored.'
  }
  if (snapshot?.phase === 'unavailable') {
    return snapshot.statusMessage ?? 'Cinema 2.0 WebGL2 output is unavailable.'
  }
  return snapshot?.statusMessage ?? null
}

/** Production Stage host for the native Cinema 2.0 sibling runtime. */
export function Cinema2Stage({
  presetId,
  restoreState = null,
  isPlaying,
  analysisActive,
  isPaused,
  activeAudioTrackId,
  bpmSync,
  bpm,
  getAudioTime,
  onCanvasReady,
  onRuntimeReady,
  onRuntimeSnapshot,
  onRuntimeRetiring,
}: Cinema2StageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onCanvasReadyRef = useRef(onCanvasReady)
  const onRuntimeReadyRef = useRef(onRuntimeReady)
  const onRuntimeSnapshotRef = useRef(onRuntimeSnapshot)
  const onRuntimeRetiringRef = useRef(onRuntimeRetiring)
  const transportRef = useRef({
    isPlaying: isPlaying ?? true,
    analysisActive: analysisActive ?? true,
    isPaused: isPaused ?? false,
    activeAudioTrackId: activeAudioTrackId ?? null,
    bpmSync: bpmSync === true,
    bpm: typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0 ? bpm : null,
    getAudioTime,
  })
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<Cinema2RuntimeSnapshot | null>(null)
  transportRef.current = {
    isPlaying: isPlaying ?? true,
    analysisActive: analysisActive ?? true,
    isPaused: isPaused ?? false,
    activeAudioTrackId: activeAudioTrackId ?? null,
    bpmSync: bpmSync === true,
    bpm: typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0 ? bpm : null,
    getAudioTime,
  }
  onCanvasReadyRef.current = onCanvasReady
  onRuntimeReadyRef.current = onRuntimeReady
  onRuntimeSnapshotRef.current = onRuntimeSnapshot
  onRuntimeRetiringRef.current = onRuntimeRetiring

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let runtime: Cinema2Runtime | null = null
    let resizeObserver: ResizeObserver | null = null
    let lastResolution: CanvasResolution | null = null
    let retired = false

    const reportSnapshot = (snapshot: Cinema2RuntimeSnapshot) => {
      if (retired) return
      setRuntimeSnapshot(snapshot)
      onRuntimeSnapshotRef.current?.(snapshot)
    }

    const resize = () => {
      if (retired) return
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
      runtime?.resize({
        width: resolution.backingWidth,
        height: resolution.backingHeight,
        dpr: resolution.effectiveDpr,
      })
    }

    const handleVisibilityChange = () => {
      runtime?.setSuspended(document.visibilityState === 'hidden')
    }

    const retireOwnedResources = () => {
      if (retired) return
      retired = true
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (runtime) onRuntimeRetiringRef.current?.(captureCinema2WorkspacePresetState(runtime))
      onRuntimeReadyRef.current?.(null)
      onRuntimeSnapshotRef.current?.(null)
      runtime?.dispose()
      runtime = null
      onCanvasReadyRef.current?.(null)
    }

    const ownership = acquireReactLiveEngineOwnership('cinema2', retireOwnedResources)

    try {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvas)
      }
      window.addEventListener('resize', resize)
      document.addEventListener('visibilitychange', handleVisibilityChange)

      const transportSource = {
        getState: () => {
          const transport = transportRef.current
          const timeSec = transport.getAudioTime?.() ?? 0
          return {
            sourcePresent: transport.analysisActive || transport.activeAudioTrackId != null,
            playing: transport.isPlaying,
            analysisActive: transport.analysisActive,
            paused: transport.isPaused,
            trackId: transport.activeAudioTrackId,
            timeSec: Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0,
            bpmSync: transport.bpmSync,
            bpm: transport.bpm,
          }
        },
      }
      let created = Cinema2Runtime.create(canvas, {
        onSnapshot: reportSnapshot,
        presetId,
        serializedParameterState: restoreState?.serializedParameterState,
        transportSource,
      })
      if (!created.runtime && restoreState?.serializedParameterState != null) {
        // The in-session captured parameter state (cinema2WorkspaceSessionStore)
        // can go stale relative to the active preset's current schema — e.g. a
        // parameter authored into that preset was since removed. Rather than
        // leaving the Stage permanently unavailable over state that's only a
        // same-session cache (not a saved show/project), discard it and retry
        // once with the preset's authored defaults.
        if (import.meta.env.DEV) {
          console.warn('[Cinema2Stage] discarding incompatible session parameter state and retrying with defaults:', created.error)
        }
        created = Cinema2Runtime.create(canvas, { onSnapshot: reportSnapshot, presetId, transportSource })
      }
      reportSnapshot(created.snapshot)
      if (!created.runtime) {
        onRuntimeReadyRef.current?.(null)
        onCanvasReadyRef.current?.(canvas)
        ownership.markStable()
        return () => ownership.retire('unmount')
      }

      runtime = created.runtime
      onRuntimeReadyRef.current?.(runtime)
      void restoreCinema2WorkspaceMedia(runtime, restoreState).catch(error => {
        if (import.meta.env.DEV) console.warn('[Cinema2Stage] media restore failed:', error)
      })
      resize()
      runtime.setSuspended(document.visibilityState === 'hidden')
      runtime.start()
      onCanvasReadyRef.current?.(canvas)
      ownership.markStable()
      assertDrmvyzWebGLContextOwnershipBoundsForDevelopment('cinema2')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setRuntimeSnapshot({
        phase: 'unavailable',
        viewport: { width: 1, height: 1, dpr: 1 },
        frameCount: 0,
        contextGeneration: 0,
        statusMessage: `Cinema 2.0 Stage setup failed: ${message}`,
        resources: {
          activeAnimationFrameCount: 0,
          activeEventListenerCount: 0,
          activeWebGLContextCount: 0,
        },
      })
      onRuntimeSnapshotRef.current?.({
        phase: 'unavailable',
        viewport: { width: 1, height: 1, dpr: 1 },
        frameCount: 0,
        contextGeneration: 0,
        statusMessage: `Cinema 2.0 Stage setup failed: ${message}`,
        resources: {
          activeAnimationFrameCount: 0,
          activeEventListenerCount: 0,
          activeWebGLContextCount: 0,
        },
      })
      onRuntimeReadyRef.current?.(null)
      ownership.retire('setup-failed')
      if (import.meta.env.DEV) console.error('[Cinema2Stage] setup failed:', error)
      return
    }

    return () => ownership.retire('unmount')
  }, [presetId, restoreState])

  const message = statusCopy(runtimeSnapshot)

  return (
    <section
      className="rv-cinema2-stage"
      aria-label="Cinema 2.0 workspace"
      data-cinema2-stage="runtime"
      data-runtime-phase={runtimeSnapshot?.phase ?? 'initializing'}
      data-runtime-available={runtimeSnapshot?.phase === 'unavailable' ? 'false' : 'true'}
    >
      <canvas
        ref={canvasRef}
        className="rv-cinema2-canvas"
        data-cinema2-output-canvas="true"
        aria-label="Cinema 2.0 live output"
      />
      {message && (
        <div className="rv-cinema2-runtime-status" role="status" aria-live="polite">
          <strong>Cinema 2.0</strong>
          <span>{message}</span>
        </div>
      )}
    </section>
  )
}
