import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { IFRIT_PATTERNS, type IfritPattern } from './Cinema2IfritDomain'

export interface IfritPerformanceInput {
  authored: IfritPattern; editRevision: number; enabled: boolean; trigger: Cinema2AfterhoursTriggerId
  event: string | null; auto: boolean; buildEvent: string | null; dropEvent: string | null
  timeSec: number; beats: number; playing: boolean; reset: boolean
  buildProgress?: number; variation?: number
}

/** Creative performance state only. Musical event identities and timing are supplied by the host. */
export class IfritPerformance {
  private readonly base = new Cinema2MainframePatternController<IfritPattern>(IFRIT_PATTERNS, 'infernalPassage')
  private revision: number | null = null
  private auto: boolean | null = null
  private enabled: boolean | null = null
  private buildEvent: string | null = null
  private dropEvent: string | null = null
  private override: { pattern: IfritPattern; kind: 'build' | 'drop'; expires: number } | null = null
  private visible: IfritPattern = 'infernalPassage'
  private previous: IfritPattern = 'infernalPassage'
  private transitionStart = 0

  update(input: IfritPerformanceInput) {
    const manual = this.revision != null && input.editRevision !== this.revision
    const rebase = input.reset || manual || this.revision == null
    if (input.reset) { this.buildEvent = input.buildEvent; this.dropEvent = input.dropEvent }
    const base = this.base.update({ authoredPattern: input.authored, patternChange: input.enabled, trigger: input.trigger,
      triggerEventId: input.event, absoluteBeat: input.beats, reset: rebase }).activePattern
    const changedAuto = this.auto !== input.auto
    const toggled = this.enabled !== input.enabled
    if (rebase || changedAuto || !input.auto) this.override = null
    if (this.override && (input.timeSec >= this.override.expires || (this.override.kind === 'build' && input.buildEvent == null))) this.override = null
    // Edits and permission changes watermark current events; they cannot steal a fresh manual selection.
    if (!rebase && !changedAuto && input.auto && input.playing) {
      if (input.dropEvent && input.dropEvent !== this.dropEvent) {
        this.override = { pattern: 'riftLock', kind: 'drop', expires: input.timeSec + 1.2 }
      } else if (input.buildEvent && input.buildEvent !== this.buildEvent) {
        this.override = { pattern: 'compressionChamber', kind: 'build', expires: input.timeSec + 4 }
      }
    }
    if (input.buildEvent) this.buildEvent = input.buildEvent
    if (input.dropEvent) this.dropEvent = input.dropEvent
    // A single authorized build has authored chapters. Manual edits have already
    // removed the override above, so a continuing build cannot reclaim control.
    if (this.override?.kind === 'build') {
      this.override.pattern = (input.buildProgress ?? 0) > 0.78 ? 'riftLock'
        : (input.variation ?? 0) > 0.7 && (input.buildProgress ?? 0) < 0.35 ? 'twistedDescent' : 'compressionChamber'
    }
    this.auto = input.auto
    this.enabled = input.enabled
    this.revision = input.editRevision
    const performing = this.override?.pattern ?? base
    if (performing !== this.visible) {
      this.previous = this.visible
      this.visible = performing
      this.transitionStart = rebase || changedAuto || toggled ? input.timeSec - 0.18 : input.timeSec
    }
    if (input.reset) { this.previous = performing; this.transitionStart = input.timeSec - 0.18 }
    return { base, performing, previous: this.previous, transition: Math.min(1, Math.max(0, (input.timeSec-this.transitionStart)/0.18)), overridden: this.override != null }
  }

  reset() {
    this.base.reset(); this.revision = null; this.auto = null; this.enabled = null; this.buildEvent = null; this.dropEvent = null
    this.override = null; this.visible = this.previous = 'infernalPassage'; this.transitionStart = 0
  }
}
