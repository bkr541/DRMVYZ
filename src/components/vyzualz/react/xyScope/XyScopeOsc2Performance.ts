// Sound Drawing XY › OSC 2: Auto Performance. The OSC 1 conductor already turns live audio and section evidence
// into build / drop / breakdown state and beam settings; this layer maps that same evidence onto the 3D scene:
// builds pull the camera up and back, drops push it in and open the solid, and the sweep quickens with spectral
// change. Every value approaches its target by bounded exponential smoothing; nothing is clock-driven.

import type { Osc1ConductorOutput } from './XyScopeOsc1Performance'
import type { Osc1Features } from './XyScopeOsc1Engine'
import { OSC2_RANGES, type Osc2ControlKey, type Osc2Settings } from './XyScopeOsc2Engine'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p

export class Osc2AutoPerformance {
  private effective: Osc2Settings | null = null

  reset(): void { this.effective = null }

  update(dt: number, f: Osc1Features, conductor: Osc1ConductorOutput, base: Osc2Settings): Osc2Settings {
    const energy = clamp(f.level * 1.6), build = clamp(conductor.build), impact = clamp(conductor.drop)
    const target: Osc2Settings = {
      ...base,
      depth: base.depth * (.8 + energy * .5 + impact * .6),
      distance: base.distance * (1 + build * .14 - impact * .12),
      elevation: base.elevation + build * 22 - impact * 10,
      orbitRange: base.orbitRange * (.75 + energy * .4 + impact * .5 - build * .2),
      orbitSpeed: base.orbitSpeed * (.7 + clamp(f.flux) * .7) + build * .2,
      audioDepth: base.audioDepth * (.8 + impact * .7 + clamp(f.crest) * .2),
      kickDolly: base.kickDolly,
      terrain: base.terrain * (.65 + energy * .6),
      // Beam character follows the OSC 1 conductor's evidence-driven choices.
      intensity: conductor.settings.intensity,
      persistence: conductor.settings.persistence,
      width: conductor.settings.width,
      scan: base.scan * (.8 + clamp(f.air) * .5 + impact * .3),
      color: conductor.settings.color,
    }
    if (!this.effective) this.effective = { ...base }
    const out = this.effective as Osc2Settings & Record<Osc2ControlKey, number>
    const a = 1 - Math.exp(-dt / .35)
    for (const key of Object.keys(OSC2_RANGES) as Osc2ControlKey[]) {
      const [lo, hi] = OSC2_RANGES[key]
      out[key] = mix(out[key], clamp(target[key], lo, hi), a)
    }
    out.layers = base.layers
    out.color = target.color
    return { ...out }
  }
}
