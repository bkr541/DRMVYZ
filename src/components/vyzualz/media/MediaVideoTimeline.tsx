import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react'
import { generateVideoFilmstrip, MAX_FILMSTRIP_FRAMES } from './generateThumbnail'
import {
  TRACK_MAP_BEAT_COLOR,
  TRACK_MAP_BEAT_LINE_WIDTH,
  TRACK_MAP_BEAT_TICK_HEIGHT,
  TRACK_MAP_DOWNBEAT_COLOR,
  TRACK_MAP_DOWNBEAT_LINE_WIDTH,
  TRACK_MAP_DOWNBEAT_TICK_HEIGHT,
} from '../react/ReactTrackMapStrip'
import { clampSec, fmtTimelineLabel, rulerTickInterval } from '../timeline/tlHelpers'
import type { DropPoint } from '../../../stores/dropPointPreviewStore'

// A full-length timeline for one video in Media Manager: a Track Map-style
// ruler (0:00 → duration; its ticks and numbers are the Track Map's beat-marker and ruler styling, read from the
// Track Map's own constants: whole seconds take the downbeat treatment, the divisions between them the regular-beat one), a strip of frames sampled across the whole video and
// a playhead. Clicking or dragging anywhere on it seeks. Presentation only —
// playback state stays owned by the stage that renders it.

interface MediaVideoTimelineProps {
  /** Stable media identity used for the filmstrip cache (never the signed URL). */
  mediaId: string
  src: string
  duration: number
  currentTime: number
  onSeek: (timeSec: number) => void
  /** Drop Points to mark on the timeline (preview only). */
  dropPoints?: readonly DropPoint[]
  selectedDropPointId?: string | null
  onSelectDropPoint?: (id: string) => void
  /** Right-click: the time under the pointer, and the Drop Point it landed on (if any). */
  onRequestMenu?: (request: { x: number; y: number; timeSec: number; dropPointId: string | null }) => void
}

const SEEK_STEP_SEC = 1

export function MediaVideoTimeline({ mediaId, src, duration, currentTime, onSeek, dropPoints = [], selectedDropPointId = null, onSelectDropPoint, onRequestMenu }: MediaVideoTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const laneRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [width, setWidth] = useState(0)
  const [frames, setFrames] = useState<string[]>([])

  const total = Number.isFinite(duration) && duration > 0 ? duration : 0

  useEffect(() => {
    const node = laneRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0))
    observer.observe(node)
    setWidth(node.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  // Frames sampled across the whole video; missing frames (CORS, decode failure) leave a plain strip.
  useEffect(() => {
    setFrames([])
    if (!src || total <= 0) return
    let cancelled = false
    generateVideoFilmstrip(src, MAX_FILMSTRIP_FRAMES, 0, undefined, `media-manager:${mediaId}`)
      .then(result => { if (!cancelled) setFrames(result) })
      .catch(() => { if (!cancelled) setFrames([]) })
    return () => { cancelled = true }
  }, [mediaId, src, total])

  const pxPerSec = total > 0 && width > 0 ? width / total : 0
  const { ticks, minorTicks } = buildRulerTicks(total, pxPerSec)

  const percent = (t: number) => (total > 0 ? `${(clampSec(t, 0, total) / total) * 100}%` : '0%')

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = laneRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || total <= 0) return
    onSeek(clampSec(((event.clientX - rect.left) / rect.width) * total, 0, total))
  }

  const openMenu = (event: ReactMouseEvent<HTMLElement>, dropPointId: string | null) => {
    if (!onRequestMenu) return
    event.preventDefault()
    event.stopPropagation()
    const rect = laneRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || total <= 0) return
    const point = dropPointId ? dropPoints.find(candidate => candidate.id === dropPointId) : null
    const timeSec = point ? point.timeSec : clampSec(((event.clientX - rect.left) / rect.width) * total, 0, total)
    onRequestMenu({ x: event.clientX, y: event.clientY, timeSec, dropPointId })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (total <= 0) return
    const step = event.shiftKey ? SEEK_STEP_SEC * 5 : SEEK_STEP_SEC
    if (event.key === 'ArrowRight') onSeek(clampSec(currentTime + step, 0, total))
    else if (event.key === 'ArrowLeft') onSeek(clampSec(currentTime - step, 0, total))
    else if (event.key === 'Home') onSeek(0)
    else if (event.key === 'End') onSeek(total)
    else return
    event.preventDefault()
  }

  return (
    <div className="mmt-timeline">
      <div
        ref={trackRef}
        className="mmt-track"
        role="slider"
        tabIndex={0}
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(total * 100) / 100}
        aria-valuenow={Math.round(clampSec(currentTime, 0, total || currentTime) * 100) / 100}
        aria-valuetext={`${fmtTimelineLabel(currentTime)} of ${fmtTimelineLabel(total)}`}
        onKeyDown={handleKeyDown}
        onContextMenu={event => openMenu(event, null)}
        onPointerDown={event => {
          if (event.button !== 0) return
          draggingRef.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          seekFromPointer(event)
        }}
        onPointerMove={event => { if (draggingRef.current) seekFromPointer(event) }}
        onPointerUp={event => {
          draggingRef.current = false
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => { draggingRef.current = false }}
      >
        <div ref={laneRef} className="mmt-inner">
          <div className="mmt-ruler" aria-hidden="true">
            {minorTicks.map(t => (
              <span
                key={`m${t}`}
                className="mmt-tick mmt-tick--minor"
                style={{ left: percent(t), width: TRACK_MAP_BEAT_LINE_WIDTH, height: TRACK_MAP_BEAT_TICK_HEIGHT, background: TRACK_MAP_BEAT_COLOR }}
              />
            ))}
            {ticks.map(t => (
              <span
                key={t}
                className={`mmt-tick mmt-tick--major${t === 0 ? ' mmt-tick--start' : ''}${t === total ? ' mmt-tick--end' : ''}`}
                style={{ left: percent(t), width: TRACK_MAP_DOWNBEAT_LINE_WIDTH, height: TRACK_MAP_DOWNBEAT_TICK_HEIGHT, background: TRACK_MAP_DOWNBEAT_COLOR }}
              >
                <span className="mmt-tick-label">{t === total ? formatEndLabel(t) : formatRulerLabel(t)}</span>
              </span>
            ))}
          </div>
          <div className="mmt-strip" aria-hidden="true">
            {frames.map((frame, index) => (
              <span key={index} className="mmt-frame" style={{ backgroundImage: `url(${frame})` }} />
            ))}
            {ticks.map(t => <span key={`g${t}`} className="mmt-gridline" style={{ left: percent(t) }} />)}
          </div>
          {dropPoints.map(point => (
            <span
              key={point.id}
              className={`mmt-dropmark${point.id === selectedDropPointId ? ' is-selected' : ''}`}
              style={{ left: percent(point.timeSec) }}
            >
              <button
                type="button"
                className="mmt-dropmark-flag"
                aria-label={`${point.name} at ${fmtTimelineLabel(point.timeSec)}`}
                title={point.name}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onSelectDropPoint?.(point.id); onSeek(point.timeSec) }}
                onContextMenu={event => openMenu(event, point.id)}
              />
            </span>
          ))}
          <span className="mmt-playhead" style={{ left: percent(currentTime) }} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

/** Whole-number ruler ticks (labelled) and the quarter divisions between them, for a timeline `total` seconds long drawn at `pxPerSec`. */
export function buildRulerTicks(total: number, pxPerSec: number): { ticks: number[]; minorTicks: number[] } {
  const interval = pxPerSec > 0 ? rulerTickInterval(total, pxPerSec) : 0
  const ticks: number[] = []
  if (interval > 0) {
    for (let t = 0; t <= total + 1e-6; t += interval) ticks.push(t)
    // The last labelled tick sits on the very end of the media (the right edge of the timeline) instead of a
    // rounded second short of it, so the strip never appears to run on past the final tick.
    while (ticks.length > 1 && (total - ticks[ticks.length - 1]!) * pxPerSec < 48) ticks.pop()
    ticks.push(total)
  }
  const minorInterval = interval / 4
  const minorTicks: number[] = []
  if (interval > 0 && minorInterval * pxPerSec >= 6) {
    for (let t = 0; t <= total + 1e-6; t += minorInterval) if (Math.abs(t / interval - Math.round(t / interval)) > 1e-6) minorTicks.push(t)
  }
  return { ticks, minorTicks }
}

/** 0:00 style ruler labels (the shared helper switches to "5s" below a minute, which reads oddly next to 0:00). */
export function formatRulerLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** The end of the video is rarely a whole second, so its label carries a tenth (0:05.9) rather than repeating the last whole-second tick. */
export function formatEndLabel(sec: number): string {
  const tenths = Math.round(sec * 10) / 10
  return Number.isInteger(tenths) ? formatRulerLabel(tenths) : `${formatRulerLabel(Math.floor(tenths))}.${Math.round((tenths % 1) * 10)}`
}
