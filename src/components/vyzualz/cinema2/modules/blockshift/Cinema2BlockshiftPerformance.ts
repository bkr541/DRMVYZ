import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2BlockshiftInstance } from './Cinema2BlockshiftDomain'

export const CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS = { directorIntensity: 0, directorBuild: 0, directorImpact: 0 } as const
export type Cinema2BlockshiftDirectorChannels = { [K in keyof typeof CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS]: number }
export interface Cinema2BlockshiftPerformanceCue { kind: 'build' | 'drop'; id: string }
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0
export const cinema2BlockshiftDirectorGain = (director: Readonly<Cinema2BlockshiftDirectorChannels>) => Math.min(1.25, 1 + clamp(director.directorIntensity) * 0.1 + clamp(director.directorBuild) * 0.05 + clamp(director.directorImpact) * 0.1)
const ease = (n: number) => { const v = clamp(n); return v * v * (3 - 2 * v) }

/** Only transient presentation state. Musical facts/events and performance beat deltas belong to the engine. */
export class Cinema2BlockshiftPerformance {
  private director: Cinema2BlockshiftDirectorChannels = { ...CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS }
  private overlay: { kind: 'build' | 'drop'; id: string; age: number; duration: number } | null = null
  private seen = new Set<string>()
  private cooldown = 0
  private active = false
  private motionGain = 0
  private accepted = 0

  update(input: { director: Cinema2BlockshiftDirectorChannels; cues: readonly Cinema2BlockshiftPerformanceCue[]; active: boolean; reset: boolean; enabled: boolean; manualEdited: boolean; deltaBeats: number; motionAmount: number; reactivity: number }): void {
    if (input.reset) this.reset()
    const wasActive = this.active
    this.active = input.active
    const fresh = input.cues.filter(cue => {
      if (this.seen.has(cue.id)) return false
      this.seen.add(cue.id)
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
      return true
    })
    // Manual edits and hard disables win even when a fresh automation event arrives on this frame.
    if (input.manualEdited) { this.overlay = null; this.cooldown = 2 }
    if (!input.enabled || input.reactivity === 0) this.overlay = null
    if (!input.active || input.motionAmount === 0) return
    this.director = Object.fromEntries(Object.entries(input.director).map(([key, value]) => [key, clamp(value)])) as Cinema2BlockshiftDirectorChannels
    this.motionGain = clamp(input.motionAmount)
    const beats = Math.max(0, Number.isFinite(input.deltaBeats) ? input.deltaBeats : 0)
    if (!input.manualEdited) this.cooldown = Math.max(0, this.cooldown - beats)
    if (this.overlay) {
      this.overlay.age += beats
      if (this.overlay.age >= this.overlay.duration) this.overlay = null
    }
    if (!wasActive || input.reset || input.manualEdited || !input.enabled || input.reactivity === 0 || this.cooldown > 0) return
    const cue = fresh.find(cue => cue.kind === 'drop') ?? (this.overlay?.kind === 'drop' ? undefined : fresh.find(cue => cue.kind === 'build'))
    if (cue) { this.overlay = { ...cue, age: 0, duration: cue.kind === 'build' ? 4 : 2 }; this.accepted++ }
  }

  hasOverlay(): boolean { return this.overlay != null }
  getDirector(): Readonly<Cinema2BlockshiftDirectorChannels> { return this.director }
  getWeight(): number {
    if (!this.overlay) return 0
    const { kind, age, duration } = this.overlay
    return (kind === 'build' ? 0.25 : 0.35) * ease(age / 0.25) * ease((duration - age) / 0.25)
  }

  /** Collapse-tension / Split-release biases around the current live base, never a replacement Pattern. */
  apply(pose: readonly Readonly<Cinema2BlockshiftInstance>[], reactivity: number, rotationRange: number, attenuation: number): readonly Readonly<Cinema2BlockshiftInstance>[] {
    const weight = this.getWeight() * this.motionGain * clamp(reactivity) * attenuation
    if (weight === 0 || !this.overlay) return pose
    const build = this.overlay.kind === 'build'
    return pose.map(block => {
      const [x, y, z] = block.position, bank = block.column === 0 ? -1 : 1
      const delta = build ? [-x * 0.15, -y * 0.1 + bank * 0.6, -z * 0.05] : [x * 0.3, y * 0.08, z * 0.08]
      const length = Math.hypot(...delta) * weight
      const scale = weight * Math.min(1, Math.min(2, block.size * 0.22) / Math.max(length, 1e-9))
      const position = block.position.map((value, axis) => value + delta[axis]! * scale) as unknown as Cinema2Vector3
      const rotation = [...block.rotation]
      rotation[build ? 2 : 1]! += bank * rotationRange * Math.PI / 180 * 0.08 * weight
      return { ...block, position, rotation: rotation as unknown as Cinema2Vector3 }
    })
  }

  inspect() { return { director: { ...this.director }, directorGain: cinema2BlockshiftDirectorGain(this.director), overlay: this.overlay ? { ...this.overlay, weight: this.getWeight() } : null, cooldown: this.cooldown, accepted: this.accepted } }
  reset(): void { this.director = { ...CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS }; this.overlay = null; this.seen.clear(); this.cooldown = 0; this.active = false; this.motionGain = 0; this.accepted = 0 }
}
