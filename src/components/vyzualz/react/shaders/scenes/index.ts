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

// Phase 3 capability scene: exercises the geometry draw pass, HDR/float
// render targets, chromatic bloom, and feedback persistence end-to-end. Not
// yet wired into ShaderEngineRenderer's live per-frame geometry data source
// (see soundDrawingVectorscopeRuntime.ts's docblock), so — like
// feedbackKaleidoscope.ts below — it is exported for direct use/testing but
// intentionally absent from PRODUCTION_SCENES.
export { SOUND_DRAWING_VECTORSCOPE, SOUND_DRAWING_VECTORSCOPE_SCENE_ID } from './soundDrawingVectorscope'

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
import { getShaderPerformanceProgram } from '../performance/ShaderPerformancePrograms'

const PRODUCTION_BASE_SCENES: readonly ShaderDefinition[] = [
  PRISM_TUNNEL,
  LIQUID_METABALLS,
  BRAND_ECHO_SIGNAL,
  REACTOR,
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  WOBBLE_GLYPH_FORGE,
  MELODIC_RIFT_BLOOM,
]

/** Active production definitions are decorated with their native authored show. */
export const PRODUCTION_SCENES: ShaderDefinition[] = PRODUCTION_BASE_SCENES.map(scene => ({
  ...scene,
  performanceProgram: getShaderPerformanceProgram(scene.id),
}))

/**
 * Registry audit for intentionally excluded exports. These files remain useful
 * as migration fixtures or internal design sources, but are not safe standalone
 * production presets. Keeping the reason beside the active registry prevents a
 * future count-driven registration pass from exposing duplicate or retired work.
 */
export const SHADER_SCENE_REGISTRY_AUDIT = Object.freeze({
  'shader-semantic-drop-reactor': 'folded into Reactor recipe architecture',
  'shader-trap-shrapnel-reactor': 'folded into Reactor recipe architecture',
  'shader-brand-singularity': 'folded into Reactor recipe architecture',
  'shader-feedback-kaleidoscope': 'retired; feedback behavior is retained only for migration/reference',
  'shader-riddim-railgun-sequencer': 'retired; incomplete production interaction model',
})

export const DEFAULT_SHADER_SCENE_ID = PRISM_TUNNEL.id
