/**
 * The pure half of stage transitions (docs/preset-transitions.md): how long a transition lasts, and how each style draws one frame of the blend. The half that owns the
 * canvases and the timing is lib/stageTransitionController.ts.
 */
import type { PresetTransitionStyle } from './presetTransitions'

/** How many beats each style lasts at a trusted tempo. */
export const STAGE_TRANSITION_BEATS: Readonly<Record<PresetTransitionStyle, number>> = Object.freeze({ dissolve: 2, flash: 1, wipe: 1, zoom: 1, dip: 2 })
/** With no trusted tempo a beat is taken to last as it does at this tempo (600 ms), so a one-beat style is about 600 ms. */
export const STAGE_TRANSITION_FALLBACK_BPM = 100
export const STAGE_TRANSITION_MIN_MS = 150
export const STAGE_TRANSITION_MAX_MS = 2500
/** A bright flash is never shorter than this: a quick strobe is the one thing a transition must not become. */
export const STAGE_TRANSITION_FLASH_MIN_MS = 300

export interface TransitionTempo {
  /** The tempo from the music analysis (BPM, 0-1 confidence, where it came from). */
  bpm: number
  confidence: number
  source: 'offline_analysis' | 'live_analysis' | 'manual_override' | 'rekordbox' | null | undefined
  /** The audio is live input (no track): the analysis has to be trusted on its confidence alone. */
  liveInput: boolean
  /** The tempo of the loaded track, used when the analysis frame cannot be trusted and the audio is not live input. */
  trackBpm?: number | null
}

const validBpm = (bpm: unknown): bpm is number => typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= 40 && bpm <= 220

/** The tempo to use, or null when none can be trusted: live analysis needs real confidence; a grid from a track, Rekordbox or the user is trusted much sooner. */
export function trustedTransitionBpm(tempo: TransitionTempo): number | null {
  const gridSource = tempo.source === 'rekordbox' || tempo.source === 'manual_override' || tempo.source === 'offline_analysis'
  if (validBpm(tempo.bpm)) {
    if (gridSource && (tempo.source !== 'offline_analysis' || tempo.confidence >= 0.3)) return tempo.bpm
    if (tempo.source === 'live_analysis' && tempo.confidence >= 0.6) return tempo.bpm
    if (!tempo.liveInput && tempo.source == null && tempo.confidence >= 0.6) return tempo.bpm
  }
  if (!tempo.liveInput && validBpm(tempo.trackBpm)) return tempo.trackBpm
  return null
}

export function resolveTransitionDurationMs(style: PresetTransitionStyle, tempo: TransitionTempo): number {
  const beats = STAGE_TRANSITION_BEATS[style]
  const bpm = trustedTransitionBpm(tempo) ?? STAGE_TRANSITION_FALLBACK_BPM
  const ms = (beats * 60_000) / bpm
  const floor = style === 'flash' ? STAGE_TRANSITION_FLASH_MIN_MS : STAGE_TRANSITION_MIN_MS
  return Math.round(Math.min(STAGE_TRANSITION_MAX_MS, Math.max(floor, ms)))
}

export const easeInOut = (t: number): number => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }

/** The drawing surface a transition needs; a canvas 2D context satisfies it, and a test can record calls on a stand-in. */
export interface TransitionContext {
  save(): void
  restore(): void
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void
  fillRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  rect(x: number, y: number, w: number, h: number): void
  clip(): void
  translate(x: number, y: number): void
  scale(x: number, y: number): void
  globalAlpha: number
  fillStyle: string | CanvasGradient | CanvasPattern
}

const FLASH_PEAK_ALPHA = 0.85
const FLASH_RISE = 0.25

/**
 * One frame of the blend at `progress` (0 = the old picture, 1 = the new one). `to` is null until the new picture has a frame: the old picture is held.
 * Every style ends on the new picture alone at progress 1.
 */
export function drawTransitionFrame(
  ctx: TransitionContext,
  style: PresetTransitionStyle,
  progress: number,
  from: CanvasImageSource,
  to: CanvasImageSource | null,
  width: number,
  height: number,
): void {
  const p = Math.min(1, Math.max(0, progress))
  ctx.save()
  ctx.globalAlpha = 1
  if (!to) {
    ctx.drawImage(from, 0, 0, width, height)
    ctx.restore()
    return
  }
  if (p >= 1) {
    ctx.drawImage(to, 0, 0, width, height)
    ctx.restore()
    return
  }
  const e = easeInOut(p)
  switch (style) {
    case 'dissolve': {
      ctx.drawImage(to, 0, 0, width, height)
      ctx.globalAlpha = 1 - e
      ctx.drawImage(from, 0, 0, width, height)
      break
    }
    case 'flash': {
      ctx.drawImage(p < FLASH_RISE ? from : to, 0, 0, width, height)
      const level = p < FLASH_RISE ? p / FLASH_RISE : (1 - (p - FLASH_RISE) / (1 - FLASH_RISE)) ** 2
      ctx.globalAlpha = FLASH_PEAK_ALPHA * level
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'wipe': {
      ctx.drawImage(to, 0, 0, width, height)
      const x = Math.round(e * width)
      ctx.beginPath()
      ctx.rect(x, 0, width - x, height)
      ctx.clip()
      ctx.drawImage(from, 0, 0, width, height)
      break
    }
    case 'zoom': {
      ctx.drawImage(to, 0, 0, width, height)
      const zoom = 1 + 0.35 * e
      ctx.globalAlpha = 1 - e
      ctx.translate(width / 2, height / 2)
      ctx.scale(zoom, zoom)
      ctx.drawImage(from, -width / 2, -height / 2, width, height)
      break
    }
    case 'dip': {
      const first = p < 0.5
      ctx.drawImage(first ? from : to, 0, 0, width, height)
      ctx.globalAlpha = first ? easeInOut(p * 2) : 1 - easeInOut((p - 0.5) * 2)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      break
    }
  }
  ctx.restore()
}
