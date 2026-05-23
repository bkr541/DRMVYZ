// ── Transition types ──────────────────────────────────────────────────

export type VzTransitionType =
  | 'cut'
  | 'crossfade'
  | 'flash'
  | 'glitch'
  | 'wipeLeft'
  | 'wipeRight'
  | 'wipeUp'
  | 'wipeDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'blurCrossfade'
  | 'lumaFade'
  | 'additiveBlend'
  | 'rgbTear'
  | 'datamoshCut'
  | 'scanlineWipe'
  | 'pixelSort'
  | 'radialWipe'
  | 'circleIris'
  | 'bassImpactZoom'
  | 'shockwaveReveal'
  | 'particleExplosion'

export type VzTransitionEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'

export interface VzTransitionConfig {
  type: VzTransitionType
  /** Overlap duration in seconds — both clips play simultaneously for this long. */
  durationSec: number
  easing?: VzTransitionEasing
  /** Canvas globalCompositeOperation for the incoming clip layer. */
  blendMode?: string
  /** 0–1 effect-strength multiplier. Undefined = 1 (full strength). */
  intensity?: number
  /** For directional transitions (wipe, radial). */
  direction?: 'left' | 'right' | 'up' | 'down' | 'center'
}

// ── Base clip type (legacy / backwards-compat) ────────────────────────
//
// VzTimelineClip is kept as the base type for backward compatibility with
// serialized sessions, presets, and all existing consumers. New code should
// use VzTimelineMediaClip (which extends this) for lane-aware operations.

export interface VzTimelineClip {
  id: string
  mediaId: string
  startSec: number
  durationSec: number
  mediaInSec: number
  mediaOutSec?: number
  fitMode: 'cover' | 'contain'
  playbackMode: 'trim' | 'loop' | 'freeze'
  /** Transition that overlaps this clip's tail with the next clip's head. */
  transitionOut?: VzTransitionConfig
  /** @deprecated — kept for backwards-compat JSON deserialization. Use transitionOut. */
  transition?: { type: VzTransitionType; durationSec: number }
}

export interface VzTimeline {
  enabled: boolean
  loop: boolean
  clips: VzTimelineClip[]
}

// ── Multi-lane timeline architecture ─────────────────────────────────
//
// Phase 1A introduces explicit lane concepts without breaking existing
// consumers. All existing VzTimelineClip consumers continue to work because
// VzTimelineMediaClip is a structural superset of VzTimelineClip.

/**
 * All timeline lane identifiers.
 *
 * - audio:            Visualizes the track loaded in the shared audio engine.
 *                     No media or timing data is stored in the timeline state;
 *                     useSharedAudio() is the single source of truth.
 * - video-background: Primary fullscreen visual source. Clips are arranged
 *                     sequentially and support transitions between them.
 * - overlays:         Timed overlay clips composited above the background.
 *                     Clips use absolute start positions; multiple may be
 *                     active simultaneously.
 * - lyrics:           Sourced externally from useLyricsStore().cues. No clips
 *                     are stored in the timeline state for this lane.
 * - effects:          Timed automation regions for future runtime parameter
 *                     control. Phase 1A: stores identity, timing, and intensity.
 */
export type VzTimelineLaneId =
  | 'audio'
  | 'video-background'
  | 'overlays'
  | 'lyrics'
  | 'effects'

/**
 * Lane IDs that hold stored media clips.
 * Audio playback and lyric cues are owned by external systems and are never
 * duplicated into the timeline state.
 */
export type VzTimelineMediaLaneId = 'video-background' | 'overlays'

/**
 * A lane-aware media clip for the multi-lane timeline.
 *
 * Extends VzTimelineClip so that all existing consumers (canvas renderer,
 * clip inspector, render-source badge, etc.) continue to work without change
 * during the Phase 1A migration. The `lane` field is the only addition.
 *
 * Semantics by lane:
 * - video-background: primary fullscreen visual. Uses absolute startSec
 *   positions with transition overlap support. Sorted by startSec; gaps allowed.
 * - overlays: timed composited content drawn above the background. Absolute
 *   startSec positions. compositingConfig controls position/scale/rotation.
 */
export interface VzTimelineMediaClip extends VzTimelineClip {
  /** Which media lane this clip belongs to. */
  lane: VzTimelineMediaLaneId
  /**
   * Compositing configuration for overlay lane clips.
   * Undefined = backward-compatible full-canvas cover render (legacy behavior).
   * When set, the renderer uses position/scale/rotation/opacity/blendMode from
   * this config instead of the default fullscreen fit.
   */
  compositingConfig?: VzOverlayCompositingConfig
}

/**
 * Per-clip compositing properties for overlay lane clips.
 * All positions are normalized 0–1 relative to canvas width/height.
 */
export interface VzOverlayCompositingConfig {
  /** Horizontal anchor: 0=left edge, 0.5=center, 1=right edge */
  posX: number
  /** Vertical anchor: 0=top edge, 0.5=center, 1=bottom edge */
  posY: number
  /** Scale multiplier applied after natural contain sizing (1 = fit canvas) */
  scale: number
  /** Rotation in degrees */
  rotation: number
  /** Opacity: 0–1 */
  opacity: number
  /** Canvas globalCompositeOperation string */
  blendMode: string
  /** How the media fills its draw area before scale is applied */
  fitMode: 'cover' | 'contain'
}

export const DEFAULT_OVERLAY_COMPOSITING: VzOverlayCompositingConfig = {
  posX: 0.5, posY: 0.5, scale: 1, rotation: 0,
  opacity: 1, blendMode: 'source-over', fitMode: 'contain',
}

/**
 * A time-bounded region on the effects lane.
 *
 * Phase 1A: stores effect identity, timing, enabled state, and a scalar
 * intensity override. Sufficient for timed on/off control and simple
 * intensity envelopes.
 *
 * Phase 2+: `meta` expands into a full keyframe map for per-parameter
 * automation and runtime effect modulation.
 */
export interface VzTimelineEffectRegion {
  id: string
  /** Effect registry key (e.g. 'RGB Split', 'Bloom'). Must match an entry in the
   *  effect registry so the renderer can look up its draw function. */
  effectId: string
  startSec: number
  durationSec: number
  /** When false the region is stored but not applied during playback. */
  enabled: boolean
  /**
   * Scalar intensity override (0–1). undefined = use the current store value.
   * In Phase 2+, this will be superseded by a keyframe map in `meta`.
   */
  intensity?: number
  /**
   * Where the effect is applied:
   * - 'global'    — full-canvas (default / legacy behavior when absent)
   * - 'layer'     — only the named VzLayerConfigId entries in targetIds
   * - 'layerItem' — only the VzLayerItem IDs listed in targetIds
   * - 'clip'      — only the VzTimelineMediaClip IDs listed in targetIds
   */
  targetType?: 'global' | 'layer' | 'layerItem' | 'clip'
  /** IDs of the targeted entities. Empty or absent = global. */
  targetIds?: string[]
  /** Reserved for Phase 2+ automation and keyframe metadata. */
  meta?: Record<string, unknown>
}

/**
 * Human-readable labels for all timeline lane IDs.
 * Used by future UI panels that display lane headers.
 */
export const TIMELINE_LANE_LABELS: Record<VzTimelineLaneId, string> = {
  'audio':            'Audio',
  'video-background': 'Background',
  'overlays':         'Overlays',
  'lyrics':           'Lyrics',
  'effects':          'Effects',
}

/**
 * The complete multi-lane timeline state stored in visualStore.
 *
 * External sources (NOT stored here):
 * - Audio playback: owned by useSharedAudio() in AudioEngineContext.
 * - Lyric cues:     owned by useLyricsStore().cues.
 *
 * Stored lanes:
 * - bgClips:        video-background lane — sequential clips, primary visual source.
 * - overlayClips:   overlays lane — absolute-positioned timed clips.
 * - effectRegions:  effects lane — timed automation regions.
 */
export interface VzMultiLaneTimeline {
  enabled: boolean
  loop: boolean
  /** Background/video lane — replaces the old flat clips array. Sequential. */
  bgClips: VzTimelineMediaClip[]
  /** Overlay lane — composited above the background. Absolute positions. */
  overlayClips: VzTimelineMediaClip[]
  /** Effects automation lane — timed regions for future runtime automation. */
  effectRegions: VzTimelineEffectRegion[]
}
