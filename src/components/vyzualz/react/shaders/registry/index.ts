export * from './shaderRegistryTypes'
export * from './ShaderParameterSchema'
export { ShaderDefinitionValidator } from './ShaderDefinitionValidator'
export { ShaderRegistry } from './ShaderRegistry'

import type { ShaderDefinition } from './shaderRegistryTypes'
import { ShaderRegistry } from './ShaderRegistry'

// ── Module-level registry singleton ──────────────────────────────────────────

/**
 * The global shader scene registry.
 * Import this to register production scenes or look up definitions at runtime.
 * Tests should create fresh `ShaderRegistry` instances rather than mutating this.
 */
export const shaderRegistry = new ShaderRegistry()

// ── Internal development scene ────────────────────────────────────────────────
//
// A minimal shader that validates registry and runtime integration.
// Not exposed as a user-selectable preset — no entry in DEFAULT_REACT_PRESETS.

const DEV_SOLID_COLOR: ShaderDefinition = {
  id: 'shader-dev-solid-color',
  name: 'Dev: Solid Color',
  description: 'Development scene for validating registry and runtime integration.',
  category: 'utility',
  version: 1,

  fragSrc: [
    '#version 300 es',
    'precision mediump float;',
    'uniform vec4 u_color;',
    'uniform float u_brightness;',
    'out vec4 fragColor;',
    'void main() {',
    '  fragColor = vec4(u_color.rgb * clamp(u_brightness, 0.0, 2.0), u_color.a);',
    '}',
  ].join('\n'),

  params: [
    {
      id: 'color',
      type: 'color',
      label: 'Color',
      description: 'Fill colour for the solid-colour output.',
      uniformName: 'u_color',
      modulatable: false,
      default: [1.0, 0.5, 0.2, 1.0],
    },
    {
      id: 'brightness',
      type: 'float',
      label: 'Brightness',
      description: 'Scalar multiplier applied to the RGB channels.',
      uniformName: 'u_brightness',
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.0,
      modulatable: true,
    },
  ],

  defaults: {
    color:      [1.0, 0.5, 0.2, 1.0],
    brightness: 1.0,
  },

  quality: {
    minimumTier:              'low',
    recommendedTier:          'low',
    estimatedPassCount:       1,
    requiresFloatTarget:      false,
    requiresPersistentBuffers: false,
  },

  tags: ['dev', 'utility'],
  resetOnActivation: false,
}

shaderRegistry.register(DEV_SOLID_COLOR)

// ── Production scenes ─────────────────────────────────────────────────────────
import { PRODUCTION_SCENES } from '../scenes'
for (const scene of PRODUCTION_SCENES) {
  shaderRegistry.register(scene)
}
