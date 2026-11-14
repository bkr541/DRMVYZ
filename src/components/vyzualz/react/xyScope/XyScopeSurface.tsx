import { useEffect, useRef, useState } from 'react'
import type { StereoScopeAudioTap } from '../../../../audio/scope/StereoScopeAudioTap'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump } from '../../../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { useReactStore } from '../../../../stores/reactStore'
import type { ReactTrackSection } from '../ReactTypes'
import { XyScopeRuntime } from './XyScopeRuntime'
import { useXyScopeFont } from './XyScopeFontLibrary'
import { useXyScopeSvg } from './useXyScopeSvg'
import { DrawerNotice } from '../../shared/DrawerNotice'
import { XyScopeTransportTracker } from './XyScopeTransport'

/** Samples read from the stereo tap each frame; matches the scope window the runtime expects. */
const STEREO_READ_FRAMES = 2048
/** Publisher id for the frames this surface pumps into the shared audio path. */
export const XY_SCOPE_PUBLISHER_ID = 'react:xyScope'

export interface XyScopeAudioInput {
  /** Fresh audio-clock time in seconds. */
  getAudioTime?: () => number
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: ReactTrackSection[]
  trackIdentity?: string | null
  durationSec?: number
}

export function XyScopeSurface({
  onCanvasReady,
  onLiveFps,
  audio,
  analyser = null,
  isPlaying = false,
  isPaused = false,
  analysisActive,
  scopeStereoTap = null,
}: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  audio?: XyScopeAudioInput
  /**
   * The master analyser. Like PixGrid and Cinema 2.0, this surface owns the analysis pump while it is the active
   * engine: it feeds the one shared Music Intelligence engine, so kicks, beats and bars exist for it to read.
   */
  analyser?: AnalyserNode | null
  isPlaying?: boolean
  isPaused?: boolean
  /** Live Input analysis is the performance and counts as playing. */
  analysisActive?: boolean
  scopeStereoTap?: StereoScopeAudioTap | null
}) {
  const hostRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = useRef<XyScopeRuntime | null>(null)
  const settings = useReactStore(state => state.xyScopeSettings)
  const resolution = useXyScopeFont(settings.sourceMode === 'text' ? settings.fontId : null)
  const svg = useXyScopeSvg(settings.svgMediaId, settings.sourceMode === 'svg')
  const [scopeSource, setScopeSource] = useState<'stereo' | 'fallback'>('fallback')

  const inputRef = useRef({ audio, scopeStereoTap, onLiveFps, analyser, isPlaying, isPaused, analysisActive })
  inputRef.current = { audio, scopeStereoTap, onLiveFps, analyser, isPlaying, isPaused, analysisActive }
  const settingsRef = useRef({ settings, font: resolution.font, svg: svg.source })
  settingsRef.current = { settings, font: resolution.font, svg: svg.source }

  // Settings and font changes reach the runtime without recreating it, so the trail survives slider drags.
  useEffect(() => {
    runtimeRef.current?.setSettings(settings, resolution.font, svg.source)
  }, [settings, resolution.font, svg.source])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const runtime = new XyScopeRuntime(canvas)
    runtimeRef.current = runtime
    runtime.setSettings(settingsRef.current.settings, settingsRef.current.font, settingsRef.current.svg)
    const pump = new MusicIntelligenceAnalyserFramePump({ publisherId: XY_SCOPE_PUBLISHER_ID })
    const transport = new XyScopeTransportTracker()

    const measure = () => {
      const rect = host.getBoundingClientRect()
      runtime.resize(rect.width, rect.height, window.devicePixelRatio || 1)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(host)

    let previousContext: SharedPerformanceContext | null = null
    let context: SharedPerformanceContext | null = null
    let lastFrameId = -1
    let raf = 0
    let fpsFrames = 0
    let fpsStart = performance.now()
    let statusTick = 0

    const loop = (timestamp: number) => {
      raf = requestAnimationFrame(loop)
      const current = inputRef.current
      const audioInput = current.audio
      const identity = audioInput?.trackIdentity ?? null
      const rawTime = audioInput?.getAudioTime?.()
      const audioTime = typeof rawTime === 'number' && Number.isFinite(rawTime) ? Math.max(0, rawTime) : AudioFeatureBus.getFrame().timeSec

      // The music is "active" for reactivity when analysis runs and the transport is not paused; the clock runs
      // only while it is playing. Live Input has no file transport but its analysis is the performance.
      const reactivityActive = (current.analysisActive ?? current.isPlaying) && !current.isPaused
      const clockActive = (current.isPlaying && !current.isPaused) || reactivityActive
      const state = transport.update({ audioTime, clockActive, wallMs: performance.now(), durationSec: audioInput?.durationSec ?? 0, trackIdentity: identity })
      if (state.trackChanged) {
        // A new track starts from rest: no carried-over pattern, dissolve or trail.
        runtime.reset()
        previousContext = null
        context = null
        lastFrameId = -1
      }

      // Publish this frame's analysis to the shared Music Intelligence engine, as every renderer-owned loop does.
      const frame = current.analyser
        ? pump.sample({ analyser: current.analyser, audioTime, isPlaying: reactivityActive, trackIdentity: identity })
        : AudioFeatureBus.getFrame()
      const fresh = frame.frameId !== lastFrameId
      lastFrameId = frame.frameId
      if (fresh || state.discontinuity) {
        context = buildSharedPerformanceContext({
          audioTimeSec: audioTime,
          frame,
          analysis: audioInput?.trackAnalysis ?? null,
          resolvedSections: audioInput?.trackSections ?? frame.resolvedSections ?? [],
          durationSec: audioInput?.durationSec,
          trackIdentity: identity ?? frame.trackId ?? frame.sourceId,
          seekIdentity: state.seekIdentity,
          loopIdentity: state.loopIdentity,
          timingDiscontinuityIdentity: state.timingIdentity,
          previous: previousContext,
        })
        previousContext = context
      }
      const stereo = current.scopeStereoTap?.readLatest(STEREO_READ_FRAMES, audioTime) ?? null
      runtime.renderFrame({ nowSec: timestamp / 1000, context, fresh: fresh || state.discontinuity, stereo, playing: clockActive })

      fpsFrames += 1
      const elapsed = timestamp - fpsStart
      if (elapsed >= 1000) {
        current.onLiveFps?.(Math.round(fpsFrames * 1000 / elapsed))
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
      pump.dispose()
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
      data-xyscope-source={settings.sourceMode}
      data-xyscope-svg-status={svg.status}
    >
      {settings.sourceMode === 'svg' && svg.status === 'empty' && <div className="rv-xyscope-note rv-xyscope-note--top" role="status">Choose an uploaded SVG in the Input group.</div>}
      {settings.sourceMode === 'svg' && svg.status === 'loading' && <div className="rv-xyscope-note rv-xyscope-note--top" role="status">Loading SVG…</div>}
      {settings.sourceMode === 'svg' && svg.error && <>
        <div className="rv-xyscope-note rv-xyscope-note--top" role="alert">{svg.error}</div>
        <DrawerNotice tone="error" title="Sound Drawing XY SVG">{svg.error}</DrawerNotice>
      </>}
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
