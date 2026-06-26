export { NEON_TUNNEL } from './neonTunnel'
export { LIQUID_METABALLS } from './liquidMetaballs'
export { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'

import { NEON_TUNNEL } from './neonTunnel'
import { LIQUID_METABALLS } from './liquidMetaballs'
import { FEEDBACK_KALEIDOSCOPE } from './feedbackKaleidoscope'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const PRODUCTION_SCENES: ShaderDefinition[] = [
  NEON_TUNNEL,
  LIQUID_METABALLS,
  FEEDBACK_KALEIDOSCOPE,
]

export const DEFAULT_SHADER_SCENE_ID = NEON_TUNNEL.id
