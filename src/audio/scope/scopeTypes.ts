// ── Professional scope signal core: contracts ────────────────────────────────
//
// These types describe the *signal* half of Sound Drawing's professional scope:
// stereo capture, channel matrixing, conditioning, triggering, and timebase.
// Nothing here knows about rendering. Geometry consumers (Canvas2D today, a GPU
// beam renderer later) read the resolved trace this core produces.
//
// Rendering-side contracts (beam profile, phosphor persistence, CRT treatment)
// are deliberately absent — they belong to the renderer patches and are added to
// `SoundDrawingScopeState` through a versioned migration when they land, rather
// than being persisted now as unused fields.

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

export type SoundDrawingScopeState = SoundDrawingScopeStateV1

export const DEFAULT_SOUND_DRAWING_SCOPE_STATE: SoundDrawingScopeState = {
  version: 1,
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
