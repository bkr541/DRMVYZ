import type {
  VzTimelineClip,
  VzTransitionConfig,
  VzTransitionEasing,
  VzTransitionType,
  VzTimelineMediaClip,
  VzTimelineMediaLaneId,
  VzTimelineEffectRegion,
} from '../types/timeline'

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
 * Generic so the returned type preserves extra fields (e.g. `lane` on VzTimelineMediaClip).
 */
export function migrateClip<T extends VzTimelineClip>(clip: T): T {
  if (clip.transition && !clip.transitionOut) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transition, ...rest } = clip
    return {
      ...rest,
      transitionOut: { type: clip.transition.type, durationSec: clip.transition.durationSec },
    } as T
  }
  return clip
}

/**
 * Converts a legacy VzTimelineClip (or an already-migrated clip missing `lane`)
 * into a VzTimelineMediaClip with an explicit lane assignment.
 *
 * Idempotent: clips that already carry a `lane` field pass through unchanged.
 * Also runs migrateClip() so the deprecated `transition` field is handled in one pass.
 */
export function migrateToMediaClip(
  clip: VzTimelineClip,
  lane: VzTimelineMediaLaneId = 'video-background',
): VzTimelineMediaClip {
  const migrated = migrateClip(clip)
  // Clips that were already migrated to VzTimelineMediaClip carry a lane field.
  if ((migrated as VzTimelineMediaClip).lane !== undefined) {
    return migrated as VzTimelineMediaClip
  }
  return { ...migrated, lane }
}

/**
 * Bulk-migrates a legacy flat clip array to lane-aware media clips.
 * Idempotent: clips that already have a `lane` field pass through unchanged.
 *
 * All clips default to `video-background` — every legacy timeline clip was a
 * background clip, because that was the only lane that existed before Phase 1A.
 */
export function migrateLegacyClips(
  clips: VzTimelineClip[],
  lane: VzTimelineMediaLaneId = 'video-background',
): VzTimelineMediaClip[] {
  return clips.map(c => migrateToMediaClip(c, lane))
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
 *
 * Generic so that VzTimelineMediaClip arrays preserve the `lane` field and
 * any other future sub-type fields through the recalculation.
 *
 * NOTE: This is appropriate only for the video-background lane, where clips
 * are arranged sequentially. Overlay clips use absolute startSec positions
 * and must NOT be run through this function.
 */
export function recalculateTimelineStarts<T extends VzTimelineClip>(clips: T[]): T[] {
  let cursor = 0
  return clips.map((clip, i) => {
    const updated = { ...clip, startSec: cursor } as T
    const isLast  = i === clips.length - 1
    const overlap = isLast ? 0 : Math.min(getClipOverlapSec(clip), clip.durationSec)
    cursor += clip.durationSec - overlap
    return updated
  })
}

/**
 * Total playback duration: end time of the last-ending clip.
 * Works with both sequentially packed and absolute-positioned clip arrays.
 * Does not assume clips are sorted by startSec.
 */
export function getTimelineDuration(clips: VzTimelineClip[]): number {
  if (!clips.length) return 0
  return clips.reduce((max, c) => Math.max(max, c.startSec + c.durationSec), 0)
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

  // In a gap between clips: no active clip — canvas shows empty/fallback state.
  // Only hold the final clip at its end when the playhead has truly reached the
  // end boundary in non-loop mode (loop wrapping keeps t < total always).
  if (t >= total) {
    const last = clips[clips.length - 1]
    return {
      clip: last,
      localTimeSec: last.durationSec,
      timelineTimeSec: total,
    }
  }

  return { clip: null, localTimeSec: 0, timelineTimeSec: t }
}

// ── Background lane helpers ───────────────────────────────────────────

/**
 * Get the active background clip at a timeline position.
 * Thin wrapper around getActiveTimelineClip scoped to the video-background lane.
 *
 * The renderer should always use background lane clips as the primary visual
 * source when timeline mode is enabled.
 */
export function getActiveBgClip(
  bgClips: VzTimelineMediaClip[],
  timeSec: number,
  loop: boolean,
): ActiveClipResult {
  return getActiveTimelineClip(bgClips, timeSec, loop)
}

/**
 * Appends a new background clip immediately after the last existing bg clip.
 * Accounts for the last clip's outgoing transition overlap so the new clip
 * starts at the correct time. Does NOT recalculate all previous startSec values.
 * Returns the updated array — does not mutate the input.
 */
export function appendBgClip(
  bgClips: VzTimelineMediaClip[],
  clipProps: Omit<VzTimelineMediaClip, 'startSec'>,
): VzTimelineMediaClip[] {
  let startSec = 0
  if (bgClips.length > 0) {
    const sorted = [...bgClips].sort((a, b) => a.startSec - b.startSec)
    const last   = sorted[sorted.length - 1]
    const overlapSec = getClipOverlapSec(last)
    // Start right after last clip ends, backing up by overlap so transition plays
    startSec = last.startSec + last.durationSec - overlapSec
  }
  const clip: VzTimelineMediaClip = { ...clipProps, startSec }
  return [...bgClips, clip]
}

// ── Overlay lane helpers ──────────────────────────────────────────────

/**
 * Returns all overlay clips that are active at the given timeline position.
 *
 * Overlay clips use absolute startSec positions, so multiple clips may be
 * active simultaneously — unlike the background lane which is always sequential.
 * This is intentional: overlays are composited ABOVE the background.
 */
export function getActiveOverlayClips(
  overlayClips: VzTimelineMediaClip[],
  timeSec: number,
): VzTimelineMediaClip[] {
  return overlayClips.filter(c =>
    timeSec >= c.startSec && timeSec < c.startSec + c.durationSec
  )
}

// ── Effect region helpers ─────────────────────────────────────────────

/**
 * Returns all effect regions that are active (enabled and covering) the given
 * timeline position.
 */
export function getActiveEffectRegions(
  regions: VzTimelineEffectRegion[],
  timeSec: number,
): VzTimelineEffectRegion[] {
  return regions.filter(r =>
    r.enabled && timeSec >= r.startSec && timeSec < r.startSec + r.durationSec
  )
}

/**
 * Returns effect regions whose time window overlaps [startSec, endSec).
 * Useful for rendering range selection or conflict detection in Phase 1B+.
 */
export function findOverlappingEffectRegions(
  regions: VzTimelineEffectRegion[],
  startSec: number,
  endSec: number,
): VzTimelineEffectRegion[] {
  return regions.filter(r =>
    r.enabled && r.startSec < endSec && r.startSec + r.durationSec > startSec
  )
}

// ── Project duration ──────────────────────────────────────────────────

/**
 * Total visible project duration in seconds, derived from all timed items
 * across background clips, overlay clips, and effect regions.
 *
 * Audio duration (from the audio engine) is NOT included. Callers that need
 * audio-aware total duration should take: max(getTimelineProjectDuration(...), engine.duration).
 */
export function getTimelineProjectDuration(params: {
  bgClips: VzTimelineMediaClip[]
  overlayClips: VzTimelineMediaClip[]
  effectRegions: VzTimelineEffectRegion[]
}): number {
  const bgEnd = getTimelineDuration(params.bgClips)
  const overlayEnd = params.overlayClips.reduce(
    (max, c) => Math.max(max, c.startSec + c.durationSec),
    0,
  )
  const fxEnd = params.effectRegions.reduce(
    (max, r) => Math.max(max, r.startSec + r.durationSec),
    0,
  )
  return Math.max(bgEnd, overlayEnd, fxEnd)
}

// ── Snap to BPM ───────────────────────────────────────────────────────

/**
 * Returns true when a clip participates in timeline-clock video synchronisation.
 * Missing / undefined means ON for backward-compat with all legacy saved data.
 */
export function isClipSnapToBpmEnabled(clip: Pick<VzTimelineClip, 'snapToBpm'>): boolean {
  return clip.snapToBpm !== false
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
 *
 * Note: transitions are only supported on the video-background lane.
 * Overlay clips carry `transitionOut` for structural parity but the renderer
 * does not apply transitions to them until explicitly designed.
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
 *
 * Only meaningful for video-background lane clips — overlay transitions are
 * not supported in Phase 1A.
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

    const overlapSec      = Math.min(config.durationSec, clip.durationSec)
    const clipEnd         = clip.startSec + clip.durationSec
    const configuredStart = clipEnd - overlapSec

    const incomingClip: VzTimelineClip | null =
      i + 1 < clips.length ? clips[i + 1] : loop ? clips[0] : null
    if (!incomingClip) continue

    // Spatial validity: only render transition when clips actually overlap.
    // If the incoming clip starts at or after outgoing clip ends, the user
    // has intentionally left a gap — do not apply a fake transition.
    if (incomingClip.startSec >= clipEnd) continue

    // For freely-positioned clips the incoming clip may start later than the
    // configured transition window. Use the actual overlap interval.
    const actualStart    = Math.max(configuredStart, incomingClip.startSec)
    const actualDuration = clipEnd - actualStart  // always > 0 (gap check above)

    if (t < actualStart || t >= clipEnd) continue

    // Progress 0→1 over the real overlap window.
    const rawProgress          = (t - actualStart) / actualDuration
    const outgoingLocalTimeSec = t - clip.startSec
    // Incoming local time is anchored to the incoming clip's own start, not
    // the configured transition window start. This is correct whether the
    // incoming clip starts before, at, or after configuredStart.
    const incomingLocalTimeSec = t - incomingClip.startSec

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
