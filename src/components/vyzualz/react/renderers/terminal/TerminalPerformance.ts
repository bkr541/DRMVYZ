import { resolveSharedPerformanceTransportTransition, smoothSharedPerformanceModulation, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { TERMINAL_FAMILIES, type CanvasTerminalSettings } from './TerminalSettings'

const clamp = (n: number) => Math.max(0, Math.min(1, n))

export class TerminalPerformance {
  private previous: SharedPerformanceContext | null = null
  private time: number | null = null
  private wasPaused = false
  private detail = { initialized: false, value: 0 }
  private energy = { initialized: false, value: 0 }
  private calm = { initialized: false, value: 0 }
  private punch = 0
  private substitute = 0

  reset() {
    this.previous = null
    this.time = null
    this.detail.initialized = this.energy.initialized = this.calm.initialized = false
    this.punch = this.substitute = 0
  }

  update(settings: CanvasTerminalSettings, context: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean) {
    const fresh = context !== this.previous
    const transport = fresh && context ? resolveSharedPerformanceTransportTransition(this.previous, context) : null
    const elapsed = this.time === null ? 0 : time - this.time
    if (this.time === null || elapsed < -0.00001 || elapsed > 0.5 || (paused && Math.abs(elapsed) > 0.00001)
      || (this.wasPaused && !paused) || transport?.timingDiscontinuity || transport?.seekDetected
      || transport?.loopWrapDetected || transport?.trackReplacementDetected
      || (fresh && context?.boundaries.timingDiscontinuity)) this.reset()
    const dt = paused ? 0 : Math.max(0, Math.min(delta, 0.1))
    const response = audioActive && context ? settings.audioReactivity : 0
    const bands = context?.capabilities.liveBands && context.confidence.overall > 0.05
    const sections = context?.capabilities.sections && context.sectionConfidence > 0.15
    const rhythm = context?.capabilities.rhythmEvents && context.confidence.rhythm > 0.15
    const bass = bands ? 0.7 * context.bass + 0.3 * context.intelligence.bands.normalized.normalizedSub : 0
    const build = sections ? clamp(context.buildProgress) : 0
    const energy = smoothSharedPerformanceModulation(this.energy, response * clamp(0.7 * bass + 0.3 * build), dt, 0.08, 0.26)
    const detail = smoothSharedPerformanceModulation(this.detail, bands ? response * clamp(0.6 * context.mid + 0.4 * context.high) : 0, dt, 0.14, 0.3)
    const section = audioActive && sections && settings.autoPerformance ? context.sectionType : null
    const calm = smoothSharedPerformanceModulation(this.calm,
      section === 'breakdown' || section === 'outro' ? response * 0.7 : section === 'intro' ? response * 0.25 : 0, dt, 0.32, 0.4)

    this.punch *= Math.exp(-dt * 8)
    this.substitute *= Math.exp(-dt * 5)
    if (!paused && fresh && this.previous && context && response > 0) {
      if (rhythm && context.kick && !this.previous.kick) this.punch = Math.max(this.punch, clamp(context.kickStrength))
      if (rhythm && ((context.snare && !this.previous.snare)
        || (context.transientConfidence > 0.15 && context.transient > 0.55 && this.previous.transient <= 0.55))) {
        this.substitute = Math.max(this.substitute, clamp(Math.max(context.snareStrength, context.transient)))
      }
      if ((sections && context.sectionType === 'drop' && context.boundaries.sectionEntry && context.sectionId !== this.previous.sectionId)
        || (context.confidence.semantics > 0.15 && context.dropImpact > 0.55 && this.previous.dropImpact <= 0.55)) {
        this.punch = this.substitute = 1
      }
    }
    this.previous = context
    this.time = time
    this.wasPaused = paused
    const grid = audioActive && context?.capabilities.beatGrid && context.confidence.grid > 0.15
    const clock = settings.bpmSync && grid ? context.absoluteBeat / 2 : time
    const authored = TERMINAL_FAMILIES.indexOf(settings.family)
    const phrase = grid && context.confidence.phrase > 0.15 ? Math.max(0, Math.floor(context.phraseIndex)) : 0
    return {
      family: settings.autoPerformance && response > 0 && phrase > 0 && section !== 'breakdown'
        ? (authored + phrase + settings.seed % 3) % 3 : authored,
      amount: settings.amount * (1 - settings.sourceMix) * (1 - (response > 0 ? calm : 0)),
      brightness: Math.min(1, settings.brightness + (response > 0 ? 0.1 * energy + 0.16 * response * this.punch : 0)),
      edge: clamp(settings.edge + (response > 0 ? 0.2 * detail : 0)),
      epoch: Math.floor(clock * settings.changeRate) % 0x7fffffff,
      variation: clamp((settings.changeRate > 0 ? 0.5 : 0) + response * (0.2 * build + 0.5 * this.substitute)),
    }
  }
}
export type TerminalFrame = ReturnType<TerminalPerformance['update']>
