import { useEffect, useMemo, useRef, type KeyboardEventHandler, type ReactNode } from 'react'
import type { BeatMarkerMI } from '../../musicIntelligence/types'
import type { ReactTrackSection } from '../../../components/vyzualz/react/ReactTypes'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import {
  drawBeatGridCanvas,
  drawTimelineRuler,
  SECTION_COLORS,
} from '../../../components/vyzualz/react/ReactTrackMapStrip'
import { computeViewportRangeLayout, computeWaveformViewport } from '../../timeline/timelineViewport'
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
  /** Timeline controls rendered directly above the lanes (see LyricTimelineToolbar). */
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
  toolbar,
  cueTimeline,
  onKeyDown,
}: Props) {
  const durationSec = Math.max(1, durationMs / 1000)
  const currentSec = Math.max(0, (getCurrentTimeMs?.() ?? currentTimeMs ?? 0) / 1000)
  const viewport = useMemo(
    () => computeWaveformViewport(durationSec, currentSec, Math.max(1, zoom)),
    [durationSec, currentSec, zoom],
  )
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
        <div className="lmv-track-timeline-lanes lmv-track-timeline-lanes--stacked">
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
          {cueTimeline && <div className="lmv-track-timeline-cue-lanes">{cueTimeline}</div>}
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
