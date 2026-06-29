import { useCallback, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { LyricCue } from '../../../types/lyrics'
import {
  getCueIssues,
  isCueActive,
  moveCueToStart,
  normalizeCueBounds,
  resizeCueEnd,
  resizeCueStart,
  snapTimeMs,
  type CueBounds,
  type LyricSnapContext,
} from './lyricCueEditorModel'
import { LyricWaveformCanvas } from './LyricWaveformCanvas'

export type LyricCueDragKind = 'move' | 'resize-start' | 'resize-end'

interface DragState {
  cue: LyricCue
  kind: LyricCueDragKind
  startClientX: number
}

interface Props {
  cues: LyricCue[]
  selectedCueId: string | null
  currentTimeMs: number | null
  durationMs: number
  pxPerSecond: number
  globalOffsetMs?: number
  compact?: boolean
  waveformPeaks?: number[] | null
  waveformLoading?: boolean
  snapContext: LyricSnapContext
  onSelectCue: (cueId: string | null) => void
  onSeek: (timeMs: number) => void
  onCommitCue: (cueId: string, bounds: CueBounds) => void
  onDeleteCue?: (cueId: string) => void
}

function keyboardDelta(event: ReactKeyboardEvent): number {
  if (event.altKey) return 1
  if (event.shiftKey) return 100
  return 10
}

function formatTimelineMs(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const millis = safe % 1_000
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

export function LyricCueTimeline({
  cues,
  selectedCueId,
  currentTimeMs,
  durationMs,
  pxPerSecond,
  globalOffsetMs = 0,
  compact = false,
  waveformPeaks = null,
  waveformLoading = false,
  snapContext,
  onSelectCue,
  onSeek,
  onCommitCue,
  onDeleteCue,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [liveBounds, setLiveBounds] = useState<{ cueId: string; bounds: CueBounds } | null>(null)
  const liveBoundsRef = useRef<{ cueId: string; bounds: CueBounds } | null>(null)
  const knownDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0
  const inferredDurationMs = Math.max(
    currentTimeMs ?? 0,
    ...cues.map(cue => cue.endMs + globalOffsetMs),
  )
  const safeDurationMs = Math.max(1, knownDurationMs || inferredDurationMs)
  const contentWidth = Math.max(compact ? 1 : 720, (safeDurationMs / 1000) * pxPerSecond)
  const issuesByCue = useMemo(() => new Map(cues.map(cue => [cue.id, getCueIssues(cue, cues, durationMs)])), [cues, durationMs])

  const snapCanonical = useCallback((rawMs: number) => {
    const displayed = rawMs + globalOffsetMs
    return Math.max(0, snapTimeMs(displayed, snapContext) - globalOffsetMs)
  }, [globalOffsetMs, snapContext])

  const boundsForDrag = useCallback((drag: DragState, deltaMs: number): CueBounds => {
    if (drag.kind === 'move') {
      return moveCueToStart(drag.cue, snapCanonical(drag.cue.startMs + deltaMs), durationMs)
    }
    if (drag.kind === 'resize-start') {
      return resizeCueStart(drag.cue, snapCanonical(drag.cue.startMs + deltaMs), durationMs)
    }
    return resizeCueEnd(drag.cue, snapCanonical(drag.cue.endMs + deltaMs), durationMs)
  }, [durationMs, snapCanonical])

  const beginDrag = useCallback((event: ReactPointerEvent, cue: LyricCue, kind: LyricCueDragKind) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onSelectCue(cue.id)
    dragRef.current = { cue, kind, startClientX: event.clientX }
    const initial = { cueId: cue.id, bounds: { startMs: cue.startMs, endMs: cue.endMs } }
    liveBoundsRef.current = initial
    setLiveBounds(initial)
  }, [onSelectCue])

  const updateDrag = useCallback((event: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const deltaMs = ((event.clientX - drag.startClientX) / pxPerSecond) * 1000
    const next = { cueId: drag.cue.id, bounds: boundsForDrag(drag, deltaMs) }
    liveBoundsRef.current = next
    setLiveBounds(next)
  }, [boundsForDrag, pxPerSecond])

  const finishDrag = useCallback(() => {
    const drag = dragRef.current
    const live = liveBoundsRef.current
    dragRef.current = null
    liveBoundsRef.current = null
    setLiveBounds(null)
    if (!drag || !live || live.cueId !== drag.cue.id) return
    if (live.bounds.startMs === drag.cue.startMs && live.bounds.endMs === drag.cue.endMs) return
    onCommitCue(drag.cue.id, live.bounds)
  }, [onCommitCue])

  const handleBackgroundSeek = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && event.target !== innerRef.current) return
    const inner = innerRef.current
    if (!inner) return
    const rect = inner.getBoundingClientRect()
    const timeMs = Math.round(((event.clientX - rect.left) / pxPerSecond) * 1000)
    onSelectCue(null)
    onSeek(Math.min(safeDurationMs, Math.max(0, timeMs)))
  }, [onSeek, onSelectCue, pxPerSecond, safeDurationMs])

  const adjustCueByKeyboard = useCallback((event: ReactKeyboardEvent, cue: LyricCue, kind: LyricCueDragKind) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const amount = keyboardDelta(event) * direction
    let bounds: CueBounds
    if (kind === 'move') bounds = moveCueToStart(cue, snapCanonical(cue.startMs + amount), durationMs)
    else if (kind === 'resize-start') bounds = resizeCueStart(cue, snapCanonical(cue.startMs + amount), durationMs)
    else bounds = resizeCueEnd(cue, snapCanonical(cue.endMs + amount), durationMs)
    onCommitCue(cue.id, bounds)
  }, [durationMs, onCommitCue, snapCanonical])

  const playheadLeft = currentTimeMs === null ? null : Math.max(0, ((currentTimeMs / 1000) * pxPerSecond))
  const rulerIntervalMs = pxPerSecond >= 120 ? 1_000 : pxPerSecond >= 50 ? 5_000 : 10_000
  const rulerTicks = compact ? [] : Array.from(
    { length: Math.ceil(safeDurationMs / rulerIntervalMs) + 1 },
    (_, index) => index * rulerIntervalMs,
  )

  const timeline = (
    <div
      ref={innerRef}
      className={`lyric-cue-timeline__inner${compact ? ' lyric-cue-timeline__inner--compact' : ''}`}
      style={{ width: compact ? '100%' : contentWidth }}
      onPointerDown={handleBackgroundSeek}
      onPointerMove={updateDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      data-testid="lyric-cue-timeline"
    >
      {!compact && (
        <div className="lyric-cue-timeline__ruler" aria-hidden="true">
          {rulerTicks.map(tickMs => (
            <span key={tickMs} className="lyric-cue-timeline__tick" style={{ left: (tickMs / 1000) * pxPerSecond }}>
              {formatTimelineMs(tickMs).replace('.000', '')}
            </span>
          ))}
        </div>
      )}

      {!compact && (
        <LyricWaveformCanvas
          peaks={waveformPeaks}
          loading={waveformLoading}
          audioDurationMs={safeDurationMs}
          currentTimeMs={currentTimeMs ?? 0}
        />
      )}

      {playheadLeft !== null && (
        <div
          className="lyric-cue-timeline__playhead"
          style={{ left: playheadLeft }}
          aria-label={`Playhead at ${formatTimelineMs(currentTimeMs ?? 0)}`}
          data-testid="lyric-playhead"
        />
      )}

      {cues.map((cue, index) => {
        const bounds = liveBounds?.cueId === cue.id ? liveBounds.bounds : cue
        const displayStartMs = bounds.startMs + globalOffsetMs
        const displayEndMs = bounds.endMs + globalOffsetMs
        const selected = cue.id === selectedCueId
        const active = currentTimeMs !== null && isCueActive(
          { startMs: displayStartMs, endMs: displayEndMs },
          currentTimeMs,
        )
        const issues = issuesByCue.get(cue.id) ?? []
        const width = Math.max(4, ((displayEndMs - displayStartMs) / 1000) * pxPerSecond)
        const left = Math.max(0, (displayStartMs / 1000) * pxPerSecond)
        return (
          <div
            key={cue.id}
            className={[
              'lyric-cue-block',
              compact ? 'lyric-cue-block--compact' : '',
              selected ? 'lyric-cue-block--selected' : '',
              active ? 'lyric-cue-block--active' : '',
              liveBounds?.cueId === cue.id ? 'lyric-cue-block--dragging' : '',
              issues.length ? 'lyric-cue-block--warning' : '',
            ].filter(Boolean).join(' ')}
            style={{ left, width }}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-current={active ? 'time' : undefined}
            aria-label={`Cue ${index + 1}: ${cue.text || 'empty text'}, ${formatTimelineMs(bounds.startMs)} to ${formatTimelineMs(bounds.endMs)}${issues.length ? `, ${issues.length} warning${issues.length === 1 ? '' : 's'}` : ''}`}
            data-cue-id={cue.id}
            data-testid={`lyric-cue-${cue.id}`}
            onPointerDown={event => beginDrag(event, cue, 'move')}
            onClick={event => { event.stopPropagation(); onSelectCue(cue.id) }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectCue(cue.id)
                return
              }
              if ((event.key === 'Delete' || event.key === 'Backspace') && onDeleteCue) {
                event.preventDefault()
                onDeleteCue(cue.id)
                return
              }
              adjustCueByKeyboard(event, cue, 'move')
            }}
          >
            <button
              type="button"
              className="lyric-cue-handle lyric-cue-handle--start"
              aria-label={`Adjust start of cue ${index + 1}`}
              aria-valuetext={`${bounds.startMs} milliseconds`}
              onPointerDown={event => beginDrag(event, cue, 'resize-start')}
              onKeyDown={event => adjustCueByKeyboard(event, cue, 'resize-start')}
            />
            <span className="lyric-cue-block__state" aria-hidden="true">
              {active ? '▶' : selected ? '●' : issues.length ? '!' : ''}
            </span>
            <span className="lyric-cue-block__text">{cue.text || 'Empty cue'}</span>
            <button
              type="button"
              className="lyric-cue-handle lyric-cue-handle--end"
              aria-label={`Adjust end of cue ${index + 1}`}
              aria-valuetext={`${bounds.endMs} milliseconds`}
              onPointerDown={event => beginDrag(event, cue, 'resize-end')}
              onKeyDown={event => adjustCueByKeyboard(event, cue, 'resize-end')}
            />
            {onDeleteCue && !compact && (
              <button
                type="button"
                className="lyric-cue-block__delete"
                aria-label={`Delete cue ${index + 1}`}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onDeleteCue(cue.id) }}
              >×</button>
            )}
          </div>
        )
      })}

      {cues.length === 0 && (
        <div className="lyric-cue-timeline__empty">No timed lyric cues</div>
      )}
    </div>
  )

  if (compact) return timeline
  return <div className="lyric-cue-timeline__scroll">{timeline}</div>
}
