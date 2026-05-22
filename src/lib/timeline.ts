import type { VzTimelineClip, VzTransitionConfig, VzTransitionEasing, VzTransitionType } from '../types/timeline'

/** Default clip duration (seconds) for still images or media with no valid intrinsic duration. */
export const DEFAULT_CLIP_DURATION_SEC = 5

// ── Internal helper ───────────────────────────────────────────────────

/** Returns the overlap seconds contributed by this clip's outgoing transition (0 for cut/none). */
function getClipOverlapSec(clip: VzTimelineClip): number {
  const tx = clip.transitionOut
  if (!tx || tx.type === 'cut' || tx.durationSec <= 0) return 0
  return tx.durationSec
}

// ── Migration ─────────────────────────────────────────────────────────

/**
 * Converts a clip that has the deprecated `transition` field to use `transitionOut`.
 * Safe to call on already-migrated clips (no-op).
 */
export function migrateClip(clip: VzTimelineClip): VzTimelineClip {
  if (clip.transition && !clip.transitionOut) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transition, ...rest } = clip
    return { ...rest, transitionOut: { type: clip.transition.type, durationSec: clip.transition.durationSec } }
  }
  return clip
}

// ── Timeline geometry ─────────────────────────────────────────────────

/**
 * Recalculates `startSec` for every clip in order.
 * Overlapping transitions reduce the cursor advance so the two clips play
 * simultaneously for `transitionOut.durationSec` seconds.
 *
 * The last clip's transition is excluded from cursor reduction because there
 * is no subsequent clip to overlap with (in non-loop mode) and total-duration
 * display stays clean.
 */
export function recalculateTimelineStarts(clips: VzTimelineClip[]): VzTimelineClip[] {
  let cursor = 0
  return clips.map((clip, i) => {
    const updated = { ...clip, startSec: cursor }
    const isLast  = i === clips.length - 1
    const overlap = isLast ? 0 : Math.min(getClipOverlapSec(clip), clip.durationSec)
    cursor += clip.durationSec - overlap
    return updated
  })
}

/**
 * Total playback duration accounting for clip overlaps.
 * Requires `recalculateTimelineStarts` to have been called first.
 */
export function getTimelineDuration(clips: VzTimelineClip[]): number {
  if (!clips.length) return 0
  const last = clips[clips.length - 1]
  return last.startSec + last.durationSec
}

// ── Active clip lookup ────────────────────────────────────────────────

export interface ActiveClipResult {
  clip: VzTimelineClip | null
  localTimeSec: number     // time within the clip (0 → clip.durationSec)
  timelineTimeSec: number  // resolved timeline position (after loop wrap)
}

export function getActiveTimelineClip(
  clips: VzTimelineClip[],
  timeSec: number,
  loop: boolean,
): ActiveClipResult {
  if (!clips.length) return { clip: null, localTimeSec: 0, timelineTimeSec: 0 }

  const total = getTimelineDuration(clips)
  if (total <= 0) return { clip: null, localTimeSec: 0, timelineTimeSec: 0 }

  let t = timeSec
  if (loop) {
    t = ((t % total) + total) % total
  } else {
    t = Math.min(t, total)
  }

  // Linear scan — clip count stays small (< 100)
  for (const clip of clips) {
    if (t >= clip.startSec && t < clip.startSec + clip.durationSec) {
      return {
        clip,
        localTimeSec: t - clip.startSec,
        timelineTimeSec: t,
      }
    }
  }

  // Edge: t === total (non-loop end) → return last clip at its end
  const last = clips[clips.length - 1]
  return {
    clip: last,
    localTimeSec: last.durationSec,
    timelineTimeSec: total,
  }
}

// ── Clip source helpers ───────────────────────────────────────────────

export interface ClipSourceRange {
  inSec: number
  outSec: number
  lengthSec: number
}

export function getClipSourceRange(clip: VzTimelineClip, videoDuration: number): ClipSourceRange {
  const inSec = Math.max(0, clip.mediaInSec)
  let outSec: number
  if (clip.mediaOutSec !== undefined && clip.mediaOutSec > inSec) {
    outSec = clip.mediaOutSec
  } else if (isFinite(videoDuration) && videoDuration > 0) {
    outSec = videoDuration
  } else {
    outSec = inSec + clip.durationSec
  }
  if (isFinite(videoDuration) && videoDuration > 0) {
    outSec = Math.min(outSec, videoDuration)
  }
  outSec = Math.max(outSec, inSec + 0.001)
  return { inSec, outSec, lengthSec: outSec - inSec }
}

export function getClipSourceTime(
  clip: VzTimelineClip,
  localTimeSec: number,
  videoDuration: number,
): number {
  const { inSec, outSec, lengthSec } = getClipSourceRange(clip, videoDuration)
  const local = Math.max(0, localTimeSec)
  switch (clip.playbackMode) {
    case 'loop':
      return lengthSec > 0 ? inSec + (local % lengthSec) : inSec
    case 'trim':
    case 'freeze':
    default:
      return Math.min(inSec + local, outSec - 0.001)
  }
}

export function shouldFreezeClipFrame(
  clip: VzTimelineClip,
  localTimeSec: number,
  videoDuration: number,
): boolean {
  if (clip.playbackMode === 'loop') return false
  const { lengthSec } = getClipSourceRange(clip, videoDuration)
  return localTimeSec >= lengthSec
}

export function getNextTimelineClip(
  clips: VzTimelineClip[],
  clipId: string,
  loop: boolean,
): VzTimelineClip | null {
  const idx = clips.findIndex(c => c.id === clipId)
  if (idx === -1) return null
  if (idx + 1 < clips.length) return clips[idx + 1]
  return loop ? clips[0] : null
}

// ── Easing ────────────────────────────────────────────────────────────

/** Applies easing to a raw 0→1 linear progress value. */
export function getEasedProgress(p: number, easing?: VzTransitionEasing): number {
  const c = Math.max(0, Math.min(1, p))
  switch (easing) {
    case 'easeIn':         return c * c
    case 'easeOut':        return 1 - (1 - c) * (1 - c)
    case 'easeInOut':      return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2
    case 'easeInCubic':    return c * c * c
    case 'easeOutCubic':   return 1 - Math.pow(1 - c, 3)
    case 'easeInOutCubic': return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
    default:               return c
  }
}

// ── Transition metadata ───────────────────────────────────────────────

export const TRANSITION_LABELS: Record<VzTransitionType, string> = {
  cut:              'Cut',
  crossfade:        'Crossfade',
  flash:            'Flash',
  glitch:           'Glitch',
  wipeLeft:         'Wipe Left',
  wipeRight:        'Wipe Right',
  wipeUp:           'Wipe Up',
  wipeDown:         'Wipe Down',
  zoomIn:           'Zoom In',
  zoomOut:          'Zoom Out',
  blurCrossfade:    'Blur Crossfade',
  lumaFade:         'Luma Fade',
  additiveBlend:    'Additive Blend',
  rgbTear:          'RGB Tear',
  datamoshCut:      'Datamosh Cut',
  scanlineWipe:     'Scanline Wipe',
  pixelSort:        'Pixel Sort',
  radialWipe:       'Radial Wipe',
  circleIris:       'Circle Iris',
  bassImpactZoom:   'Bass Impact Zoom',
  shockwaveReveal:  'Shockwave Reveal',
  particleExplosion:'Particle Explosion',
}

/** Sensible defaults for each transition type. */
export const TRANSITION_DEFAULTS: Record<VzTransitionType, VzTransitionConfig> = {
  cut:              { type: 'cut',              durationSec: 0,    easing: 'linear',          intensity: 1 },
  crossfade:        { type: 'crossfade',        durationSec: 0.75, easing: 'easeInOut',        intensity: 1 },
  flash:            { type: 'flash',            durationSec: 0.35, easing: 'easeOut',          intensity: 1 },
  glitch:           { type: 'glitch',           durationSec: 0.6,  easing: 'easeOutCubic',     intensity: 0.85 },
  wipeLeft:         { type: 'wipeLeft',         durationSec: 0.7,  easing: 'easeInOutCubic',   intensity: 1, direction: 'left' },
  wipeRight:        { type: 'wipeRight',        durationSec: 0.7,  easing: 'easeInOutCubic',   intensity: 1, direction: 'right' },
  wipeUp:           { type: 'wipeUp',           durationSec: 0.7,  easing: 'easeInOutCubic',   intensity: 1, direction: 'up' },
  wipeDown:         { type: 'wipeDown',         durationSec: 0.7,  easing: 'easeInOutCubic',   intensity: 1, direction: 'down' },
  zoomIn:           { type: 'zoomIn',           durationSec: 0.7,  easing: 'easeOutCubic',     intensity: 0.8 },
  zoomOut:          { type: 'zoomOut',          durationSec: 0.7,  easing: 'easeOutCubic',     intensity: 0.8 },
  blurCrossfade:    { type: 'blurCrossfade',    durationSec: 0.85, easing: 'easeInOutCubic',   intensity: 0.9 },
  lumaFade:         { type: 'lumaFade',         durationSec: 0.85, easing: 'easeInOut',        intensity: 1 },
  additiveBlend:    { type: 'additiveBlend',    durationSec: 0.65, easing: 'easeOut',          intensity: 0.85, blendMode: 'lighter' },
  rgbTear:          { type: 'rgbTear',          durationSec: 0.55, easing: 'easeOutCubic',     intensity: 0.9 },
  datamoshCut:      { type: 'datamoshCut',      durationSec: 0.6,  easing: 'easeOut',          intensity: 0.85 },
  scanlineWipe:     { type: 'scanlineWipe',     durationSec: 0.7,  easing: 'easeInOut',        intensity: 0.9 },
  pixelSort:        { type: 'pixelSort',        durationSec: 0.75, easing: 'easeInOutCubic',   intensity: 0.85 },
  radialWipe:       { type: 'radialWipe',       durationSec: 0.75, easing: 'easeInOutCubic',   intensity: 1, direction: 'center' },
  circleIris:       { type: 'circleIris',       durationSec: 0.75, easing: 'easeInOutCubic',   intensity: 1, direction: 'center' },
  bassImpactZoom:   { type: 'bassImpactZoom',   durationSec: 0.45, easing: 'easeOutCubic',     intensity: 1 },
  shockwaveReveal:  { type: 'shockwaveReveal',  durationSec: 0.8,  easing: 'easeOutCubic',     intensity: 1 },
  particleExplosion:{ type: 'particleExplosion',durationSec: 0.85, easing: 'easeOutCubic',     intensity: 0.95 },
}

const VALID_TRANSITION_TYPES = new Set<string>(Object.keys(TRANSITION_DEFAULTS))

/**
 * Normalises any saved/legacy transition config shape into a full `VzTransitionConfig`.
 * Handles: undefined, string type-only, old `{type, duration}` shape, partial configs.
 */
export function normalizeTransitionConfig(input: unknown): VzTransitionConfig {
  if (!input) return { type: 'cut', durationSec: 0 }

  if (typeof input === 'string') {
    const type = VALID_TRANSITION_TYPES.has(input) ? (input as VzTransitionType) : 'crossfade'
    return { ...TRANSITION_DEFAULTS[type] }
  }

  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>
    const rawType = typeof obj.type === 'string' ? obj.type : 'crossfade'
    const type: VzTransitionType = VALID_TRANSITION_TYPES.has(rawType)
      ? (rawType as VzTransitionType)
      : 'crossfade'
    const def = TRANSITION_DEFAULTS[type]
    // Support legacy `duration` field name in addition to `durationSec`
    const durationSec =
      typeof obj.durationSec === 'number' ? obj.durationSec
      : typeof obj.duration   === 'number' ? obj.duration
      : def.durationSec
    return {
      type,
      durationSec,
      easing:    typeof obj.easing    === 'string' ? (obj.easing    as VzTransitionEasing)        : def.easing,
      intensity: typeof obj.intensity === 'number' ? obj.intensity                               : def.intensity,
      direction: typeof obj.direction === 'string' ? (obj.direction as VzTransitionConfig['direction']) : def.direction,
      blendMode: typeof obj.blendMode === 'string' ? obj.blendMode                               : def.blendMode,
    }
  }

  return { ...TRANSITION_DEFAULTS['crossfade'] }
}

// ── Transition state ──────────────────────────────────────────────────

/**
 * Describes both clips active during an overlap/transition window.
 *
 * Timing model: each clip's `startSec` is set by `recalculateTimelineStarts`
 * so that the incoming clip starts `transitionOut.durationSec` seconds before
 * the outgoing clip ends.  The overlap window is
 *   [ incomingClip.startSec,  outgoingClip.startSec + outgoingClip.durationSec )
 *
 * `outgoingLocalTimeSec` and `incomingLocalTimeSec` can be fed directly into
 * `getClipSourceTime` for per-frame video sync of each layer.
 */
export interface TwoClipRenderState {
  config: VzTransitionConfig
  /** Raw linear 0→1 progress. Apply getEasedProgress() in the renderer. */
  progress: number
  outgoingClip: VzTimelineClip
  incomingClip: VzTimelineClip
  /** Local time within the outgoing clip (seconds from its startSec). */
  outgoingLocalTimeSec: number
  /** Local time within the incoming clip (0 at overlap start, overlapSec at hard-cut point). */
  incomingLocalTimeSec: number
}

/** @deprecated Rename import to TwoClipRenderState. Kept for a smooth rename. */
export type TransitionState = TwoClipRenderState

/**
 * Returns a `TwoClipRenderState` when `timeSec` falls inside the overlap
 * window of a non-cut transition. Returns null outside any transition window
 * or when the type is 'cut'.
 */
export function getTransitionState(
  clips: VzTimelineClip[],
  timeSec: number,
  loop: boolean,
): TwoClipRenderState | null {
  if (!clips.length) return null
  const total = getTimelineDuration(clips)
  if (total <= 0) return null

  let t = timeSec
  if (loop) {
    t = ((t % total) + total) % total
  } else {
    t = Math.min(t, total)
  }

  for (let i = 0; i < clips.length; i++) {
    const clip    = clips[i]
    const config  = clip.transitionOut
    if (!config || config.type === 'cut' || config.durationSec <= 0) continue

    const overlapSec  = Math.min(config.durationSec, clip.durationSec)
    const clipEnd     = clip.startSec + clip.durationSec
    const transStart  = clipEnd - overlapSec

    if (t < transStart || t >= clipEnd) continue

    const incomingClip: VzTimelineClip | null =
      i + 1 < clips.length ? clips[i + 1] : loop ? clips[0] : null
    if (!incomingClip) continue

    const rawProgress          = (t - transStart) / overlapSec
    const outgoingLocalTimeSec = t - clip.startSec
    const incomingLocalTimeSec = t - transStart  // = 0 at window start, = overlapSec at hard-cut

    return {
      config,
      progress: Math.min(1, Math.max(0, rawProgress)),
      outgoingClip: clip,
      incomingClip,
      outgoingLocalTimeSec,
      incomingLocalTimeSec,
    }
  }
  return null
}
