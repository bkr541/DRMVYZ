import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasDivinitySettings } from './DivinitySettings'

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export class DivinityPerformance {
  private previous: SharedPerformanceContext | null = null
  private lastTime: number | null = null
  private wasPaused = false
  private accent = 0
  private fan = 0
  private bass = { initialized: false, value: 0 }
  private build = { initialized: false, value: 0 }
  private detail = { initialized: false, value: 0 }
  private recovery = { initialized: false, value: 0 }

  reset() {
    this.previous = null
    this.lastTime = null
    this.accent = this.fan = 0
    this.bass.initialized = this.build.initialized = this.detail.initialized = this.recovery.initialized = false
  }

  update(settings: CanvasDivinitySettings, context: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean) {
    const fresh = context !== this.previous
    const transport = fresh && context ? resolveSharedPerformanceTransportTransition(this.previous, context) : null
    const elapsed = this.lastTime === null ? 0 : time - this.lastTime
    if (this.lastTime === null || elapsed < -0.00001 || elapsed > 0.5 || (paused && Math.abs(elapsed) > 0.00001)
      || (fresh && context?.boundaries.timingDiscontinuity) || transport?.timingDiscontinuity
      || transport?.seekDetected || transport?.loopWrapDetected || transport?.trackReplacementDetected) this.reset()
    const dt = paused ? 0 : Math.max(0, Math.min(delta, 0.1))
    const response = audioActive && context ? settings.audioReactivity : 0
    const bands = context?.capabilities.liveBands && context.confidence.overall > 0.05
    const sections = context?.capabilities.sections && context.sectionConfidence > 0.15
    const rhythm = context?.capabilities.rhythmEvents && context.confidence.rhythm > 0.15
    const bassInput = bands ? clamp(0.68 * context.bass + 0.32 * context.intelligence.bands.normalized.normalizedSub) : 0
    const bass = smoothSharedPerformanceModulation(this.bass, bassInput, dt, 0.11, 0.31) * response
    const build = smoothSharedPerformanceModulation(this.build, sections ? clamp(context.buildProgress) : 0, dt, 0.22, 0.36) * response
    const detail = smoothSharedPerformanceModulation(this.detail, bands ? clamp(0.56 * context.mid + 0.44 * context.high) : 0, dt, 0.16, 0.27) * response
    const section = settings.autoPerformance && sections ? context.sectionType : null
    const calm = section === 'breakdown' || section === 'outro' ? 0.78 : section === 'intro' ? 0.40 : 0
    const recovery = smoothSharedPerformanceModulation(this.recovery, calm, dt, 0.42, 0.34) * response

    this.accent *= Math.exp(-dt * 4.2)
    this.fan *= Math.exp(-dt * 6.5)
    if (fresh && !paused && !this.wasPaused && context && this.previous && response > 0) {
      if (rhythm && context.kick && !this.previous.kick) this.accent = Math.max(this.accent, 0.58 * clamp(context.kickStrength))
      if (rhythm && ((context.snare && !this.previous.snare)
        || (context.transientConfidence > 0.15 && context.transient > 0.55 && this.previous.transient <= 0.55))) {
        this.fan = Math.max(this.fan, clamp(Math.max(context.snareStrength, context.transient)))
      }
      if ((sections && context.sectionType === 'drop' && context.boundaries.sectionEntry && context.sectionId !== this.previous.sectionId)
        || (context.confidence.semantics > 0.15 && context.dropImpact > 0.55 && this.previous.dropImpact <= 0.55)) {
        this.accent = 1
        this.fan = Math.max(this.fan, 0.4)
      }
    }
    this.previous = context
    this.lastTime = time
    this.wasPaused = paused

    const grid = audioActive && context?.capabilities.beatGrid && context.confidence.grid > 0.15
    const clock = settings.bpmSync && grid ? context.absoluteBeat * 0.5 : time
    const phase = clock * settings.motionSpeed * Math.PI * 2
    const seedPhase = (Math.imul(settings.seed, 0x45d9f3b) >>> 0) / 0x100000000 * Math.PI * 2
    const x = (Math.sin(phase + seedPhase) - Math.sin(seedPhase)) * 0.028 + Math.cos(phase + seedPhase) * bass * 0.023
    const y = (Math.cos(phase * 0.73 + seedPhase) - Math.cos(seedPhase)) * 0.021 + Math.sin(phase + seedPhase) * bass * 0.018
    return {
      originX: clamp(settings.originX + x),
      originY: clamp(settings.originY + y),
      amount: clamp(settings.amount * (1 - settings.sourceMix) * (1 - recovery) * (1 + response * 0.43 * this.accent)),
      length: clamp(settings.length * (1 + 0.22 * bass + 0.27 * build + response * 0.23 * this.accent)),
      spread: clamp(settings.spread + response * 0.14 * this.fan),
      density: clamp(settings.density * (1 + 0.24 * build + 0.17 * detail + response * 0.24 * this.accent)),
      detail,
    }
  }
}
export type DivinityFrame = ReturnType<DivinityPerformance['update']>
