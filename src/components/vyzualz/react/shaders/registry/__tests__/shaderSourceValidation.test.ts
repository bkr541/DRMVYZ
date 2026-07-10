import { describe, expect, it } from 'vitest'
import { shaderRegistry } from '../index'
import {
  extractUniformDeclarations,
  getShaderSourceUnits,
  validateGlslSource,
  validateShaderDefinitionSources,
} from '../ShaderSourceValidator'

const registeredScenes = shaderRegistry.getAll()

describe('registered Shader scene GLSL regression coverage', () => {
  it.each(registeredScenes.map(scene => [scene.id, scene] as const))(
    '%s passes deterministic GLSL ES 3.00 source validation',
    (_id, scene) => {
      expect(validateShaderDefinitionSources(scene)).toEqual([])
    },
  )

  it('includes Riddim Railgun Sequencer and avoids GLSL-reserved identifiers', () => {
    const railgun = shaderRegistry.get('shader-riddim-railgun-sequencer')
    expect(railgun?.name).toBe('Riddim Railgun Sequencer')
    expect(railgun?.fragSrc).toContain('float activeRailMask')
    expect(railgun?.fragSrc).not.toMatch(/\bfloat\s+active\b/)
    expect(validateShaderDefinitionSources(railgun!)).toEqual([])
  })

  it('detects reserved identifiers instead of merely checking non-empty source', () => {
    const source = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  float active = 1.0;
  fragColor = vec4(active);
}`

    expect(validateGlslSource(source, 'fragment')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'RESERVED_IDENTIFIER',
        identifier: 'active',
        line: 5,
      }),
    ]))
  })

  it('keeps every registered parameter wired to a declared shader uniform', () => {
    for (const scene of registeredScenes) {
      const uniforms = new Set<string>()
      for (const unit of getShaderSourceUnits(scene)) {
        for (const name of extractUniformDeclarations(unit.source).keys()) uniforms.add(name)
      }

      for (const param of scene.params) {
        expect(uniforms.has(param.uniformName), `${scene.id}: ${param.uniformName}`).toBe(true)
      }
    }
  })
})
