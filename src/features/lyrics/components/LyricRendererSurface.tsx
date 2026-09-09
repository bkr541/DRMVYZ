import { useLayoutEffect, useMemo, useRef } from 'react'
import type { LyricCue, LyricDocument } from '../../../types/lyrics'
import { drawLyricCue } from '../runtime/lyricCanvasRenderer'
import { prepareLyricTimeline, resolveLyricPlayback } from '../runtime/lyricPlaybackResolver'

interface Props {
  cues: readonly LyricCue[]
  document: LyricDocument | null
  currentAudioTimeMs: number
  showLyrics: boolean
  className?: string
  ariaLabel?: string
}

const PREVIEW_WIDTH = 1280
const PREVIEW_HEIGHT = 720

/**
 * Store-agnostic lyric canvas surface. It uses the same canonical timeline
 * resolver and draw routine as the production visualizer, but receives all
 * lyric data and playback time through props.
 */
export function LyricRendererSurface({
  cues,
  document,
  currentAudioTimeMs,
  showLyrics,
  className = '',
  ariaLabel = 'Lyric renderer preview',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeline = useMemo(() => prepareLyricTimeline(cues), [cues])
  const playback = useMemo(() => resolveLyricPlayback({
    timeline,
    currentAudioMs: currentAudioTimeMs,
    globalOffsetMs: document?.globalOffsetMs ?? 0,
    documentId: document?.id ?? null,
    sourceIdentity: document ? `injected:${document.id}` : null,
    transitionMode: 'discontinuous',
  }), [timeline, currentAudioTimeMs, document])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      return
    }
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (
      !showLyrics ||
      !playback.activeCue ||
      playback.effectiveCueStartMs === null ||
      playback.effectiveCueEndMs === null
    ) return

    drawLyricCue({
      ctx,
      cue: playback.activeCue,
      currentAudioMs: playback.currentAudioMs,
      effectiveStartMs: playback.effectiveCueStartMs,
      effectiveEndMs: playback.effectiveCueEndMs,
      document,
      width: canvas.width,
      height: canvas.height,
      dpr: 1,
    })
  }, [document, playback, showLyrics])

  const activeCue = showLyrics ? playback.activeCue : null

  return (
    <div
      className={`lmv-lyric-renderer-surface${className ? ` ${className}` : ''}`}
      data-active-cue-id={activeCue?.id ?? ''}
      data-document-id={document?.id ?? ''}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        aria-label={ariaLabel}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {activeCue?.text ?? ''}
      </span>
    </div>
  )
}
