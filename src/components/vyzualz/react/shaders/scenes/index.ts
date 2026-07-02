export { NEON_TUNNEL } from './neonTunnel'
export { LIQUID_METABALLS } from './liquidMetaballs'
export { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'
export { SPECTRUM_CATHEDRAL } from './spectrumCathedral'
export { BRAND_ECHO_SIGNAL } from './brandEchoSignal'
export { SEMANTIC_DROP_REACTOR } from './semanticDropReactor'

import { NEON_TUNNEL } from './neonTunnel'
import { LIQUID_METABALLS } from './liquidMetaballs'
import { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'
import { SPECTRUM_CATHEDRAL } from './spectrumCathedral'
import { BRAND_ECHO_SIGNAL } from './brandEchoSignal'
import { SEMANTIC_DROP_REACTOR } from './semanticDropReactor'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const PRODUCTION_SCENES: ShaderDefinition[] = [
  NEON_TUNNEL,
  LIQUID_METABALLS,
  FEEDBACK_KALEIDOSCOPE,
  SPECTRUM_CATHEDRAL,
  BRAND_ECHO_SIGNAL,
  SEMANTIC_DROP_REACTOR,
]

export const DEFAULT_SHADER_SCENE_ID = NEON_TUNNEL.id
