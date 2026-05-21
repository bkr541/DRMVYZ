// Modular effect registry for VYZUALZ.
// Add new modules here; the RAF loop calls getEffectsForPhase() each frame.

import type { VzEffectModule, VzRenderPhase } from './types'

import { noiseFogModule }        from './noiseFog'
import { beatFlashModule }       from './beatFlash'
import { edgeFlickerModule }     from './edgeFlicker'
import { scanlinesModule }       from './scanlines'
import { vhsStaticModule }       from './vhsStatic'
import { edgeGlowModule }        from './edgeGlow'
import { colorCycleModule }      from './colorCycle'
import { kaleidoscopeModule }    from './kaleidoscope'
import { mirrorSplitModule }     from './mirrorSplit'
import { radialBlurModule }      from './radialBlur'
import { reactiveGridModule }    from './reactiveGrid'
import { spectrumBarsModule }    from './spectrumBars'
import { circularSpectrumModule } from './circularSpectrum'
import { oscilloscopeModule }    from './oscilloscope'
import { beatRingModule }        from './beatRing'
import { particleBurstModule }   from './particleBurst'
import { strobeModule }          from './strobe'

// ── Registration order defines draw order within each phase ──────────────────
// preMedia:  behind the primary media draw
// postMedia: inside the camera-shake transform (drawn before the shake restore)
// master:    screen-space, after the camera-shake restore

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_MODULES: VzEffectModule<any>[] = [
  // preMedia — drawn behind the primary media draw
  reactiveGridModule,
  // postMedia — drawn after media, inside camera-shake transform
  spectrumBarsModule,
  circularSpectrumModule,
  oscilloscopeModule,
  beatRingModule,
  particleBurstModule,
  kaleidoscopeModule,
  mirrorSplitModule,
  radialBlurModule,
  edgeGlowModule,
  colorCycleModule,
  // master — screen-space, after camera-shake restore; order: scan → fog → flash → flicker → static → strobe
  scanlinesModule,
  noiseFogModule,
  beatFlashModule,
  edgeFlickerModule,
  vhsStaticModule,
  strobeModule,
]

export const EFFECT_MODULES: ReadonlyMap<string, VzEffectModule> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new Map<string, VzEffectModule<any>>(ALL_MODULES.map(m => [m.id, m]))

export function getEffectModule(id: string): VzEffectModule | undefined {
  return EFFECT_MODULES.get(id)
}

export function getEffectsForPhase(phase: VzRenderPhase): VzEffectModule[] {
  return ALL_MODULES.filter(m => m.renderPhase === phase)
}

export function getEffectLabel(id: string): string {
  return EFFECT_MODULES.get(id)?.label ?? id
}
