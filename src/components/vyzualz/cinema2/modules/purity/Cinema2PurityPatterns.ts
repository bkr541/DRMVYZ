import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

export const PURITY_PATTERNS = ['ignition','monolith','strata','pillar','matrix','wireframe','fracture','cascade','relay','spine','crosswire','eclipse','guidance','pursuit','interlock','domino','convergence','afterimage'] as const
export type PurityPattern = typeof PURITY_PATTERNS[number]
export const PURITY_LABELS = PURITY_PATTERNS.map(value => value.toUpperCase())

export interface PuritySelectionInput {
  authored: PurityPattern; editRevision: number; enabled: boolean; trigger: Cinema2AfterhoursTriggerId
  event: string | null; auto: boolean; buildEvent: string | null; dropEvent: string | null
  timeSec: number; beats: number; playing: boolean; reset: boolean
}
export class PuritySelection {
  private readonly base = new Cinema2MainframePatternController<PurityPattern>(PURITY_PATTERNS, 'ignition')
  private revision: number | null = null
  private auto: boolean | null = null
  private build: string | null = null
  private drop: string | null = null
  private override: { pattern: PurityPattern; kind: 'build' | 'drop'; until: number } | null = null
  private current: PurityPattern = 'ignition'
  private previous: PurityPattern = 'ignition'
  private start = 0
  update(input: PuritySelectionInput) {
    const rebase = input.reset || this.revision !== input.editRevision
    const authorityChanged = this.auto !== input.auto
    const base = this.base.update({ authoredPattern: input.authored, patternChange: input.enabled, trigger: input.trigger,
      triggerEventId: input.playing ? input.event : null, absoluteBeat: input.beats, reset: input.reset, reselect: rebase && !input.reset }).activePattern
    if (rebase || authorityChanged || !input.auto) this.override = null
    if (this.override && (input.timeSec >= this.override.until || (this.override.kind === 'build' && !input.buildEvent))) this.override = null
    if (!rebase && !authorityChanged && input.auto && input.playing) {
      if (input.dropEvent && input.dropEvent !== this.drop) this.override = { pattern: 'monolith', kind: 'drop', until: input.timeSec + 1.2 }
      else if (input.buildEvent && input.buildEvent !== this.build && this.override?.kind !== 'drop') this.override = { pattern: 'cascade', kind: 'build', until: input.timeSec + 4 }
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
  reset() { this.base.reset(); this.revision = this.auto = this.build = this.drop = null; this.override = null; this.current = this.previous = 'ignition'; this.start = 0 }
}
