export { PRISM_TUNNEL } from './prismTunnel'
export { LIQUID_METABALLS } from './liquidMetaballs'
export { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'
export { BRAND_ECHO_SIGNAL } from './brandEchoSignal'
export { SEMANTIC_DROP_REACTOR } from './semanticDropReactor'
export { BASS_CATHEDRAL } from './bassCathedral'
export { LASER_LATTICE_OVERDRIVE } from './laserLatticeOverdrive'
export { TRAP_SHRAPNEL_REACTOR } from './trapShrapnelReactor'
export { WOBBLE_GLYPH_FORGE } from './wobbleGlyphForge'
export { MELODIC_RIFT_BLOOM } from './melodicRiftBloom'
export { RIDDIM_RAILGUN_SEQUENCER } from './riddimRailgunSequencer'
export { BRAND_SINGULARITY } from './brandSingularity'

// Legacy source definitions remain importable for migration fixtures and visual
// regression reference, but are intentionally absent from PRODUCTION_SCENES.
// Reactor is the only runtime registry entry for these three visual systems.
export { REACTOR, REACTOR_SCENE_ID } from './reactor'
export * from './reactorMigration'

import { PRISM_TUNNEL } from './prismTunnel'
import { LIQUID_METABALLS } from './liquidMetaballs'
import { BRAND_ECHO_SIGNAL } from './brandEchoSignal'
import { BASS_CATHEDRAL } from './bassCathedral'
import { LASER_LATTICE_OVERDRIVE } from './laserLatticeOverdrive'
import { WOBBLE_GLYPH_FORGE } from './wobbleGlyphForge'
import { MELODIC_RIFT_BLOOM } from './melodicRiftBloom'
import { REACTOR } from './reactor'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const PRODUCTION_SCENES: ShaderDefinition[] = [
  PRISM_TUNNEL,
  LIQUID_METABALLS,
  BRAND_ECHO_SIGNAL,
  REACTOR,
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  WOBBLE_GLYPH_FORGE,
  MELODIC_RIFT_BLOOM,
]

export const DEFAULT_SHADER_SCENE_ID = PRISM_TUNNEL.id
