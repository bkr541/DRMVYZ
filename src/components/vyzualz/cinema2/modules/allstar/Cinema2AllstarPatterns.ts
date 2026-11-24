import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

export const ALLSTAR_PATTERNS = [
  'infinitePassage', 'starEruption', 'fracturedPrism', 'recursiveChamber', 'darkAperture', 'chromaticRelay',
  'counterphase', 'morphCascade', 'depthSurge', 'segmentedPulse', 'geometricConvergence', 'radiantDischarge',
] as const
export type AllstarPattern = typeof ALLSTAR_PATTERNS[number]
export const ALLSTAR_LABELS = ['Infinite Passage', 'Star Eruption', 'Fractured Prism', 'Recursive Chamber', 'Dark Aperture', 'Chromatic Relay', 'Counterphase', 'Morph Cascade', 'Depth Surge', 'Segmented Pulse', 'Geometric Convergence', 'Radiant Discharge'] as const

// Layout, not just brightness: [inner radius, gap fraction, layers, scale, travel, spin, rail gain, fixture gain, chase, collapse, morph wave].
export const ALLSTAR_PROFILES = [
  [0.59,0,0.85,0.86,1,0.12,1,0.72,0.2,0,0.12],
  [0.43,0,1,1.16,1.3,0.1,0.82,0.58,0.25,0.15,0.22],
  [0.48,0.34,0.85,1.02,0.85,0.38,0.65,0.9,0.5,0.12,0.5],
  [0.91,0,1,0.92,0.62,0.05,1,0.65,0.15,0,0.16],
  [0.61,0.08,0.45,0.83,0.42,0.08,0.08,0.22,0.65,0.1,0.12],
  [0.78,0.1,0.65,0.88,0.9,0.22,0.76,1,1,0.06,0.2],
  [0.51,0,1,0.96,0.7,1,0.72,0.65,0.3,0.28,0.3],
  [0.68,0.02,1,1,0.95,0.16,0.84,0.7,0.4,0.15,1],
  [0.49,0,0.95,1.22,1.75,0.12,1,0.9,0.7,0.25,0.38],
  [0.84,0.22,0.6,0.82,0.8,0.15,0.25,1,0.9,0,0.15],
  [0.58,0,1,1.03,0.64,0.35,0.6,0.75,0.4,1,0.55],
  [0.39,0.03,1,1.26,1.5,0.45,1,1,0.75,0.42,0.62],
] as const
export interface AllstarSelectionInput {
  authored: AllstarPattern; editRevision: number; enabled: boolean; trigger: Cinema2AfterhoursTriggerId
  event: string | null; auto: boolean; buildEvent: string | null; dropEvent: string | null
  timeSec: number; beats: number; playing: boolean; reset: boolean
}
export class AllstarSelection {
  private readonly base = new Cinema2MainframePatternController<AllstarPattern>(ALLSTAR_PATTERNS, 'infinitePassage')
  private revision: number | null = null
  private auto: boolean | null = null
  private build: string | null = null
  private drop: string | null = null
  private override: { pattern: AllstarPattern; kind: 'build' | 'drop'; until: number } | null = null
  private current: AllstarPattern = 'infinitePassage'
  private previous: AllstarPattern = 'infinitePassage'
  private start = 0
  update(input: AllstarSelectionInput) {
    const rebase = input.reset || this.revision !== input.editRevision
    const authorityChanged = this.auto !== input.auto
    const base = this.base.update({ authoredPattern: input.authored, patternChange: input.enabled, trigger: input.trigger,
      triggerEventId: input.playing ? input.event : null, absoluteBeat: input.beats, reset: rebase }).activePattern
    if (rebase || authorityChanged || !input.auto) this.override = null
    if (this.override && (input.timeSec >= this.override.until || (this.override.kind === 'build' && !input.buildEvent))) this.override = null
    if (!rebase && !authorityChanged && input.auto && input.playing) {
      if (input.dropEvent && input.dropEvent !== this.drop) this.override = { pattern: 'radiantDischarge', kind: 'drop', until: input.timeSec + 1.2 }
      else if (input.buildEvent && input.buildEvent !== this.build && this.override?.kind !== 'drop') this.override = { pattern: 'morphCascade', kind: 'build', until: input.timeSec + 4 }
    }
    if (input.buildEvent) this.build = input.buildEvent
    if (input.dropEvent) this.drop = input.dropEvent
    this.revision = input.editRevision; this.auto = input.auto
    const performing = this.override?.pattern ?? base
    if (performing !== this.current || rebase || authorityChanged) {
      this.previous = rebase || authorityChanged ? performing : this.current
      this.current = performing; this.start = input.timeSec
    }
    return { base, performing, previous: this.previous, transition: Math.min(1, Math.max(0, (input.timeSec-this.start)/0.32)), overridden: this.override !== null }
  }
  reset() { this.base.reset(); this.revision = this.auto = this.build = this.drop = null; this.override = null; this.current = this.previous = 'infinitePassage'; this.start = 0 }
}
