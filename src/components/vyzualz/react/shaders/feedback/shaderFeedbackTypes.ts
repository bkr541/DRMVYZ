// ── Blend modes ───────────────────────────────────────────────────────────────

export type FeedbackBlendMode =
  | 'normal'
  | 'additive'
  | 'screen'
  | 'maximumLuma'
  | 'multiply'
  | 'difference'

/** Maps FeedbackBlendMode to the integer sent to the GLSL u_blendMode uniform. */
export const FEEDBACK_BLEND_MODE_INT: Readonly<Record<FeedbackBlendMode, number>> = {
  normal:      0,
  additive:    1,
  screen:      2,
  maximumLuma: 3,
  multiply:    4,
  difference:  5,
}

// ── Reset conditions ──────────────────────────────────────────────────────────

export type FeedbackResetCondition =
  | 'sceneChange'
  | 'trackChange'
  | 'playbackRestart'
  | 'sectionChange'
  | 'dropImpact'
  | 'contextRestore'
  | 'resolutionChange'

// ── Per-frame parameters ──────────────────────────────────────────────────────

/**
 * Live parameter snapshot for one feedback frame.
 * All values are consumed by ShaderFeedbackPass each frame.
 * The modulation matrix supplies these values — no hard-coded audio mappings here.
 */
export interface FeedbackParams {
  /** 0..1 — fraction of the previous frame to keep (0=full decay, 1=no decay). */
  decay:          number
  /** ≥0.5 — 1.0=no zoom, >1.0 zooms in toward center. */
  zoom:           number
  /** Radians — rotates the feedback sample point around the center. */
  rotation:       number
  /** -1..1 — horizontal scroll of the feedback UV. */
  translationX:   number
  /** -1..1 — vertical scroll of the feedback UV. */
  translationY:   number
  /** 0..1 — noise-texture displacement of the feedback UV. */
  noiseDisp:      number
  /** Radians — direction of directional smear. */
  smearAngle:     number
  /** 0..1 — strength of directional smear. */
  smearStrength:  number
  /** 0..1 — RGB channel separation (lateral chromatic aberration). */
  chromaticSep:   number
  /** 0..1 — how strongly bright pixels resist decay. */
  lumaRetention:  number
  /** 0=grayscale, 1=normal, >1=hypersaturated. */
  saturation:     number
  /** Multiplier — 1.0=neutral, >1.0 boosts brightness. */
  brightness:     number
  /** When true the feedback output is frozen (no scene mixing, no decay). */
  freeze:         boolean
  /** 0..1 — blends the output toward black (clear pulse, e.g. on downbeat). */
  clearPulse:     number
  blendMode:      FeedbackBlendMode
}

export const DEFAULT_FEEDBACK_PARAMS: Readonly<FeedbackParams> = {
  decay:         0.96,
  zoom:          1.0,
  rotation:      0.0,
  translationX:  0.0,
  translationY:  0.0,
  noiseDisp:     0.0,
  smearAngle:    0.0,
  smearStrength: 0.0,
  chromaticSep:  0.0,
  lumaRetention: 0.0,
  saturation:    1.0,
  brightness:    1.0,
  freeze:        false,
  clearPulse:    0.0,
  blendMode:     'normal',
}

// ── Reset configuration ───────────────────────────────────────────────────────

/**
 * Per-definition configuration for when the feedback buffer should reset.
 * Used by ShaderFeedbackController to track cross-frame state transitions.
 */
export interface FeedbackResetConfig {
  /** Reset on shader scene change (default true). */
  onSceneChange?:       boolean
  /** Reset when the active track changes (default true). */
  onTrackChange?:       boolean
  /** Reset when playback restarts from a position before the last frame (default true). */
  onPlaybackRestart?:   boolean
  /** Reset when the music section type changes (default false). */
  onSectionChange?:     boolean
  /** Reset when drop impact exceeds a threshold (default false). */
  onDropImpact?:        boolean
  /** 0..1 — drop impact threshold, default 0.7. */
  dropImpactThreshold?: number
  /** Reset when render resolution changes (default true). */
  onResolutionChange?:  boolean
  /** Reset after WebGL context restoration (default true). */
  onContextRestore?:    boolean
}

export const DEFAULT_FEEDBACK_RESET_CONFIG: Required<FeedbackResetConfig> = {
  onSceneChange:       true,
  onTrackChange:       true,
  onPlaybackRestart:   true,
  onSectionChange:     false,
  onDropImpact:        false,
  dropImpactThreshold: 0.7,
  onResolutionChange:  true,
  onContextRestore:    true,
}

// ── Signal for ShaderFeedbackController.update() ──────────────────────────────

export interface FeedbackFrameSignals {
  sceneId:     string
  trackId:     string | null
  playbackTime: number
  sectionType: string | null
  dropImpact:  number    // 0..1 from ShaderAudioUniformFrame
  w:           number    // render target width
  h:           number    // render target height
  contextJustRestored?: boolean
}
