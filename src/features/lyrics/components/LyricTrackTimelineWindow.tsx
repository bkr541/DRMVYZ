import { useEffect, useMemo, useRef, type KeyboardEventHandler, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { BeatMarkerMI } from '../../musicIntelligence/types'
import type { ReactTrackSection } from '../../../components/vyzualz/react/ReactTypes'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import {
  drawBeatGridCanvas,
  drawTimelineRuler,
  SECTION_COLORS,
} from '../../../components/vyzualz/react/ReactTrackMapStrip'
import { clientXToTimelineTime, computeViewportRangeLayout, computeWaveformViewport, timeToViewportRatio } from '../../timeline/timelineViewport'
import { LyricWaveformCanvas } from '../editor/LyricWaveformCanvas'
import type { LyricBeatGridStatus } from '../editor/lyricCueEditorModel'

interface Props {
  durationMs: number
  currentTimeMs: number | null
  getCurrentTimeMs?: () => number | null
  zoom: number
  sections: ReactTrackSection[]
  beatGrid: BeatMarkerMI[]
  trackId: string | null
  trackUrl: string | null
  decodedBuffer?: AudioBuffer | null
  waveformPeaks: number[] | null
  waveformLoading: boolean
  beatGridStatus: LyricBeatGridStatus
  beatGridStatusMessage: string | null
  onAnalyzeTrack?: () => void
  analysisActionLabel?: string
  /** Seeks the deck (milliseconds). Clicking or dragging any reference lane scrubs through it. */
  onSeek?: (timeMs: number) => void
  /** Wheel zoom over the lanes. */
  onZoomChange?: (zoom: number) => void
  /** Cue editing actions: their own right-aligned row beneath the heading. */
  actions?: ReactNode
  /** Timeline controls rendered directly below the lanes (see LyricTimelineToolbar). */
  toolbar?: ReactNode
  cueTimeline?: ReactNode
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}

/** Track Section row: read-only, presentational — reuses Track Map's own
 * `.rv-section-region`/`.rv-section-color-bar` classes/colors so it's
 * pixel-consistent with Track Map without duplicating its stateful
 * section-editing component (section editing already lives there). */
function TrackSectionRow({ sections, viewport }: { sections: ReactTrackSection[]; viewport: { startSec: number; endSec: number } }) {
  return (
    <div className="lmv-track-timeline-lane-content">
      {sections.map(section => {
        const layout = computeViewportRangeLayout(section, viewport)
        if (!layout.visible) return null
        const color = SECTION_COLORS[section.type] ?? '#6a7a8a'
        return (
          <div
            key={section.id}
            className="rv-section-region"
            style={{ left: `${layout.leftPct}%`, width: `${layout.widthPct}%`, position: 'absolute', top: 0, bottom: 0, '--section-color': color } as React.CSSProperties}
            title={section.label}
          >
            {/* Same header/bar structure as Track Map's section body; the clipping wrapper is what keeps a long
                label inside its own section instead of running across the next one. */}
            <div className="lmv-track-timeline-section-body">
              <div className="rv-section-header">
                <span className="rv-section-label">{section.label.toUpperCase()}</span>
              </div>
              <span className="rv-section-color-bar" aria-hidden="true" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Beat Grid row: calls Track Map's own exported `drawBeatGridCanvas`
 * directly for pixel-exact tick colors/heights/stride-thinning. */
function BeatGridRow({ beatGrid, durationSec, viewport }: { beatGrid: BeatMarkerMI[]; durationSec: number; viewport: { startSec: number; endSec: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => drawBeatGridCanvas(canvas, beatGrid, durationSec, viewport)
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [beatGrid, durationSec, viewport])

  return (
    <div className="lmv-track-timeline-lane-content">
      <canvas ref={canvasRef} className="lmv-track-timeline-beat-canvas" aria-hidden="true" />
    </div>
  )
}

/** Timing row: calls Track Map's own exported `drawTimelineRuler` directly. */
function TimingRow({ viewport }: { viewport: { startSec: number; endSec: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => drawTimelineRuler(canvas, viewport, 7)
    draw()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [viewport])

  return (
    <div className="lmv-track-timeline-lane-content lmv-track-timeline-lane-content--ruler">
      <canvas ref={canvasRef} className="lmv-track-timeline-ruler-canvas" aria-hidden="true" />
    </div>
  )
}

/**
 * "Track Timeline" window: Beat Grid / Timing / Track Section / Waveform
 * rows, visually mirroring Track Map's row heights/colors/fonts (see
 * lyricManager.css .lmv-track-timeline-* rules). All four rows share one
 * viewport computed the same way LyricCueTimeline/Track Map compute theirs,
 * so this window and the Lyric Cues window below it stay pixel-aligned as
 * long as their container widths match.
 */
export function LyricTrackTimelineWindow({
  durationMs,
  currentTimeMs,
  getCurrentTimeMs,
  zoom,
  sections,
  beatGrid,
  waveformPeaks,
  waveformLoading,
  beatGridStatus,
  beatGridStatusMessage,
  onAnalyzeTrack,
  analysisActionLabel = 'Analyze Track',
  onSeek,
  onZoomChange,
  actions,
  toolbar,
  cueTimeline,
  onKeyDown,
}: Props) {
  const lanesRef = useRef<HTMLDivElement>(null)
  const playheadLayerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const scrubRef = useRef(false)
  const durationSec = Math.max(1, durationMs / 1000)
  const currentSec = Math.max(0, (getCurrentTimeMs?.() ?? currentTimeMs ?? 0) / 1000)
  const viewport = useMemo(
    () => computeWaveformViewport(durationSec, currentSec, Math.max(1, zoom)),
    [durationSec, currentSec, zoom],
  )
  const live = useRef({ viewport, durationSec, zoom, onZoomChange, getCurrentTimeMs, currentTimeMs })
  live.current = { viewport, durationSec, zoom, onZoomChange, getCurrentTimeMs, currentTimeMs }

  // Playhead across every lane. With a live clock it follows every frame without re-rendering.
  const hasLiveClock = Boolean(getCurrentTimeMs)
  useEffect(() => {
    const update = () => {
      const layer = playheadLayerRef.current
      const playhead = playheadRef.current
      if (!layer || !playhead) return
      const { viewport: vp, durationSec: dur, getCurrentTimeMs: getMs, currentTimeMs: ms } = live.current
      const sec = Math.max(0, Math.min(dur, (getMs?.() ?? ms ?? 0) / 1000))
      const ratio = timeToViewportRatio(sec, vp)
      playhead.hidden = ratio < 0 || ratio > 1
      playhead.style.transform = `translateX(${Math.max(0, Math.min(1, ratio)) * layer.clientWidth}px)`
    }
    update()
    if (!hasLiveClock) return
    let frame = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      update()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      mounted = false
      cancelAnimationFrame(frame)
    }
  }, [hasLiveClock, viewport, currentTimeMs])

  // Mouse wheel over the lanes zooms (a native non-passive listener, so the page does not scroll as well).
  useEffect(() => {
    const lanes = lanesRef.current
    if (!lanes) return
    const onWheel = (event: WheelEvent) => {
      const { onZoomChange: setZoom, zoom: current } = live.current
      if (!setZoom || event.deltaY === 0) return
      event.preventDefault()
      const next = current * Math.exp(-event.deltaY * 0.0025)
      setZoom(Math.min(16, Math.max(1, Math.round(next * 100) / 100)))
    }
    lanes.addEventListener('wheel', onWheel, { passive: false })
    return () => lanes.removeEventListener('wheel', onWheel)
  }, [])

  const seekFromPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const layer = playheadLayerRef.current
    if (!layer || !onSeek) return
    const { viewport: vp, durationSec: dur } = live.current
    onSeek(Math.round(clientXToTimelineTime(event.clientX, layer.getBoundingClientRect(), vp, dur) * 1000))
  }
  const onReferencePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    scrubRef.current = true
    seekFromPointer(event)
  }
  const onReferencePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (scrubRef.current) seekFromPointer(event)
  }
  const endScrub = () => { scrubRef.current = false }
  const beatGridHint = beatGridStatus === 'trusted'
    ? null
    : beatGridStatusMessage ?? (beatGrid.length >= 2
      ? 'Beat snapping is using a temporary BPM grid. Run analysis to replace it with detected beats.'
      : 'Beat snapping unavailable. Load or analyze this track to build a beat grid.')

  // Rows read top to bottom: time ruler, beat grid, sections, audio, lyric lanes. Each row has a
  // fixed label gutter and a content area; every content area measures its own width, so they stay aligned.
  const lane = (className: string, label: string | null, content: ReactNode) => (
    <div className={`lmv-track-timeline-lane ${className}`}>
      <span className="lmv-track-timeline-lane-label" aria-hidden="true">{label}</span>
      <div className="lmv-track-timeline-lane-body">{content}</div>
    </div>
  )

  return (
    <section className="lmv-track-timeline-window" aria-label="Track Timeline" onKeyDown={onKeyDown}>
      <DualRailCollapsible label="Track Timeline" headerClassName="lmv-live-preview-header">
        {actions}
        <div ref={lanesRef} className="lmv-track-timeline-lanes lmv-track-timeline-lanes--stacked">
          <div
            className="lmv-track-timeline-reference-lanes"
            onPointerDown={onReferencePointerDown}
            onPointerMove={onReferencePointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
          >
            {lane('lmv-track-timeline-lane--timing', null, <TimingRow viewport={viewport} />)}
            {lane('lmv-track-timeline-lane--beatgrid', 'Beats', <BeatGridRow beatGrid={beatGrid} durationSec={durationSec} viewport={viewport} />)}
            {lane('lmv-track-timeline-lane--section', null, <TrackSectionRow sections={sections} viewport={viewport} />)}
            {lane('lmv-track-timeline-lane--waveform', 'Audio', (
              <LyricWaveformCanvas
                peaks={waveformPeaks}
                loading={waveformLoading}
                durationSec={durationSec}
                currentTimeSec={currentSec}
                viewport={viewport}
              />
            ))}
          </div>
          {cueTimeline && <div className="lmv-track-timeline-cue-lanes">{cueTimeline}</div>}
          <div ref={playheadLayerRef} className="lmv-track-timeline-playhead-layer" aria-hidden="true">
            <div ref={playheadRef} className="lyric-cue-timeline__playhead" data-testid="lyric-playhead" />
          </div>
        </div>
        {beatGridHint && (
          <div className="lmv-track-timeline-hint">
            <span>{beatGridHint}</span>
            {onAnalyzeTrack && beatGridStatus !== 'analyzing' && (
              <button type="button" className="lmv-inline-action" onClick={onAnalyzeTrack}>{analysisActionLabel}</button>
            )}
          </div>
        )}
        {toolbar}
      </DualRailCollapsible>
    </section>
  )
}
