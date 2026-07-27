import {
  applyScopeChannelMatrix,
  computeChannelCorrelation,
  extractTriggerSource,
} from './ScopeChannelMatrix'
import { ScopePeriodEstimator } from './ScopePeriodEstimator'
import { ScopeSignalConditioner } from './ScopeSignalConditioner'
import { ScopeTimebase, resolveWindowStartOffset } from './ScopeTimebase'
import { ScopeTrigger } from './ScopeTrigger'
import {
  isScopeXYSignalMode,
  type ScopeTrace,
  type SoundDrawingScopeState,
  type StereoScopeFrame,
} from './scopeTypes'

/** Upper bound on plotted points. Beyond this the extra detail is sub-pixel. */
const MAX_TRACE_POINTS = 4096

/** Extra capture headroom beyond the display window, for trigger search. */
const TRIGGER_SEARCH_HEADROOM = 1.5

export interface ScopeSignalCoreInput {
  state: SoundDrawingScopeState
  /** Newest synchronized stereo window, or null when capture is unavailable. */
  frame: StereoScopeFrame | null
  /** Points to plot. Clamped to the window's sample count and MAX_TRACE_POINTS. */
  requestedPoints: number
  /** Seconds since the previous process() call. */
  deltaSeconds: number
  /** Canonical effective BPM, or 0 when unknown. */
  bpm: number
  /** True on a seek, loop wrap, or track change. Resets stateful DSP. */
  timingDiscontinuity: boolean
}

/**
 * Frames of capture the core wants available for a given display window.
 * Exposed so the canvas can size its `readLatest()` request without duplicating
 * the headroom rule.
 */
export function resolveScopeCaptureFrames(
  windowSeconds: number,
  searchWindowSeconds: number,
  sampleRate: number,
): number {
  const rate = sampleRate > 0 ? sampleRate : 48_000
  const windowFrames = Math.ceil(windowSeconds * rate * TRIGGER_SEARCH_HEADROOM)
  const searchFrames = Math.ceil(Math.max(0, searchWindowSeconds) * rate)
  return Math.max(512, windowFrames + searchFrames)
}

/**
 * The professional scope signal core.
 *
 * Owns the DSP chain — matrix → condition → estimate period → trigger → timebase
 * → resample — and produces one `ScopeTrace` per frame. It holds no rendering
 * concepts and no React state, so the Canvas2D path and a future GPU beam
 * renderer consume exactly the same resolved trace.
 *
 * All working buffers are allocated once and reused, so a steady render loop
 * performs no per-frame allocation.
 */
export class ScopeSignalCore {
  private readonly conditioner = new ScopeSignalConditioner()
  private readonly trigger = new ScopeTrigger()
  private readonly timebase = new ScopeTimebase()
  private readonly periodEstimator = new ScopePeriodEstimator()

  // Matrixed full-window buffers.
  private matrixX = new Float32Array(MAX_TRACE_POINTS)
  private matrixY = new Float32Array(MAX_TRACE_POINTS)
  private matrixSecondary = new Float32Array(MAX_TRACE_POINTS)
  private triggerSource = new Float32Array(MAX_TRACE_POINTS)

  // Resampled display buffers handed to consumers.
  private readonly outX = new Float32Array(MAX_TRACE_POINTS)
  private readonly outY = new Float32Array(MAX_TRACE_POINTS)
  private readonly outSecondary = new Float32Array(MAX_TRACE_POINTS)

  private sequence = 0
  private proceduralPhase = 0
  private lastFrameSequence = -1

  /** Clears trigger, filter, period, and timebase history. */
  reset(): void {
    this.conditioner.reset()
    this.trigger.reset()
    this.timebase.reset()
    this.periodEstimator.reset()
    this.lastFrameSequence = -1
  }

  /** Re-arms a latched single-shot trigger. */
  rearmSingleTrigger(): void {
    this.trigger.rearmSingle()
  }

  /**
   * Produces the trace for one frame.
   *
   * Returns null when there is nothing legitimate to draw. Callers fall back to
   * their existing path rather than showing a fabricated signal.
   */
  process(input: ScopeSignalCoreInput): ScopeTrace | null {
    const { state, frame, deltaSeconds } = input
    if (!frame || frame.left.length === 0) return null

    if (input.timingDiscontinuity || frame.sequenceNumber <= this.lastFrameSequence) {
      // A rewound or repeated sequence means the ring reset under us; stale
      // filter and trigger history would smear the old audio into the new.
      this.reset()
    }
    this.lastFrameSequence = frame.sequenceNumber

    const sampleRate = frame.sampleRate > 0 ? frame.sampleRate : 48_000
    const available = Math.min(frame.left.length, frame.right.length)
    if (available < 4) return null

    this.ensureCapacity(available)

    // ── Period estimation ─────────────────────────────────────────────────────
    // Runs on the trigger source so it describes the signal being triggered on,
    // not the matrixed display geometry.
    const triggerLength = extractTriggerSource(
      frame.left,
      frame.right,
      available,
      state.trigger.source,
      this.triggerSource,
    )
    const period = this.periodEstimator.estimate(this.triggerSource, triggerLength, sampleRate)

    // ── Timebase ──────────────────────────────────────────────────────────────
    const timebase = this.timebase.resolve({
      settings: state.timebase,
      sampleRate,
      periodSamples: period.periodSamples,
      periodConfidence: period.confidence,
      bpm: input.bpm,
    })
    const windowSamples = Math.min(timebase.windowSamples, available)

    // ── Trigger ───────────────────────────────────────────────────────────────
    const searchSamples = Math.min(
      triggerLength,
      Math.max(windowSamples, Math.ceil(state.trigger.searchWindowSeconds * sampleRate)),
    )
    const triggerResult = this.trigger.process(
      this.triggerSource,
      searchSamples,
      sampleRate,
      state.trigger,
      period.periodSamples,
      period.confidence,
      deltaSeconds,
      // The trigger search starts at frame.left[0], whose absolute capture index
      // is frame.startFrame. Continuity is judged in those coordinates.
      frame.startFrame,
    )

    const startOffset = resolveWindowStartOffset(
      triggerResult.position,
      windowSamples,
      available,
      state.trigger.preTriggerRatio,
      state.timebase.horizontalPosition,
    )

    // ── Channel matrix ────────────────────────────────────────────────────────
    this.proceduralPhase = (this.proceduralPhase + deltaSeconds * 0.8) % (Math.PI * 2)
    const matrix = applyScopeChannelMatrix(
      {
        left: frame.left,
        right: frame.right,
        length: windowSamples,
        sourceOffset: startOffset,
        mode: state.signalMode,
        monoDelaySamples: Math.max(1, Math.round((state.monoDelayMs / 1000) * sampleRate)),
        proceduralPhase: this.proceduralPhase,
      },
      { x: this.matrixX, y: this.matrixY, secondaryY: this.matrixSecondary },
    )
    if (matrix.length < 2) return null

    // ── Conditioning ──────────────────────────────────────────────────────────
    this.conditioner.setSettings(state.signalConditioner)
    const isXY = isScopeXYSignalMode(state.signalMode)
    if (isXY) {
      this.conditioner.process(this.matrixX, this.matrixY, matrix.length, sampleRate)
    } else {
      this.conditioner.processWaveform(
        this.matrixY,
        matrix.hasSecondary ? this.matrixSecondary : null,
        matrix.length,
        sampleRate,
      )
    }

    // ── Resample to display points ────────────────────────────────────────────
    const points = Math.max(
      2,
      Math.min(MAX_TRACE_POINTS, Math.floor(input.requestedPoints), matrix.length),
    )
    resampleLinear(this.matrixX, matrix.length, this.outX, points)
    resampleLinear(this.matrixY, matrix.length, this.outY, points)
    const hasSecondary = matrix.hasSecondary
    if (hasSecondary) resampleLinear(this.matrixSecondary, matrix.length, this.outSecondary, points)

    this.sequence++

    return {
      x: this.outX,
      y: this.outY,
      length: points,
      secondaryY: hasSecondary ? this.outSecondary : null,
      hasSecondary,
      mode: state.signalMode,
      isXY,
      windowSeconds: windowSamples / sampleRate,
      trigger: triggerResult,
      correlation: computeChannelCorrelation(frame.left, frame.right, available),
      monoSource: frame.channelCount < 2,
      sequenceNumber: this.sequence,
    }
  }

  /** Grows the full-window scratch buffers when a longer window is requested. */
  private ensureCapacity(samples: number): void {
    if (this.matrixX.length >= samples) return
    const size = nextPowerOfTwo(samples)
    this.matrixX = new Float32Array(size)
    this.matrixY = new Float32Array(size)
    this.matrixSecondary = new Float32Array(size)
    this.triggerSource = new Float32Array(size)
  }
}

/**
 * Linear resample from `sourceLength` samples to `targetLength` points.
 *
 * Rejects non-finite inputs so one bad sample cannot propagate a NaN through
 * geometry and blank an entire trace.
 */
export function resampleLinear(
  source: Float32Array,
  sourceLength: number,
  target: Float32Array,
  targetLength: number,
): void {
  if (targetLength <= 0 || sourceLength <= 0) return
  if (sourceLength === 1) {
    const only = finite(source[0])
    for (let i = 0; i < targetLength; i++) target[i] = only
    return
  }

  const step = (sourceLength - 1) / Math.max(1, targetLength - 1)
  for (let i = 0; i < targetLength; i++) {
    const position = i * step
    const index = Math.floor(position)
    const fraction = position - index
    const a = finite(source[Math.min(index, sourceLength - 1)])
    const b = finite(source[Math.min(index + 1, sourceLength - 1)])
    target[i] = a + (b - a) * fraction
  }
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function nextPowerOfTwo(value: number): number {
  let size = 512
  while (size < value) size <<= 1
  return size
}
