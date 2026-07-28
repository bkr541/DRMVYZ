import { DEFAULT_SCOPE_MUSIC_MAPPING, type ScopeMusicMappingSettings } from './scopeMusicMapping'

// ── Professional scope signal core: contracts ────────────────────────────────
//
// These types describe the *signal* half of Sound Drawing's professional scope:
// stereo capture, channel matrixing, conditioning, triggering, and timebase.
// Nothing here knows about rendering. Geometry consumers (Canvas2D today, a GPU
// beam renderer later) read the resolved trace this core produces.
//
// Beam profile and phosphor persistence remain renderer-owned and are derived
// from the quality plan rather than persisted. CRT presentation IS persisted,
// because it is a look the user authors rather than a performance tier — it
// arrived in version 2 through the migration this file was versioned for.

/**
 * How left/right samples are matrixed into the plotted X and Y axes.
 *
 * `monoDelayXY` is the honest name for DRMVYZ's long-standing "Lissajous" mode:
 * it plots one channel against a delayed copy of itself. It is an expressive
 * phase portrait, not a stereo measurement, and is preserved (and migrated to)
 * so existing projects keep their appearance.
 */
export type ScopeSignalMode =
  | 'left'
  | 'right'
  | 'dualWaveform'
  | 'stereoXY'
  | 'midSideXY'
  | 'sumDifferenceXY'
  | 'mono'
  | 'monoDelayXY'
  | 'bandSplitXY'
  | 'proceduralFallback'

/** Signal modes that measure a genuine relationship between the two channels. */
export const SCOPE_MEASUREMENT_SIGNAL_MODES: readonly ScopeSignalMode[] = [
  'left',
  'right',
  'dualWaveform',
  'stereoXY',
  'midSideXY',
  'sumDifferenceXY',
  'mono',
]

/** Signal modes that are creative interpretations rather than measurements. */
export const SCOPE_CREATIVE_SIGNAL_MODES: readonly ScopeSignalMode[] = [
  'monoDelayXY',
  'bandSplitXY',
  'proceduralFallback',
]

/** True when the mode plots X against Y rather than value against time. */
export function isScopeXYSignalMode(mode: ScopeSignalMode): boolean {
  return (
    mode === 'stereoXY' ||
    mode === 'midSideXY' ||
    mode === 'sumDifferenceXY' ||
    mode === 'monoDelayXY' ||
    mode === 'bandSplitXY'
  )
}

/**
 * True when the mode makes a claim about actual stereo channel relationships.
 * The UI uses this to avoid presenting a mono-derived portrait as stereo
 * measurement, and to warn when a genuinely mono source is selected.
 */
export function isScopeStereoMeasurementMode(mode: ScopeSignalMode): boolean {
  return mode === 'stereoXY' || mode === 'midSideXY' || mode === 'sumDifferenceXY'
}

// ── Capture ───────────────────────────────────────────────────────────────────

/** One synchronized stereo window read out of the capture ring buffer. */
export interface StereoScopeFrame {
  left: Float32Array
  right: Float32Array
  sampleRate: number
  /** Absolute sample-frame index of left[0]/right[0] since capture started. */
  startFrame: number
  /** Monotonic counter incremented once per successful read. */
  sequenceNumber: number
  audioTimeSeconds: number
  /** Channel count of the underlying source. 1 means R was duplicated from L. */
  channelCount: number
}

/** Health of the capture path, surfaced for diagnostics and UI honesty. */
export interface StereoScopeCaptureStatus {
  /** True once the worklet is running and producing blocks. */
  active: boolean
  /** Reason capture is unavailable; null while healthy. */
  unavailableReason: ScopeCaptureUnavailableReason | null
  sampleRate: number
  channelCount: number
  /** Frames currently readable from the ring buffer. */
  availableFrames: number
  /** Sample frames lost to worklet pool exhaustion or main-thread stalls. */
  droppedFrames: number
  /** Count of detected gaps in the frame counter (suspend/resume, reconnection). */
  discontinuities: number
}

export type ScopeCaptureUnavailableReason =
  | 'notStarted'
  | 'workletUnsupported'
  | 'workletLoadFailed'
  | 'awaitingFirstBlock'
  | 'disposed'

// ── Conditioning ──────────────────────────────────────────────────────────────

export interface ScopeSignalConditionerSettings {
  coupling: 'dc' | 'ac'
  /** Cutoff of the DC blocker used when coupling is 'ac'. */
  dcBlockHz: number

  gainX: number
  gainY: number

  offsetX: number
  offsetY: number

  invertX: boolean
  invertY: boolean
  swapAxes: boolean
}

export const DEFAULT_SCOPE_SIGNAL_CONDITIONER: ScopeSignalConditionerSettings = {
  coupling: 'dc',
  dcBlockHz: 12,
  gainX: 1,
  gainY: 1,
  offsetX: 0,
  offsetY: 0,
  invertX: false,
  invertY: false,
  swapAxes: false,
}

// ── Trigger ───────────────────────────────────────────────────────────────────

export type ScopeTriggerMode = 'auto' | 'normal' | 'freeRun' | 'single'
export type ScopeTriggerSlope = 'rising' | 'falling' | 'either'
export type ScopeTriggerSource = 'left' | 'right' | 'mid' | 'side' | 'sum' | 'difference'

export interface ScopeTriggerSettings {
  mode: ScopeTriggerMode
  source: ScopeTriggerSource
  slope: ScopeTriggerSlope

  /** Crossing level in normalized sample units (−1..1). */
  level: number
  /** Schmitt band half-width. The signal must leave the band before re-arming. */
  hysteresis: number
  /** Minimum time between accepted triggers. */
  holdoffSeconds: number

  /** How far back from the newest sample a trigger may be searched for. */
  searchWindowSeconds: number
  /** Fraction of the display drawn before the trigger point (0 = trigger at left edge). */
  preTriggerRatio: number

  /**
   * 0..1 preference for a candidate that continues the previous trace phase over
   * the strongest raw crossing. Higher values trade responsiveness for stillness.
   */
  continuityWeight: number
  /** 0..1 weight given to agreement with the estimated fundamental period. */
  periodAssist: number
  /** Seconds of failed acquisition before 'auto' mode falls back to free-run. */
  autoFallbackSeconds: number
}

export const DEFAULT_SCOPE_TRIGGER: ScopeTriggerSettings = {
  mode: 'auto',
  source: 'mid',
  slope: 'rising',
  level: 0,
  hysteresis: 0.02,
  holdoffSeconds: 0.002,
  searchWindowSeconds: 0.05,
  preTriggerRatio: 0,
  continuityWeight: 0.5,
  periodAssist: 0.5,
  autoFallbackSeconds: 0.35,
}

/** Result of one trigger acquisition attempt. */
export interface ScopeTriggerResult {
  /** Fractional sample index into the searched buffer. −1 when unresolved. */
  position: number
  /** True when this frame acquired a fresh trigger rather than reusing/free-running. */
  acquired: boolean
  /** True when the display is free-running because acquisition failed or is disabled. */
  freeRunning: boolean
  /** 0..1 acquisition confidence; decays while reusing a stale trigger. */
  confidence: number
  /** Estimated period in samples, or 0 when unknown. */
  periodSamples: number
}

// ── Timebase ──────────────────────────────────────────────────────────────────

export type ScopeTimebaseMode = 'seconds' | 'cycles' | 'beatRelative' | 'auto'

export type ScopeBeatDivision = '1/16' | '1/8' | '1/4' | '1/2' | '1beat' | '2beats' | '1bar'

export interface ScopeTimebaseSettings {
  mode: ScopeTimebaseMode

  /** Audio time spanned by the full display width in 'seconds' mode. */
  secondsPerDisplay: number
  /** −1..1 horizontal offset of the window relative to the trigger point. */
  horizontalPosition: number

  /** Detected periods spanned by the display in 'cycles' mode. */
  visibleCycles: number

  beatDivision: ScopeBeatDivision

  autoMinimumSeconds: number
  autoMaximumSeconds: number
  /** 0..1 smoothing applied to window changes. 1 freezes the current window. */
  smoothing: number
}

export const DEFAULT_SCOPE_TIMEBASE: ScopeTimebaseSettings = {
  mode: 'auto',
  secondsPerDisplay: 0.02,
  horizontalPosition: 0,
  visibleCycles: 3,
  beatDivision: '1/4',
  autoMinimumSeconds: 0.004,
  autoMaximumSeconds: 0.12,
  smoothing: 0.85,
}



// ── Beam and phosphor ─────────────────────────────────────────────────────────
//
// Music Intelligence mapping lives in `scopeMusicMapping.ts`, re-exported through
// the state here because it is persisted alongside the rest.

export interface ScopeBeamSettings {
  /** Bright inner core width in pixels, before audio reactivity. */
  coreWidthPx: number
  /** Halo diameter as a multiple of the core width. */
  haloScale: number
  /** 0..1 how much bass widens the beam. 0 is a constant-width trace. */
  bassWidthResponse: number
  /**
   * 0..1 how strongly a slow-moving beam reads brighter than a fast one.
   *
   * The physical effect a real beam has and the reason corners glow: the spot
   * dwells longer where it turns. 0 flattens it to uniform brightness.
   */
  velocityBrightness: number
  /** Extra brightness at corners and cusps, 0..1. */
  cornerDwell: number
}

/**
 * Calibrated against footage of real analogue scopes rather than against a neon
 * aesthetic.
 *
 * A CRT electron beam draws a *hairline* — one or two pixels of intensely bright
 * core with glow hugging it within a few pixels. Earlier defaults produced a
 * ~10px soft tube with a wide diffuse halo, which reads as a neon sign rather
 * than as an instrument. Width and halo are both far tighter here, and the
 * brightness that makes it read as a beam comes from exposure, not from size.
 */
export const DEFAULT_SCOPE_BEAM: ScopeBeamSettings = {
  coreWidthPx: 0.8,
  haloScale: 2.4,
  bassWidthResponse: 0.35,
  velocityBrightness: 0.75,
  cornerDwell: 0.55,
}

export interface ScopePhosphorSettings {
  /**
   * Phosphor time constant in seconds — how long the trail takes to fade.
   *
   * Distinct from the Canvas2D `trailDecay` control, which is a 0..1 rate. This
   * is stated in seconds because that is the observable property of a phosphor
   * and it is what makes the decay frame-rate independent.
   */
  persistenceSeconds: number
  /** 0..1 multiplier on the tight bloom level. */
  tightBloom: number
  /** 0..1 multiplier on the medium bloom level. */
  mediumBloom: number
  /** 0..1 multiplier on the wide bloom level. */
  wideBloom: number
  /**
   * 0..1 how readily bright pixels desaturate toward white.
   *
   * This is what makes overlapping strokes read as hot rather than merely
   * bright. 0 keeps every pixel at its trace hue.
   */
  whiteHot: number
  /** 0..1 glow the unexcited tube retains, so black is never absolute. */
  backgroundLift: number
}

/**
 * Bloom weighted heavily toward the tight level.
 *
 * On real hardware the glow is a tight aura on the line, not an atmospheric
 * wash. The medium and wide levels are what make a trace look like a light
 * source rather than a beam, so they sit low by default and the presets that
 * genuinely want a wash raise them.
 */
export const DEFAULT_SCOPE_PHOSPHOR: ScopePhosphorSettings = {
  persistenceSeconds: 0.35,
  tightBloom: 1,
  mediumBloom: 0.22,
  wideBloom: 0.08,
  whiteHot: 0.6,
  backgroundLift: 0.06,
}

// ── CRT presentation ──────────────────────────────────────────────────────────

/**
 * Phosphor colour response.
 *
 * Named for the look rather than for a specific tube. The brief is explicit that
 * claiming exact emulation of a particular Tektronix phosphor would be a
 * measurement claim this engine has not earned, so these are stylistic presets.
 */
export type ScopePhosphorModel = 'green' | 'amber' | 'blue' | 'white' | 'rgb' | 'custom'

export type ScopeGraticuleStyle = 'none' | 'minimal' | 'scope' | 'vectorscope'

export interface ScopeCrtSettings {
  enabled: boolean

  phosphorModel: ScopePhosphorModel
  /** Used only when phosphorModel is 'custom'. Hex string. */
  customPhosphorColor: string

  /** 0..1. Subtle by default; heavy scanlines destroy thin trace detail. */
  scanlineStrength: number
  /** Scanline pairs per 1000 device pixels. Resolution-aware, so scaling the
   *  output does not change how coarse the lines look. */
  scanlineDensity: number

  /** 0..1 barrel distortion. */
  curvature: number
  /** 0..1 corner darkening. */
  vignette: number
  /** 0..1 focus loss toward the tube edge. */
  edgeDefocus: number

  /** 0..1 static grain. */
  grain: number

  graticuleStyle: ScopeGraticuleStyle
  /** 0..1 graticule line brightness. */
  graticuleBrightness: number
}

/**
 * Defaults deliberately exclude every animated artifact.
 *
 * Flicker, vertical roll, and horizontal jitter are the CRT effects that carry
 * photosensitivity risk, and the accessibility requirement is that they have
 * safe defaults. They are therefore not part of this settings shape at all
 * rather than present-and-zeroed: a control that only ever hurts when raised,
 * shipped off, is still a control someone raises. Static character — scanlines,
 * curvature, vignette, grain — carries the CRT identity without motion.
 */
export const DEFAULT_SCOPE_CRT: ScopeCrtSettings = {
  enabled: false,
  phosphorModel: 'green',
  customPhosphorColor: '#4ac7db',
  scanlineStrength: 0.18,
  scanlineDensity: 320,
  curvature: 0.12,
  vignette: 0.35,
  edgeDefocus: 0.25,
  grain: 0.05,
  graticuleStyle: 'none',
  graticuleBrightness: 0.22,
}

/** Linear RGB for each phosphor model. */
export const SCOPE_PHOSPHOR_COLORS: Record<Exclude<ScopePhosphorModel, 'custom'>, readonly [number, number, number]> = {
  green: [0.28, 1.0, 0.42],
  amber: [1.0, 0.68, 0.18],
  blue: [0.42, 0.68, 1.0],
  white: [0.92, 0.96, 1.0],
  // 'rgb' leaves the trace colour untouched, for a colour vector display.
  rgb: [1.0, 1.0, 1.0],
}

// ── Persisted scope state ─────────────────────────────────────────────────────

/**
 * Versioned professional-scope configuration.
 *
 * Only serializable user configuration lives here. Ring buffers, WebGL
 * resources, trigger history, and telemetry are runtime-owned and must never be
 * persisted. `version` exists so the renderer patches can add beam, phosphor,
 * and CRT settings through a migration instead of shipping unused fields today.
 */
export interface SoundDrawingScopeStateV1 {
  version: 1
  /** Master switch for the professional signal core. Off keeps legacy behavior. */
  enabled: boolean
  signalMode: ScopeSignalMode
  signalConditioner: ScopeSignalConditionerSettings
  trigger: ScopeTriggerSettings
  timebase: ScopeTimebaseSettings
  /** Delay used by `monoDelayXY`, expressed in milliseconds. */
  monoDelayMs: number
  presetId: string | null
}

/**
 * Version 2 adds CRT presentation.
 *
 * V1 projects migrate by receiving `DEFAULT_SCOPE_CRT`, which has `enabled:
 * false` — so a project saved before the CRT layer existed renders exactly as it
 * did, and the look is opt-in.
 */
export interface SoundDrawingScopeStateV2 extends Omit<SoundDrawingScopeStateV1, 'version'> {
  version: 2
  crt: ScopeCrtSettings
}

/**
 * Version 3 exposes beam and phosphor tuning.
 *
 * These were previously hardcoded in the renderer. Their defaults reproduce
 * exactly the values that were compiled in, so a v2 project looks identical
 * after migration — the controls become adjustable, not different.
 */
export interface SoundDrawingScopeStateV3 extends Omit<SoundDrawingScopeStateV2, 'version'> {
  version: 3
  beam: ScopeBeamSettings
  phosphor: ScopePhosphorSettings
}

/**
 * Version 4 adds Music Intelligence mapping.
 *
 * Every amount defaults to zero, which is the identity mapping, so a v3 project
 * picks up the feature switched on but neutral and looks unchanged.
 */
export interface SoundDrawingScopeStateV4 extends Omit<SoundDrawingScopeStateV3, 'version'> {
  version: 4
  music: ScopeMusicMappingSettings
}

export type SoundDrawingScopeState = SoundDrawingScopeStateV4

export const SOUND_DRAWING_SCOPE_STATE_VERSION = 4

export const DEFAULT_SOUND_DRAWING_SCOPE_STATE: SoundDrawingScopeState = {
  version: 4,
  music: DEFAULT_SCOPE_MUSIC_MAPPING,
  beam: DEFAULT_SCOPE_BEAM,
  phosphor: DEFAULT_SCOPE_PHOSPHOR,
  crt: DEFAULT_SCOPE_CRT,
  enabled: false,
  signalMode: 'stereoXY',
  signalConditioner: DEFAULT_SCOPE_SIGNAL_CONDITIONER,
  trigger: DEFAULT_SCOPE_TRIGGER,
  timebase: DEFAULT_SCOPE_TIMEBASE,
  monoDelayMs: 2,
  presetId: null,
}

// ── Resolved trace ────────────────────────────────────────────────────────────

/**
 * The scope core's output for one frame: plotted points in normalized display
 * space, plus the measurement metadata a renderer or UI may want to show.
 *
 * `x`/`y` are views into core-owned buffers, valid until the next `process()`
 * call. Consumers copy if they need to retain them.
 */
export interface ScopeTrace {
  x: Float32Array
  y: Float32Array
  /** Valid sample count in x/y. */
  length: number
  /** Second trace for dual-waveform mode; length matches `length`. */
  secondaryY: Float32Array | null
  hasSecondary: boolean
  mode: ScopeSignalMode
  /** True when the mode plots X against Y rather than value against time. */
  isXY: boolean
  /** Audio seconds spanned by the trace. */
  windowSeconds: number
  trigger: ScopeTriggerResult
  /** −1..1 Pearson correlation between L and R over the window; 0 when unknown. */
  correlation: number
  /** True when the underlying source is genuinely single-channel. */
  monoSource: boolean
  /** Monotonic counter; unchanged when the core could not produce a new trace. */
  sequenceNumber: number
}
