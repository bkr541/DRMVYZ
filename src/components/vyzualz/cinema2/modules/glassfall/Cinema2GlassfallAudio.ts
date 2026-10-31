import type { Cinema2AudioSignal } from '../../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { GLASSFALL_PATTERNS, type GlassfallPattern } from './Cinema2GlassfallMotion'
export interface GlassfallAudioFacts { energy: number; bass: number; high: number; vocal: number; build: number; kick: number; snare: number; drop: number }
export const GLASSFALL_SILENCE: GlassfallAudioFacts = { energy: 0, bass: 0, high: 0, vocal: 0, build: 0, kick: 0, snare: 0, drop: 0 }
const unit = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const signal = (value: Readonly<Cinema2AudioSignal<number>>) => value.available && typeof value.value === 'number' ? unit(value.value) : 0
/** Shared facts only: no local detector, event envelope, BPM estimation or Director interpretation. */
export function sampleGlassfallAudio(frame: Readonly<Cinema2ModuleFrameReadContext>): GlassfallAudioFacts {
  const audio = frame.audio
  if (!audio || frame.transport?.sourcePresent === false || (frame.transport?.trackId && audio.upstream.trackId !== frame.transport.trackId)) return { ...GLASSFALL_SILENCE }
  const time = frame.transport?.timeSec ?? audio.upstream.timeSec
  const fresh = (at: number, window: number) => time >= at - .00001 && time - at <= window
  const moments = audio.structure.semanticMoments
  return {
    energy: signal(audio.features.overallEnergy), bass: signal(audio.bands.bass), high: signal(audio.bands.high),
    vocal: signal(audio.features.vocalPresence), build: signal(audio.features.buildProgress),
    kick: audio.rhythm.kick && fresh(audio.rhythm.kick.timeSec, .08) ? unit(audio.rhythm.kick.strength) : 0,
    snare: audio.rhythm.snare && fresh(audio.rhythm.snare.timeSec, .08) ? unit(audio.rhythm.snare.strength) : 0,
    drop: moments.available && moments.value?.some(moment => (moment.type === 'drop' || moment.type === 'drop_impact') && fresh(moment.timeSec, .25)) ? 1 : 0,
  }
}
/** Reuses canonical event resolution and the shared selection controller. This
 * wrapper only watermarks events and notices same-value manual edits. */
export class GlassfallPatternSelection {
  private readonly controller = new Cinema2MainframePatternController<GlassfallPattern>(GLASSFALL_PATTERNS, 'glassfall')
  private readonly seen = new Set<string>()
  private revision: number | null = null
  reset() { this.controller.reset(); this.seen.clear(); this.revision = null }
  update(frame: Readonly<Cinema2ModuleFrameReadContext>, authored: GlassfallPattern, editRevision: number, enabled: boolean, trigger: Cinema2AfterhoursTriggerId, previousTime: number | null, reset: boolean): GlassfallPattern {
    if (reset) this.reset()
    const manual = this.revision !== null && this.revision !== editRevision
    // Paused events are watermarks, never a reason to advance on resume.
    const observable = frame.transport ? { ...frame, transport: { ...frame.transport, paused: false, playing: true } } : frame
    const event = resolveCinema2AfterhoursTriggerEventIdentity(observable, trigger, reset ? null : previousTime)
    const fresh = event !== null && !this.seen.has(event)
    if (event) { this.seen.add(event); if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!) }
    const playing = frame.transport?.playing === true && frame.transport.paused !== true
    const selected = this.controller.update({ authoredPattern: authored, patternChange: enabled, trigger,
      triggerEventId: fresh && playing ? event : null, absoluteBeat: frame.audio?.rhythm.beatIndex.value ?? 0,
      reset: reset || manual })
    this.revision = editRevision
    return selected.activePattern
  }
}

export const GLASSFALL_CHOREOGRAPHY_CHANNELS = Object.keys(GLASSFALL_SILENCE) as Array<keyof GlassfallAudioFacts>
/** Consume only final, resolved shared targets. No second native envelope. */
export function readGlassfallChoreography(parameters: Cinema2ModuleParameterReadFacet): GlassfallAudioFacts {
  return Object.fromEntries(GLASSFALL_CHOREOGRAPHY_CHANNELS.map(name => {
    const value = parameters.get(`choreo-${name}`)
    return [name, typeof value === 'number' ? unit(value) : 0]
  })) as unknown as GlassfallAudioFacts
}
