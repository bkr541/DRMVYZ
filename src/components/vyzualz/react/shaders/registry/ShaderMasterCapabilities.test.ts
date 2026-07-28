import { describe, expect, it } from 'vitest'
import { shaderRegistry } from '.'
import { detectShaderMasterCapabilities, shaderMasterCapabilitiesMatchSource } from './ShaderMasterCapabilities'

describe('Shader master capability metadata', () => {
  it('matches executable uniform use for every registered scene', () => {
    for (const definition of shaderRegistry.getAll()) {
      expect(shaderMasterCapabilitiesMatchSource(definition), definition.id).toBe(true)
      expect(definition.masterCapabilities).toEqual(detectShaderMasterCapabilities(definition))
    }
  })

  it('retains global and scene-local controls when both have executable scope', () => {
    const prism = shaderRegistry.get('shader-neon-tunnel')
    expect(prism?.masterCapabilities?.intensity).toBe(true)
    expect(prism?.masterCapabilities?.motion).toBe(true)
    expect(prism?.masterCapabilities?.glow).toBe(false)
    expect(prism?.params.some(param => param.uniformName === 'uGlow')).toBe(true)
  })

  it('keeps confirmed unsupported controls disabled without inventing shader behavior', () => {
    expect(shaderRegistry.get('shader-neon-tunnel')?.masterCapabilities?.glow).toBe(false)
    expect(shaderRegistry.get('shader-liquid-metaballs')?.masterCapabilities?.glow).toBe(false)
    expect(shaderRegistry.get('shader-brand-echo-signal')?.masterCapabilities?.motion).toBe(false)
    expect(shaderRegistry.get('shader-laser-lattice-overdrive')?.masterCapabilities?.bassReactivity).toBe(false)
    expect(shaderRegistry.get('shader-melodic-rift-bloom')?.masterCapabilities?.bassReactivity).toBe(false)
  })
})
