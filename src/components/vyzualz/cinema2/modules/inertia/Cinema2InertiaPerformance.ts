import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import type { InertiaPattern } from './Cinema2InertiaMotion'
import { resolveRawCinema2MainframeBeatClock } from '../mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2AfterhoursTriggerEventIdentity } from '../Cinema2AfterhoursNativeModule'

export interface InertiaPerformanceSelection {
  pattern: InertiaPattern
  kind: 'build' | 'drop' | null
  eventId: string | null
}

/** Temporary, explicitly authorized domain. Authored and trigger-advanced base stay outside this controller. */
export class Cinema2InertiaPerformance {
  private identity = ''
  private previousTime: number | null = null
  private previousAudioTime: number | null = null
  private editRevision = -1
  private wasAllowed = false
  private buildActive = false
  private buildSection: string | null = null
  private seenDrops = new Set<string>()
  private override: { kind: 'build' | 'drop'; eventId: string; until: number } | null = null

  update(frame: Cinema2ModuleFrameReadContext, base: InertiaPattern, enabled: boolean, response: number,
    editRevision: number, buildValue: number): InertiaPerformanceSelection {
    const audio = frame.audio, time = frame.transport?.timeSec ?? 0
    const identity = `${frame.transport?.trackId}:${frame.contextGeneration}:${audio?.upstream.analysisRevision}:${audio?.upstream.timelineRevision}`
    const reset = this.previousTime == null || identity !== this.identity || time < this.previousTime - 1e-6
      || time - this.previousTime > Math.max(0.5, frame.deltaTimeSec * 2)
      || !!(audio?.discontinuity.occurred && audio.discontinuity.reason !== 'activation')
    const playing = !!frame.transport?.playing && !frame.transport.paused && !!frame.transport.sourcePresent && !!audio
    const allowed = enabled && response > 0 && playing
    const section = audio?.structure.section
    const sectionId = section?.available ? section.value?.id ?? null : null
    // Build truth must come from the shared build feature, never an energy threshold.
    const building = !!audio?.features.buildProgress.available && buildValue > 0
      && (audio.structure.buildConfidence.available ? (audio.structure.buildConfidence.value ?? 0) >= 0.45 : false)
    const freshBuild = building && (!this.buildActive || (sectionId != null && sectionId !== this.buildSection))
    const dropId = resolveCinema2AfterhoursTriggerEventIdentity(frame, 'drop', this.previousAudioTime)
    if (reset) { this.override = null; this.seenDrops.clear() }
    const freshDrop = dropId != null && !this.seenDrops.has(dropId)
    if (dropId) {
      this.seenDrops.add(dropId)
      if (this.seenDrops.size > 256) this.seenDrops.delete(this.seenDrops.values().next().value!)
    }
    const edited = this.editRevision !== editRevision
    if (!allowed || reset || edited || !this.wasAllowed) this.override = null
    const bpm = resolveRawCinema2MainframeBeatClock(frame, true)
    const timed = bpm.source !== 'visual-fallback-120'
    if (this.override && (time >= this.override.until || (this.override.kind === 'build' && !building))) this.override = null
    // Events present at enable/resume/manual edit are fenced, even if already-active build/drop continues.
    if (allowed && this.wasAllowed && !reset && !edited) {
      if (freshDrop) this.override = { kind: 'drop', eventId: dropId!, until: time + (timed ? Math.min(2, 240 / bpm.bpm) : 2) }
      else if (freshBuild && this.override?.kind !== 'drop') this.override = {
        kind: 'build', eventId: `build:${sectionId ?? 'shared'}:${audio!.upstream.timeSec}`,
        until: time + (timed ? Math.min(5, 480 / bpm.bpm) : 5),
      }
    }
    this.previousTime = time; this.previousAudioTime = audio?.upstream.timeSec ?? this.previousAudioTime
    this.identity = identity; this.editRevision = editRevision; this.wasAllowed = allowed
    this.buildActive = building; this.buildSection = sectionId
    return {
      pattern: this.override ? (this.override.kind === 'drop' ? 'collapse-release' : 'countertwist') : base,
      kind: this.override?.kind ?? null, eventId: this.override?.eventId ?? null,
    }
  }
}
