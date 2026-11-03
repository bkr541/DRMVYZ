import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasCellularSettings } from './CellularSettings'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export interface CellularDecision {
  reset: boolean
  positionReset: boolean
  step: number
  pulse: number
  edge: number
  amount: number
  reconstruction: number
}

export class CellularPerformance {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private wasPaused = false
  private bass = { initialized: false, value: 0 }
  private structure = { initialized: false, value: 0 }
  private calm = { initialized: false, value: 0 }
  private pulse = 0

  reset() {
    this.previous = null
    this.lastTime = null
    this.bass.initialized = this.structure.initialized = this.calm.initialized = false
    this.pulse = 0
  }

  update(input: { settings: CanvasCellularSettings; context: SharedPerformanceContext | null; timeSec: number; deltaSec: number; paused: boolean; audioActive: boolean }): CellularDecision {
    const { settings, context, timeSec, paused } = input
    const fresh = context !== this.previous
    const transport = context && fresh ? resolveSharedPerformanceTransportTransition(this.previous, context) : null
    const jump = this.lastTime === null ? 0 : timeSec - this.lastTime
    const positionReset = this.lastTime === null || jump < -1e-5 || jump > 0.5 || (paused && Math.abs(jump) > 1e-5)
      || Boolean(context && fresh && (context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected || context.boundaries.timingDiscontinuity || transport?.timingDiscontinuity))
    const reset = positionReset || (this.wasPaused && !paused)
    if (reset) this.reset()
    const response = input.audioActive && context ? settings.audioReactivity : 0
    const bands = context?.capabilities.liveBands && context.confidence.overall > 0.05
    const rhythm = context?.capabilities.rhythmEvents && context.confidence.rhythm > 0.15
    const structure = context?.capabilities.sections && context.sectionConfidence > 0.15
    const dt = paused ? 0 : Math.max(0, Math.min(input.deltaSec, 0.1))
    const bass = smoothSharedPerformanceModulation(this.bass, bands && context ? clamp(0.7 * context.bass + 0.3 * context.intelligence.bands.normalized.normalizedSub) : 0, dt, 0.1, 0.35)
    const build = smoothSharedPerformanceModulation(this.structure, structure && context ? clamp(context.buildProgress) : 0, dt, 0.2, 0.45)
    const section = structure && settings.autoPerformance ? context.sectionType : null
    const calmTarget = section === 'breakdown' || section === 'outro' ? 0.75 : section === 'intro' ? 0.35 : 0
    const calm = smoothSharedPerformanceModulation(this.calm, calmTarget, dt, 0.4, 0.3)
    this.pulse *= Math.exp(-dt * 7)
    if (!reset && !paused && fresh && response > 0 && context) {
      if (rhythm && context.kick && !this.previous?.kick) this.pulse = Math.max(this.pulse, 0.6 * clamp(context.kickStrength))
      if (rhythm && ((context.snare && !this.previous?.snare) || (context.transientConfidence > 0.15 && context.transient > 0.55 && (this.previous?.transient ?? 0) <= 0.55))) {
        this.pulse = Math.max(this.pulse, 0.35 * clamp(Math.max(context.snareStrength, context.transient)))
      }
      if ((structure && context.sectionType === 'drop' && context.boundaries.sectionEntry && context.sectionId !== this.previous?.sectionId)
        || (context.confidence.semantics > 0.15 && context.dropImpact > 0.55 && (this.previous?.dropImpact ?? 0) <= 0.55)) this.pulse = 1
    }
    const tempo = settings.bpmSync && input.audioActive && context?.capabilities.beatGrid && context.confidence.grid > 0.15 && context.bpm > 0
      ? Math.max(0.5, Math.min(2, context.bpm / 120)) : 1
    const detail = bands && context ? 0.15 * clamp(context.mid) + 0.1 * clamp(context.high) : 0
    this.previous = context
    this.lastTime = timeSec
    this.wasPaused = paused
    return {
      reset, positionReset,
      step: clamp(dt * 36 * settings.speed * tempo * (1 + response * (0.5 * bass + 0.25 * build))),
      pulse: this.pulse * response,
      edge: clamp(settings.edge + detail * response),
      amount: clamp(settings.amount * (1 + response * 0.3 * build)),
      reconstruction: clamp(settings.sourceMix + (1 - settings.sourceMix) * calm * response),
    }
  }
}
