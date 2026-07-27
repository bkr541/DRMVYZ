import type { PixGridCompiledMask } from './PixGridGroups'
import { pixGridMaskHasCell } from './PixGridGroups'
import type { PixGridLogicalFrame } from './PixGridCompositor'
import type { PixGridUnifiedRuntimeDiagnostics } from './PixGridUnifiedPerformanceRuntime'
import type { PixGridAudioFrame, PixGridState } from './PixGridTypes'
import { pearsonCorrelation } from './PixGridPerceptualMetrics'

export const PIX_GRID_PERCEPTUAL_SAMPLE_INTERVAL_MS = 90
export const PIX_GRID_PERCEPTUAL_HISTORY_LIMIT = 48

export interface PixGridPerceptualResponseMetrics {
  sampleSequence: number
  changedVisibleCellCount: number
  changedVisibleCellPercentage: number
  meanBrightnessDelta: number
  peakBrightnessDelta: number
  meanPerceptualColorDistance: number
  localizedGroupChangePercentage: number
  currentAudioOnsetStrength: number
  recentOnsetToPixelCorrelation: number
  activeEnvelopeCount: number
  sceneTransitionActivity: number
  silenceBaselineDifference: number
  visibleCellCount: number
  affectedGroupCellCount: number
}

export type PixGridTruthfulReactivityState =
  | 'audio-unavailable'
  | 'audio-available-no-valid-routes'
  | 'fallback-routes-active'
  | 'routes-below-threshold'
  | 'target-masks-empty'
  | 'output-likely-imperceptible'
  | 'visible-music-reaction-detected'
  | 'performance-program-transition-active'
  | 'autonomous-motion-only'
  | 'migration-incomplete'
  | 'canonical-preset-fully-active'

export interface PixGridTruthfulReactivityStatus {
  state: PixGridTruthfulReactivityState
  label: string
  tone: 'positive' | 'neutral' | 'warning' | 'error'
  message: string
  flags: readonly PixGridTruthfulReactivityState[]
}

export interface PixGridPerceptualSampleInput {
  frame: PixGridLogicalFrame
  audioFrame: PixGridAudioFrame
  activeGroupMasks: readonly PixGridCompiledMask[]
  activeEnvelopeCount: number
  sceneTransitionActivity: number
  nowMs: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function brightness(pixels: Uint8Array, offset: number): number {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722
}

function colorDistance(before: Uint8Array, after: Uint8Array, offset: number): number {
  const dr = after[offset] - before[offset]
  const dg = after[offset + 1] - before[offset + 1]
  const db = after[offset + 2] - before[offset + 2]
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11)
}

function onsetStrength(frame: PixGridAudioFrame): number {
  return clamp01(Math.max(
    frame.sourceValues?.kick ?? (frame.kickHit ? 1 : 0),
    frame.sourceValues?.snare ?? (frame.snareHit ? 1 : 0),
    frame.sourceValues?.hat ?? (frame.hatHit ? 1 : 0),
    frame.sourceValues?.transient ?? (frame.transientHit ? 1 : 0),
    frame.spectralFlux ?? 0,
  ))
}

function activeEnergy(frame: PixGridAudioFrame): number {
  return clamp01(Math.max(
    frame.energy ?? 0,
    frame.volume ?? 0,
    frame.bass ?? 0,
    frame.sourceValues?.energy ?? 0,
    frame.sourceValues?.bass ?? 0,
  ))
}

/**
 * Samples the logical compositor output at a bounded rate. The tracker owns two
 * fixed-size frame buffers and a fixed correlation window; it never retains a
 * raw analyser or pixel history.
 */
export class PixGridPerceptualResponseTracker {
  private previousPixels: Uint8Array | null = null
  private targetUnionBits = new Uint32Array(0)
  private width = 0
  private height = 0
  private lastSampleAt = Number.NEGATIVE_INFINITY
  private sequence = 0
  private silenceMeanBrightness = 0
  private silenceInitialized = false
  private readonly onsetHistory = new Float32Array(PIX_GRID_PERCEPTUAL_HISTORY_LIMIT)
  private readonly responseHistory = new Float32Array(PIX_GRID_PERCEPTUAL_HISTORY_LIMIT)
  private historyCount = 0
  private historyIndex = 0
  private lastMetrics: PixGridPerceptualResponseMetrics | null = null

  reset(): void {
    this.previousPixels = null
    this.width = 0
    this.targetUnionBits = new Uint32Array(0)
    this.height = 0
    this.lastSampleAt = Number.NEGATIVE_INFINITY
    this.sequence = 0
    this.silenceMeanBrightness = 0
    this.silenceInitialized = false
    this.onsetHistory.fill(0)
    this.responseHistory.fill(0)
    this.historyCount = 0
    this.historyIndex = 0
    this.lastMetrics = null
  }

  get snapshot(): PixGridPerceptualResponseMetrics | null {
    return this.lastMetrics
  }

  shouldSample(nowMs: number): boolean {
    return nowMs - this.lastSampleAt >= PIX_GRID_PERCEPTUAL_SAMPLE_INTERVAL_MS
  }

  sample(input: PixGridPerceptualSampleInput): PixGridPerceptualResponseMetrics | null {
    if (!this.shouldSample(input.nowMs)) return this.lastMetrics
    this.lastSampleAt = input.nowMs
    const { frame } = input
    const required = frame.width * frame.height * 4
    if (!this.previousPixels || this.previousPixels.length !== required || this.width !== frame.width || this.height !== frame.height) {
      this.previousPixels = new Uint8Array(required)
      this.previousPixels.set(frame.pixels)
      this.width = frame.width
      this.height = frame.height
    }

    const previous = this.previousPixels!
    const requiredMaskWords = Math.ceil(frame.width * frame.height / 32)
    if (this.targetUnionBits.length !== requiredMaskWords) this.targetUnionBits = new Uint32Array(requiredMaskWords)
    else this.targetUnionBits.fill(0)
    for (const mask of input.activeGroupMasks) {
      const words = Math.min(this.targetUnionBits.length, mask.bits.length)
      for (let word = 0; word < words; word += 1) this.targetUnionBits[word] = (this.targetUnionBits[word]! | mask.bits[word]!) >>> 0
    }
    let changedVisible = 0
    let visibleCells = 0
    let brightnessDeltaSum = 0
    let peakBrightnessDelta = 0
    let colorDistanceSum = 0
    let localizedChanged = 0
    let affectedGroupCellCount = 0
    let currentBrightnessSum = 0
    const totalCells = frame.width * frame.height

    for (let index = 0; index < totalCells; index += 1) {
      const offset = index * 4
      const visible = frame.pixels[offset + 3] > 0 || previous[offset + 3] > 0
      if (!visible) continue
      visibleCells += 1
      const currentBrightness = brightness(frame.pixels, offset)
      const beforeBrightness = brightness(previous, offset)
      currentBrightnessSum += currentBrightness
      const brightnessDelta = Math.abs(currentBrightness - beforeBrightness)
      const distance = colorDistance(previous, frame.pixels, offset)
      const alphaDelta = Math.abs(frame.pixels[offset + 3] - previous[offset + 3])
      const changed = brightnessDelta >= 10 || distance >= 16 || alphaDelta >= 16
      const targeted = pixGridMaskHasCell(this.targetUnionBits, index)
      if (targeted) affectedGroupCellCount += 1
      if (!changed) continue
      changedVisible += 1
      brightnessDeltaSum += brightnessDelta
      peakBrightnessDelta = Math.max(peakBrightnessDelta, brightnessDelta)
      colorDistanceSum += distance
      if (targeted) localizedChanged += 1
    }

    const changedDenominator = Math.max(1, changedVisible)
    const onset = onsetStrength(input.audioFrame)
    const responseMagnitude = clamp01(
      (changedVisible / Math.max(1, visibleCells)) * 4
      + (colorDistanceSum / changedDenominator) / 255
      + (peakBrightnessDelta / 255) * 0.25,
    )
    this.onsetHistory[this.historyIndex] = onset
    this.responseHistory[this.historyIndex] = responseMagnitude
    this.historyIndex = (this.historyIndex + 1) % PIX_GRID_PERCEPTUAL_HISTORY_LIMIT
    this.historyCount = Math.min(PIX_GRID_PERCEPTUAL_HISTORY_LIMIT, this.historyCount + 1)
    const onsetValues: number[] = []
    const responseValues: number[] = []
    for (let offset = 0; offset < this.historyCount; offset += 1) {
      const index = (this.historyIndex - this.historyCount + offset + PIX_GRID_PERCEPTUAL_HISTORY_LIMIT) % PIX_GRID_PERCEPTUAL_HISTORY_LIMIT
      onsetValues.push(this.onsetHistory[index]!)
      responseValues.push(this.responseHistory[index]!)
    }

    const meanBrightness = currentBrightnessSum / Math.max(1, visibleCells)
    const isQuiet = onset < 0.025 && activeEnergy(input.audioFrame) < 0.05 && input.activeEnvelopeCount === 0
    if (isQuiet) {
      this.silenceMeanBrightness = this.silenceInitialized
        ? this.silenceMeanBrightness * 0.94 + meanBrightness * 0.06
        : meanBrightness
      this.silenceInitialized = true
    }

    this.sequence += 1
    const metrics: PixGridPerceptualResponseMetrics = {
      sampleSequence: this.sequence,
      changedVisibleCellCount: changedVisible,
      changedVisibleCellPercentage: changedVisible / Math.max(1, visibleCells),
      meanBrightnessDelta: brightnessDeltaSum / changedDenominator,
      peakBrightnessDelta,
      meanPerceptualColorDistance: colorDistanceSum / changedDenominator,
      localizedGroupChangePercentage: localizedChanged / Math.max(1, affectedGroupCellCount),
      currentAudioOnsetStrength: onset,
      recentOnsetToPixelCorrelation: this.historyCount >= 8 ? pearsonCorrelation(onsetValues, responseValues) : 0,
      activeEnvelopeCount: input.activeEnvelopeCount,
      sceneTransitionActivity: clamp01(input.sceneTransitionActivity),
      silenceBaselineDifference: this.silenceInitialized ? Math.abs(meanBrightness - this.silenceMeanBrightness) : 0,
      visibleCellCount: visibleCells,
      affectedGroupCellCount,
    }
    previous.set(frame.pixels)
    this.lastMetrics = metrics
    return metrics
  }
}

function visibleReaction(metrics: PixGridPerceptualResponseMetrics | null): boolean {
  if (!metrics) return false
  const hasAudioEvidence = metrics.currentAudioOnsetStrength >= 0.08
    || metrics.activeEnvelopeCount > 0
    || metrics.sceneTransitionActivity > 0
    || metrics.silenceBaselineDifference >= 4
  return hasAudioEvidence
    && metrics.changedVisibleCellPercentage >= 0.008
    && metrics.meanPerceptualColorDistance >= 12
    && (metrics.localizedGroupChangePercentage >= 0.006 || metrics.silenceBaselineDifference >= 4)
}

export function resolvePixGridTruthfulReactivityStatus(input: {
  state: PixGridState
  runtime: PixGridUnifiedRuntimeDiagnostics | null
  metrics: PixGridPerceptualResponseMetrics | null
  validationErrorCount: number
}): PixGridTruthfulReactivityStatus {
  const { state, runtime, metrics, validationErrorCount } = input
  const flags: PixGridTruthfulReactivityState[] = []
  const activeRoutes = runtime?.routeActivity.filter(route => route.state === 'active' || route.state === 'fallback') ?? []
  const perceptible = activeRoutes.length > 0 && visibleReaction(metrics)
  const audioAvailable = runtime != null && runtime.audioInputStatus !== 'disconnected' && runtime.audioInputStatus !== 'stale'
  const migrationComplete = state.configuration.canonicalMigrationCompleted
  const emptyTargets = activeRoutes.length > 0 && activeRoutes.every(route => (route.visibleAffectedCellCount ?? route.compiledTargetCellCount ?? 0) === 0)
  const transitionActive = (runtime?.sceneTransitionActionCount ?? 0) > 0
  const autonomousOnly = (runtime?.autonomousAnimationCount ?? 0) > 0 && activeRoutes.length === 0
  const builtInCanonical = state.configuration.origin === 'builtInPreset' && migrationComplete && validationErrorCount === 0

  if (perceptible) flags.push('visible-music-reaction-detected')
  if (transitionActive) flags.push('performance-program-transition-active')
  if (runtime?.fallbackRoutesActive) flags.push('fallback-routes-active')
  if (builtInCanonical && perceptible) flags.push('canonical-preset-fully-active')

  if (!migrationComplete) return {
    state: 'migration-incomplete', label: 'Migration incomplete', tone: 'error', flags,
    message: 'Canonical layer, group, route, or performance-program integrity has not been confirmed.',
  }
  if (!audioAvailable) return {
    state: 'audio-unavailable', label: 'Audio unavailable', tone: 'error', flags,
    message: 'PixGrid is preserving stable visual content while analyser and shared-bus input are unavailable or stale.',
  }
  if (validationErrorCount > 0 || (!runtime?.activeAssignmentCount && !runtime?.fallbackRoutesActive)) return {
    state: 'audio-available-no-valid-routes', label: 'Audio available, no valid routes', tone: 'error', flags,
    message: 'Audio is present, but no validated assignment can currently reach visible PixGrid content.',
  }
  if (emptyTargets) return {
    state: 'target-masks-empty', label: 'Routes active, target masks empty', tone: 'error', flags,
    message: 'Assignments are executing, but their compiled targets contain no visible cells.',
  }
  if (builtInCanonical && perceptible) return {
    state: 'canonical-preset-fully-active', label: 'Canonical preset fully active', tone: 'positive', flags,
    message: 'Canonical migration, route execution, and visibly perceptible pixel response are all confirmed live.',
  }
  if (perceptible) return {
    state: 'visible-music-reaction-detected', label: 'Visible music reaction detected', tone: 'positive', flags,
    message: 'Audio onsets or sustained energy are producing material, localized changes in the logical framebuffer.',
  }
  if (transitionActive) return {
    state: 'performance-program-transition-active', label: 'Performance transition active', tone: 'neutral', flags,
    message: 'A section, phrase, scene, or Track Map transition is currently driving the visual state.',
  }
  if (runtime?.fallbackRoutesActive) return {
    state: 'fallback-routes-active', label: 'Fallback routes active', tone: 'warning', flags,
    message: 'Baseline live-source routing is active because authored routes are unavailable or ineffective.',
  }
  if (autonomousOnly) return {
    state: 'autonomous-motion-only', label: 'Autonomous motion only', tone: 'warning', flags,
    message: 'Pixels are moving, but no music assignment is currently producing visible output.',
  }
  if (activeRoutes.length > 0 && metrics && metrics.changedVisibleCellPercentage < 0.008) return {
    state: 'output-likely-imperceptible', label: 'Routes active, output likely imperceptible', tone: 'warning', flags,
    message: 'Assignments are executing, but rendered changes remain below the live perceptual floor.',
  }
  return {
    state: 'routes-below-threshold', label: 'Routes active, currently below threshold', tone: 'neutral', flags,
    message: 'Valid routes are ready, but current source values, confidence, or conditions have not produced a visible action.',
  }
}
