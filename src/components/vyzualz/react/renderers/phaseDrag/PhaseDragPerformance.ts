import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { PHASE_DRAG_DIRECTIONS, type CanvasPhaseDragSettings } from './PhaseDragSettings'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export interface PhaseDragDecision {
  reset: boolean
  positionReset: boolean
  phase: number
  direction: CanvasPhaseDragSettings['direction']
  depth: number
  slitWidth: number
  ripple: number
  reconstruction: number
}

export class PhaseDragPerformance {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private held = false
  private bass = { value: 0, initialized: false }
  private build = { value: 0, initialized: false }
  private reconstruction = { value: 0, initialized: false }
  private accents = { kick: 0, snare: 0, drop: 0 }
  private phrase: number | null = null

  reset() {
    this.previous = null
    this.lastTime = null
    this.phrase = null
    this.bass.initialized = this.build.initialized = this.reconstruction.initialized = false
    this.accents = { kick: 0, snare: 0, drop: 0 }
  }

  update(input: { settings: CanvasPhaseDragSettings; context: SharedPerformanceContext | null; timeSec: number; deltaSec: number; paused: boolean; audioActive: boolean }): PhaseDragDecision {
    const { settings, context, timeSec, deltaSec } = input
    const freshContext = context !== this.previous
    const transport = context && freshContext ? resolveSharedPerformanceTransportTransition(this.previous, context) : null
    const held = input.paused || settings.freezeHistory
    const jump = this.lastTime === null ? 0 : timeSec - this.lastTime
    const positionReset = this.lastTime === null || jump < -1e-5 || jump > 0.5 || (input.paused && Math.abs(jump) > 1e-5)
      || Boolean(context && freshContext && (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected || context.boundaries.timingDiscontinuity || transport?.timingDiscontinuity))
    const reset = positionReset || (this.held && !held)
    if (reset) this.reset()
    const response = input.audioActive && context ? settings.audioReactivity : 0
    const grid = Boolean(context?.capabilities.beatGrid && context.confidence.grid > 0.15 && context.bpm > 0)
    const bands = context?.capabilities.liveBands && context.confidence.overall > 0.05
    const sections = context?.capabilities.sections && context.sectionConfidence > 0.15
    const rhythm = context?.capabilities.rhythmEvents && context.confidence.rhythm > 0.15
    const dt = Math.max(0, Math.min(0.1, deltaSec))
    const bass = smoothSharedPerformanceModulation(this.bass, bands && context ? clamp(context.bass * 0.75 + context.intelligence.bands.normalized.normalizedSub * 0.25) : 0, dt, 0.1, 0.35)
    const build = smoothSharedPerformanceModulation(this.build, sections && context ? clamp(context.buildProgress) : 0, dt, 0.15, 0.4)
    const calm = sections && (context.sectionType === 'breakdown' || context.sectionType === 'outro') ? 0.7 : sections && context.sectionType === 'intro' ? 0.35 : 0
    const reconstruction = smoothSharedPerformanceModulation(this.reconstruction, calm, dt, 0.4, 0.25)
    this.accents.kick *= Math.exp(-dt * 8)
    this.accents.snare *= Math.exp(-dt * 7)
    this.accents.drop *= Math.exp(-dt * 3)
    if (!reset && !held && response > 0 && context && freshContext) {
      if (rhythm && context.kick && !this.previous?.kick) this.accents.kick = clamp(context.kickStrength)
      if (rhythm && ((context.snare && !this.previous?.snare) || (context.transientConfidence > 0.15 && context.transient > 0.55 && (this.previous?.transient ?? 0) <= 0.55))) {
        this.accents.snare = clamp(Math.max(context.snareStrength, context.transient))
      }
      if ((sections && context.sectionType === 'drop' && context.boundaries.sectionEntry && context.sectionId !== this.previous?.sectionId)
        || (context.confidence.semantics > 0.15 && context.dropImpact > 0.55 && (this.previous?.dropImpact ?? 0) <= 0.55)) this.accents.drop = 1
      if (settings.autoPerformance && grid && context.confidence.phrase > 0.15 && context.boundaries.barBoundary && context.phraseIndex !== this.previous?.phraseIndex) this.phrase = context.phraseIndex
    }
    const clock = settings.bpmSync && input.audioActive && grid && context
      ? (context.absoluteBeat + (timeSec - context.audioTimeSec) * context.bpm / 60) / 4 : timeSec * 0.25
    const direction = settings.autoPerformance && response > 0 && grid && this.phrase !== null
      ? PHASE_DRAG_DIRECTIONS[(this.phrase + settings.deterministicSeed) % PHASE_DRAG_DIRECTIONS.length] : settings.direction
    this.previous = context
    this.lastTime = timeSec
    this.held = held
    return {
      reset, positionReset, direction,
      phase: (clock * settings.scanSpeed) % 1024 + (settings.deterministicSeed % 997) / 997,
      depth: clamp(0.72 + response * (0.21 * bass + 0.23 * build + 0.3 * this.accents.drop)),
      slitWidth: clamp(settings.slitWidth + response * this.accents.kick * 0.28),
      ripple: response * (this.accents.snare * 0.16 + (bands && context ? 0.035 * clamp(context.mid) + 0.02 * clamp(context.high) : 0)),
      reconstruction: clamp(settings.sourceMix + (1 - settings.sourceMix) * reconstruction * response),
    }
  }
}
