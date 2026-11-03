import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { FLUIDITY_SURFACES, type CanvasFluiditySettings } from './FluiditySettings'

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export class FluidityPerformance {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private wasPaused = false
  private offset = 0
  private pressure = 0
  private pressureAge = 0
  private rim = 0
  private swell = { initialized: false, value: 0 }
  private detail = { initialized: false, value: 0 }
  private recovery = { initialized: false, value: 0 }

  reset() {
    this.previous = null
    this.lastTime = null
    this.offset = this.pressure = this.pressureAge = this.rim = 0
    this.swell.initialized = this.detail.initialized = this.recovery.initialized = false
  }

  update(settings: CanvasFluiditySettings, context: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean) {
    const fresh = context !== this.previous
    const transport = fresh && context ? resolveSharedPerformanceTransportTransition(this.previous, context) : null
    const elapsed = this.lastTime === null ? 0 : time - this.lastTime
    if (this.lastTime === null || elapsed < -0.00001 || elapsed > 0.5 || (paused && Math.abs(elapsed) > 0.00001)
      || (fresh && context?.boundaries.timingDiscontinuity) || transport?.timingDiscontinuity
      || transport?.seekDetected || transport?.loopWrapDetected || transport?.trackReplacementDetected) this.reset()
    // Retain the paused frame on resume, but do not interpret a held event as a new hit.
    const resume = this.wasPaused && !paused
    const dt = paused ? 0 : Math.max(0, Math.min(delta, 0.1))
    const response = audioActive && context ? settings.audioReactivity : 0
    const live = context?.capabilities.liveBands && context.confidence.overall > 0.05
    const section = context?.capabilities.sections && context.sectionConfidence > 0.15
    const rhythm = context?.capabilities.rhythmEvents && context.confidence.rhythm > 0.15
    const build = section ? clamp(context.buildProgress) : 0
    const bass = live ? clamp(0.68 * context.bass + 0.32 * context.intelligence.bands.normalized.normalizedSub) : 0
    const swell = smoothSharedPerformanceModulation(this.swell, response * clamp(bass * 0.72 + build * 0.65), dt, 0.12, 0.36)
    const detail = smoothSharedPerformanceModulation(this.detail, live ? response * clamp(0.42 * context.mid + 0.58 * context.high) : 0, dt, 0.14, 0.32)
    const type = settings.autoPerformance && section ? context.sectionType : null
    const target = type === 'breakdown' || type === 'outro' ? 0.83 : type === 'intro' ? 0.42 : 0
    const recovery = smoothSharedPerformanceModulation(this.recovery, response * target, dt, 0.45, 0.28)
    this.pressure *= Math.exp(-dt * 3.1)
    this.rim *= Math.exp(-dt * 6)
    this.pressureAge = Math.min(2, this.pressureAge + dt)
    if (fresh && !paused && !resume && context && this.previous && response > 0) {
      const kick = rhythm && context.kick && !this.previous.kick ? clamp(context.kickStrength) : 0
      const drop = (section && context.sectionType === 'drop' && context.boundaries.sectionEntry && context.sectionId !== this.previous.sectionId)
        || (context.confidence.semantics > 0.15 && context.dropImpact > 0.55 && this.previous.dropImpact <= 0.55)
      if (kick > 0 || drop) {
        this.pressure = Math.max(this.pressure, drop ? 1 : kick * 0.65)
        this.pressureAge = 0
      }
      if (rhythm && ((context.snare && !this.previous.snare)
        || (context.transientConfidence > 0.15 && context.transient > 0.55 && this.previous.transient <= 0.55))) {
        this.rim = Math.max(this.rim, clamp(Math.max(context.snareStrength, context.transient)))
      }
    }
    this.previous = context
    this.lastTime = time
    this.wasPaused = paused
    // Bounded phase offset adds liquid acceleration while preserving the base clock.
    this.offset += (0.75 * swell - this.offset) * (1 - Math.exp(-dt * 1.8))
    const grid = audioActive && context?.capabilities.beatGrid && context.confidence.grid > 0.15
    const clock = settings.bpmSync && grid ? context.absoluteBeat * 0.5 : time
    return {
      surface: FLUIDITY_SURFACES.indexOf(settings.surface),
      amount: settings.amount * (1 - settings.sourceMix) * (1 - (response > 0 ? recovery : 0)),
      motion: (clock + (response > 0 ? this.offset : 0)) * settings.flowSpeed,
      refraction: clamp(settings.refraction * (1 + (response > 0 ? 0.42 * swell : 0))),
      highlight: clamp(settings.highlight * (1 + (response > 0 ? 0.18 * detail + 0.45 * response * this.rim : 0))),
      detail: response > 0 ? detail : 0,
      pressure: response * this.pressure,
      pressureAge: this.pressureAge,
    }
  }
}
export type FluidityFrame = ReturnType<FluidityPerformance['update']>
