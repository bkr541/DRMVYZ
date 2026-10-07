import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from 'react'
import {
  TRACK_MAP_BEAT_COLOR,
  TRACK_MAP_BEAT_LINE_WIDTH,
  TRACK_MAP_BEAT_TICK_HEIGHT,
  TRACK_MAP_DOWNBEAT_COLOR,
  TRACK_MAP_DOWNBEAT_LINE_WIDTH,
  TRACK_MAP_DOWNBEAT_TICK_HEIGHT,
} from '../react/ReactTrackMapStrip'
import { clampSec, fmtTimelineLabel } from '../timeline/tlHelpers'
import { buildRulerTicks, formatEndLabel, formatRulerLabel } from './MediaVideoTimeline'
import type { TriggerDropPoint } from '../../../stores/triggerDropPointPreviewStore'

// A full-length timeline for one audio track in Media Manager: the same Track Map-style ruler as the video timeline over
// the track's waveform, with a playhead and the Trigger Drop Point markers. Clicking or dragging seeks; right-click opens
// the marker menu. Presentation only — playback state stays owned by the stage that renders it.

interface MediaAudioTimelineProps {
  duration: number
  currentTime: number
  peaks: readonly number[] | null
  onSeek: (timeSec: number) => void
  triggers?: readonly TriggerDropPoint[]
  selectedTriggerId?: string | null
  onSelectTrigger?: (id: string) => void
  onRequestMenu?: (request: { x: number; y: number; timeSec: number; triggerId: string | null }) => void
}

const SEEK_STEP_SEC = 1
const WAVE_COLOR = 'rgba(74, 199, 219, 0.78)'
const WAVE_PAD = 8

export function MediaAudioTimeline({
  duration,
  currentTime,
  peaks,
  onSeek,
  triggers = [],
  selectedTriggerId = null,
  onSelectTrigger,
  onRequestMenu,
}: MediaAudioTimelineProps) {
  const laneRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  const [width, setWidth] = useState(0)

  const total = Number.isFinite(duration) && duration > 0 ? duration : 0

  useEffect(() => {
    const node = laneRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0))
    observer.observe(node)
    setWidth(node.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  // The waveform: one mirrored bar per pixel column, the loudest peak that column covers.
  useEffect(() => {
    const canvas = waveRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || width <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const avail = height - WAVE_PAD * 2
    ctx.fillStyle = WAVE_COLOR
    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fillRect(0, height / 2 - 0.5, width, 1)
      return
    }
    const perColumn = peaks.length / width
    for (let x = 0; x < width; x++) {
      const from = Math.floor(x * perColumn)
      const to = Math.max(from + 1, Math.floor((x + 1) * perColumn))
      let peak = 0
      for (let i = from; i < to && i < peaks.length; i++) peak = Math.max(peak, peaks[i] ?? 0)
      const barHeight = Math.max(1, peak * avail)
      ctx.fillRect(x, WAVE_PAD + (avail - barHeight) / 2, 1, barHeight)
    }
  }, [peaks, width])

  const pxPerSec = total > 0 && width > 0 ? width / total : 0
  const { ticks, minorTicks } = buildRulerTicks(total, pxPerSec)
  const percent = (t: number) => (total > 0 ? `${(clampSec(t, 0, total) / total) * 100}%` : '0%')

  const timeAt = (clientX: number): number | null => {
    const rect = laneRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || total <= 0) return null
    return clampSec(((clientX - rect.left) / rect.width) * total, 0, total)
  }

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const time = timeAt(event.clientX)
    if (time !== null) onSeek(time)
  }

  const openMenu = (event: ReactMouseEvent<HTMLElement>, triggerId: string | null) => {
    if (!onRequestMenu) return
    event.preventDefault()
    event.stopPropagation()
    const trigger = triggerId ? triggers.find(candidate => candidate.id === triggerId) : null
    const timeSec = trigger ? trigger.timeSec : timeAt(event.clientX)
    if (timeSec === null) return
    onRequestMenu({ x: event.clientX, y: event.clientY, timeSec, triggerId })
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
        className="mmt-track"
        role="slider"
        tabIndex={0}
        aria-label="Audio timeline"
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
          <div className="mmt-strip mmt-strip--wave" aria-hidden="true">
            <canvas ref={waveRef} className="mmt-wave" />
            {ticks.map(t => <span key={`g${t}`} className="mmt-gridline" style={{ left: percent(t) }} />)}
          </div>
          {triggers.map(trigger => (
            <span
              key={trigger.id}
              className={`mmt-dropmark mmt-dropmark--trigger${trigger.id === selectedTriggerId ? ' is-selected' : ''}`}
              style={{ left: percent(trigger.timeSec) }}
            >
              <button
                type="button"
                className="mmt-dropmark-flag"
                aria-label={`${trigger.name} at ${fmtTimelineLabel(trigger.timeSec)}`}
                title={trigger.name}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onSelectTrigger?.(trigger.id); onSeek(trigger.timeSec) }}
                onContextMenu={event => openMenu(event, trigger.id)}
              />
            </span>
          ))}
          <span className="mmt-playhead" style={{ left: percent(currentTime) }} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
