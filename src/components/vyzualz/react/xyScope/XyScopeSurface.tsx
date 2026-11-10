import { useEffect, useRef, useState } from 'react'
import type { StereoScopeAudioTap } from '../../../../audio/scope/StereoScopeAudioTap'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { useReactStore } from '../../../../stores/reactStore'
import type { ReactTrackSection } from '../ReactTypes'
import { XyScopeRuntime } from './XyScopeRuntime'
import { useXyScopeFont } from './XyScopeFontLibrary'

/** Samples read from the stereo tap each frame; matches the scope window the runtime expects. */
const STEREO_READ_FRAMES = 2048

export interface XyScopeAudioInput {
  /** Fresh audio-clock time in seconds. */
  getAudioTime?: () => number
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: ReactTrackSection[]
  trackIdentity?: string | null
}

export function XyScopeSurface({
  onCanvasReady,
  onLiveFps,
  audio,
  scopeStereoTap = null,
}: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  audio?: XyScopeAudioInput
  scopeStereoTap?: StereoScopeAudioTap | null
}) {
  const hostRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = useRef<XyScopeRuntime | null>(null)
  const settings = useReactStore(state => state.xyScopeSettings)
  const resolution = useXyScopeFont(settings.fontId)
  const [scopeSource, setScopeSource] = useState<'stereo' | 'fallback'>('fallback')

  const inputRef = useRef({ audio, scopeStereoTap, onLiveFps })
  inputRef.current = { audio, scopeStereoTap, onLiveFps }
  const settingsRef = useRef({ settings, font: resolution.font })
  settingsRef.current = { settings, font: resolution.font }

  // Settings and font changes reach the runtime without recreating it, so the trail survives slider drags.
  useEffect(() => {
    runtimeRef.current?.setSettings(settings, resolution.font)
  }, [settings, resolution.font])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const runtime = new XyScopeRuntime(canvas)
    runtimeRef.current = runtime
    runtime.setSettings(settingsRef.current.settings, settingsRef.current.font)

    const measure = () => {
      const rect = host.getBoundingClientRect()
      runtime.resize(rect.width, rect.height, window.devicePixelRatio || 1)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(host)

    let previousContext: SharedPerformanceContext | null = null
    let lastFrameId = -1
    let lastTrackIdentity: string | null = null
    let raf = 0
    let fpsFrames = 0
    let fpsStart = performance.now()
    let statusTick = 0

    const loop = (timestamp: number) => {
      raf = requestAnimationFrame(loop)
      const { audio: audioInput, scopeStereoTap: tap, onLiveFps: report } = inputRef.current
      const frame = AudioFeatureBus.getFrame()
      const audioTimeSec = audioInput?.getAudioTime?.() ?? frame.timeSec
      const identity = audioInput?.trackIdentity ?? 'xyScope:unloaded-track'
      if (identity !== lastTrackIdentity) {
        // A new track starts from rest: no carried-over dissolve or trail.
        if (lastTrackIdentity !== null) runtime.reset()
        lastTrackIdentity = identity
        previousContext = null
      }
      const fresh = frame.frameId !== lastFrameId
      lastFrameId = frame.frameId
      let context = previousContext
      if (fresh) {
        context = buildSharedPerformanceContext({
          audioTimeSec: Number.isFinite(audioTimeSec) && audioTimeSec >= 0 ? audioTimeSec : 0,
          frame,
          analysis: audioInput?.trackAnalysis ?? null,
          resolvedSections: audioInput?.trackSections ?? [],
          trackIdentity: identity,
          trackChangeIdentity: `track:${identity}`,
          previous: previousContext,
        })
        previousContext = context
      }
      const stereo = tap?.readLatest(STEREO_READ_FRAMES, audioTimeSec) ?? null
      runtime.renderFrame({ nowSec: timestamp / 1000, context, fresh, stereo })

      fpsFrames += 1
      const elapsed = timestamp - fpsStart
      if (elapsed >= 1000) {
        report?.(Math.round(fpsFrames * 1000 / elapsed))
        fpsFrames = 0
        fpsStart = timestamp
        statusTick += 1
        if (statusTick % 2 === 0) setScopeSource(runtime.getStatus().scopeSource)
      }
    }
    raf = requestAnimationFrame(loop)
    onCanvasReady?.(canvas)
    onLiveFps?.(0)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      runtime.dispose()
      runtimeRef.current = null
      onCanvasReady?.(null)
    }
  }, [onCanvasReady, onLiveFps])

  return (
    <section
      ref={hostRef}
      className="rv-xyscope-surface"
      aria-label="Sound Drawing XY workspace"
      data-xyscope-surface="true"
      data-xyscope-scope-source={scopeSource}
      data-xyscope-font-status={resolution.status}
    >
      <canvas ref={canvasRef} className="rv-xyscope-canvas" data-xyscope-output-canvas="true" />
      {scopeSource === 'fallback' && audio?.trackIdentity && (
        <div className="rv-xyscope-note" role="status">
          No live stereo signal: dissolves use a stand-in figure instead of the track.
        </div>
      )}
      {resolution.status === 'loading' && settings.fontId && (
        <div className="rv-xyscope-note rv-xyscope-note--top" role="status">Loading font…</div>
      )}
      {(resolution.status === 'error' || resolution.status === 'missing') && (
        <div className="rv-xyscope-note rv-xyscope-note--top" role="alert">
          {resolution.error ?? 'The font could not be loaded.'} Showing {resolution.label}.
        </div>
      )}
    </section>
  )
}
