// Sound Drawing XY › INIT: Auto Performance. Builds, drops and energy from the shared conductor loosen or tighten the
// scene: taller, brighter, longer-glowing traces and quicker line moves on drops; calmer, shorter ones in breakdowns.
// Every value approaches its target by bounded exponential smoothing; nothing is clock-driven.

import type { Osc1Features } from './XyScopeOsc1Engine'
import type { Osc1ConductorOutput } from './XyScopeOsc1Performance'
import { INIT_RANGES, type InitValues } from './XyScopeInitSettings'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p
const AUTO_KEYS = ['intensity', 'waveHeight', 'glow', 'trail', 'glide', 'width'] as const

export class InitAutoPerformance {
  private effective: InitValues | null = null

  reset(): void { this.effective = null }

  update(dt: number, f: Osc1Features, conductor: Pick<Osc1ConductorOutput, 'build' | 'drop'>, base: InitValues): InitValues {
    const energy = clamp(f.level * 1.6), build = clamp(conductor.build), impact = clamp(conductor.drop)
    const target: Record<(typeof AUTO_KEYS)[number], number> = {
      intensity: base.intensity * (.85 + energy * .3 + impact * .2),
      waveHeight: base.waveHeight * (.75 + energy * .45 + impact * .3),
      glow: base.glow * (.8 + build * .5 + impact * .6),
      trail: base.trail * (.8 + (1 - energy) * .5 + build * .2),
      glide: base.glide * (1 - impact * .5 + (1 - energy) * .4),
      width: base.width * (.9 + impact * .3),
    }
    if (!this.effective) this.effective = { ...base }
    const out = this.effective as InitValues & Record<(typeof AUTO_KEYS)[number], number>
    const a = 1 - Math.exp(-dt / .35)
    for (const key of AUTO_KEYS) {
      const [lo, hi] = INIT_RANGES[key]
      out[key] = mix(out[key], clamp(target[key], lo, hi), a)
    }
    // Everything the conductor does not touch stays exactly as the user set it.
    return { ...base, intensity: out.intensity, waveHeight: out.waveHeight, glow: out.glow, trail: out.trail, glide: out.glide, width: out.width }
  }
}
