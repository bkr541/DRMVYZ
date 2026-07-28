import { describe, expect, it } from 'vitest'
import { shaderRegistry } from '../registry'
import { resolveShaderSceneProvenance } from './ShaderSceneProvenance'

describe('Shader scene provenance', () => {
  it('returns to exact after a scene parameter is restored', () => {
    const definition = shaderRegistry.getAll().find(candidate => (
      Object.values(candidate.defaults).some(value => typeof value === 'number')
    ))
    expect(definition).toBeDefined()
    if (!definition) return
    const parameter = Object.keys(definition.defaults).find(key => typeof definition.defaults[key] === 'number')
    expect(parameter).toBeDefined()
    if (!parameter) return
    const exact = { ...definition.defaults }
    const original = exact[parameter] as number
    const modifiedValue = original + 0.01

    expect(resolveShaderSceneProvenance(definition, exact).status).toBe('exact')
    expect(resolveShaderSceneProvenance(definition, { ...exact, [parameter]: modifiedValue }).status).toBe('modified')
    expect(resolveShaderSceneProvenance(definition, exact).status).toBe('exact')
    expect(resolveShaderSceneProvenance(definition, { ...exact, compatibilityOnlyLegacyValue: 1 }).status).toBe('exact')
  })
})
