import { CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS, cinema2BlockshiftDirectorGain, type Cinema2BlockshiftDirectorChannels } from './Cinema2BlockshiftPerformance'
import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2BlockshiftInstance } from './Cinema2BlockshiftDomain'
import { constrainCinema2BlockshiftLayout } from './Cinema2BlockshiftLayout'

export const CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS = { subPressure: 0, bassPressure: 0, midTilt: 0, highGlint: 0, spectralGlint: 0, audioEnergy: 0, vocalRestraint: 0, buildTension: 0 } as const
export type Cinema2BlockshiftAudioChannels = { [K in keyof typeof CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS]: number }
export const CINEMA2_BLOCKSHIFT_CUE_RELEASE = { kick: 0.24, snare: 0.32, beat: 0.16, downbeat: 0.45, bar: 0.65, phrase: 0.95, section: 1.1, drop: 0.85 } as const
export type Cinema2BlockshiftCue = keyof typeof CINEMA2_BLOCKSHIFT_CUE_RELEASE
export interface Cinema2BlockshiftAudioCue { kind: Cinema2BlockshiftCue; id: string; strength: number }
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0

/** Visual envelopes only: events and continuous samples are resolved by the shared choreography runtime.
 * No audio analysis, inferred events, musical clock or authored parameter writes live here.
 */
export class Cinema2BlockshiftAudioRuntime {
  private channels: Cinema2BlockshiftAudioChannels = { ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS }
  private envelopes = Object.fromEntries(Object.keys(CINEMA2_BLOCKSHIFT_CUE_RELEASE).map(kind => [kind, 0])) as Record<Cinema2BlockshiftCue, number>
  private seen = new Set<string>()
  private active = false
  private gain = 0
  private profile = 1
  private consumed = 0

  update(input: { channels: Cinema2BlockshiftAudioChannels; cues: readonly Cinema2BlockshiftAudioCue[]; active: boolean; reset: boolean; deltaSeconds: number; motionAmount: number; reactivity: number; sectionType: string | null }): void {
    if (input.reset) this.reset()
    const wasActive = this.active
    this.active = input.active
    const fresh = input.cues.filter(cue => {
      if (this.seen.has(cue.id)) return false
      this.seen.add(cue.id)
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
      return true
    })
    // Pause holds the visible audio pose; activation/resume consumes any stale queued event without firing it.
    if (!input.active || input.motionAmount === 0) return
    const dt = Math.min(0.25, Math.max(0, input.deltaSeconds))
    for (const kind of Object.keys(this.envelopes) as Cinema2BlockshiftCue[]) this.envelopes[kind] *= Math.exp(-dt * 5 / CINEMA2_BLOCKSHIFT_CUE_RELEASE[kind])
    if (wasActive && !input.reset && input.reactivity > 0) for (const cue of fresh) {
      this.envelopes[cue.kind] = Math.max(this.envelopes[cue.kind], clamp(cue.strength)); this.consumed++
    }
    this.channels = Object.fromEntries(Object.entries(input.channels).map(([key, value]) => [key, clamp(value)])) as Cinema2BlockshiftAudioChannels
    this.gain = clamp(input.motionAmount)
    this.profile = ['intro', 'breakdown', 'outro'].includes(input.sectionType ?? '') ? 0.65 : 1
  }

  apply(base: readonly Readonly<Cinema2BlockshiftInstance>[], reactivity: number, rotationRange: number, options: { director?: Readonly<Cinema2BlockshiftDirectorChannels>; overlay?: (pose: readonly Readonly<Cinema2BlockshiftInstance>[], attenuation: number) => readonly Readonly<Cinema2BlockshiftInstance>[] } = {}): { pose: readonly Readonly<Cinema2BlockshiftInstance>[]; emission: readonly number[] } {
    const c = this.channels, e = this.envelopes
    const director = options.director ?? CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS
    const directorGain = cinema2BlockshiftDirectorGain(director)
    const audio = clamp(reactivity), kinetic = audio * this.gain * this.profile * (1 - c.vocalRestraint * 0.45) * directorGain
    if (audio === 0 || this.gain === 0) return { pose: base, emission: base.map(() => 1) }
    const evaluate = (attenuation: number) => {
      const pose = base.map(block => {
        const i = block.index, center = i === 4, bank = block.column === 0 ? -1 : 1, alternating = i % 2 === 0
        const radial = (center ? 0 : c.subPressure * 0.045) + e.drop * 0.055 + e.downbeat * 0.012 + e.beat * 0.006 - c.buildTension * 0.018
        const gain = kinetic * attenuation
        const position = block.position.map(value => value * (1 + radial * gain)) as unknown as number[]
        position[1]! += gain * ((center || alternating ? e.kick * 0.9 : 0) + c.buildTension * bank * 0.35 + e.phrase * bank * 0.45)
        position[2]! += gain * (alternating && !center ? -c.bassPressure * 0.8 : 0)
        const rotation = [...block.rotation]
        const limit = rotationRange * Math.PI / 180
        rotation[0]! += gain * limit * (c.midTilt * (alternating ? 0.1 : -0.1) + e.section * bank * 0.04)
        rotation[1]! += gain * limit * (e.snare * bank * 0.18 + e.bar * bank * 0.05)
        rotation[2]! += gain * limit * (c.highGlint * bank * 0.025)
        return { ...block, position: position as unknown as Cinema2Vector3, rotation: rotation as unknown as Cinema2Vector3 }
      })
      return options.overlay ? options.overlay(pose, attenuation) : pose
    }
    let pose: readonly Readonly<Cinema2BlockshiftInstance>[]
    try { pose = constrainCinema2BlockshiftLayout(evaluate(1)) } catch {
      // Preserve the P4 finite envelope at extreme geometry. Attenuate only the audio overlay, never the authored size/spread.
      let lo = 0, hi = 1; pose = base
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        try { const candidate = constrainCinema2BlockshiftLayout(evaluate(mid)); lo = mid; pose = candidate } catch { hi = mid }
      }
    }
    // Emission uses the authored hue and stays at or below the user's Master Intensity ceiling.
    const emission = base.map(block => Math.max(0.55, Math.min(1, 1 - audio * 0.35 + audio * (c.audioEnergy * 0.12 + c.subPressure * 0.035 + c.highGlint * (block.index % 2 ? 0.1 : 0.02) + c.spectralGlint * 0.06 + (block.index === 4 ? c.vocalRestraint * 0.12 : 0) + e.snare * 0.16 + e.drop * 0.16 + e.section * 0.08))))
    const emissionGain = 1 + audio * 0.12 * (0.5 * clamp(director.directorIntensity) + 0.25 * clamp(director.directorBuild) + 0.25 * clamp(director.directorImpact))
    return { pose, emission: emission.map(value => Math.min(1, value * emissionGain)) }
  }

  inspect() { return { channels: { ...this.channels }, envelopes: { ...this.envelopes }, motionGain: this.gain, consumed: this.consumed } }
  reset(): void { this.channels = { ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS }; for (const kind of Object.keys(this.envelopes) as Cinema2BlockshiftCue[]) this.envelopes[kind] = 0; this.seen.clear(); this.active = false; this.gain = 0; this.consumed = 0 }
}
