export { PRISM_TUNNEL } from './prismTunnel'
export { LIQUID_METABALLS } from './liquidMetaballs'
export { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'
export { SPECTRUM_CATHEDRAL } from './spectrumCathedral'
export { BRAND_ECHO_SIGNAL } from './brandEchoSignal'
export { SEMANTIC_DROP_REACTOR } from './semanticDropReactor'
export { BASS_CATHEDRAL } from './bassCathedral'
export { LASER_LATTICE_OVERDRIVE } from './laserLatticeOverdrive'
export { TRAP_SHRAPNEL_REACTOR } from './trapShrapnelReactor'
export { WOBBLE_GLYPH_FORGE } from './wobbleGlyphForge'
export { DREAMSTATE_MYCELIUM } from './dreamstateMycelium'
export { MELODIC_RIFT_BLOOM } from './melodicRiftBloom'
export { RIDDIM_RAILGUN_SEQUENCER } from './riddimRailgunSequencer'
export { BRAND_SINGULARITY } from './brandSingularity'
export { REACTOR, REACTOR_SCENE_ID } from './reactor'
export * from './reactorMigration'

import { PRISM_TUNNEL } from './prismTunnel'
import { LIQUID_METABALLS } from './liquidMetaballs'
import { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'
import { SPECTRUM_CATHEDRAL } from './spectrumCathedral'
import { BRAND_ECHO_SIGNAL } from './brandEchoSignal'
import { SEMANTIC_DROP_REACTOR } from './semanticDropReactor'
import { BASS_CATHEDRAL } from './bassCathedral'
import { LASER_LATTICE_OVERDRIVE } from './laserLatticeOverdrive'
import { TRAP_SHRAPNEL_REACTOR } from './trapShrapnelReactor'
import { WOBBLE_GLYPH_FORGE } from './wobbleGlyphForge'
import { DREAMSTATE_MYCELIUM } from './dreamstateMycelium'
import { MELODIC_RIFT_BLOOM } from './melodicRiftBloom'
import { RIDDIM_RAILGUN_SEQUENCER } from './riddimRailgunSequencer'
import { BRAND_SINGULARITY } from './brandSingularity'
import { REACTOR } from './reactor'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const PRODUCTION_SCENES: ShaderDefinition[] = [
  PRISM_TUNNEL,
  LIQUID_METABALLS,
  FEEDBACK_KALEIDOSCOPE,
  SPECTRUM_CATHEDRAL,
  BRAND_ECHO_SIGNAL,
  REACTOR,
  SEMANTIC_DROP_REACTOR,
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  TRAP_SHRAPNEL_REACTOR,
  WOBBLE_GLYPH_FORGE,
  DREAMSTATE_MYCELIUM,
  MELODIC_RIFT_BLOOM,
  RIDDIM_RAILGUN_SEQUENCER,
  BRAND_SINGULARITY,
]

export const DEFAULT_SHADER_SCENE_ID = PRISM_TUNNEL.id
