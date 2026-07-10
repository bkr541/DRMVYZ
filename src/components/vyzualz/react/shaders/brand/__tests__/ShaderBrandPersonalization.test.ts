import { describe, expect, it, vi } from 'vitest'
import type { BrandKit } from '../../../../../../features/personalization/BrandKitTypes'
import type { ShaderDefinition } from '../../registry/shaderRegistryTypes'
import { LEGACY_REACTOR_SCENE_IDS, REACTOR, applyReactorRecipe } from '../../scenes/reactor'
import {
  applyShaderBrandUniforms,
  resolveShaderBrandPalette,
  resolveShaderColorParam,
} from '../ShaderBrandPersonalization'

const DEF: ShaderDefinition = {
  id: 'brand-test-shader',
  name: 'Brand Test',
  description: '',
  category: 'utility',
  version: 1,
  fragSrc: '#version 300 es\nout vec4 c; void main(){c=vec4(1.0);}',
  params: [
    {
      id: 'core', type: 'color', label: 'Core', uniformName: 'uCore',
      brandRole: 'primary', default: [0, 0.5, 1, 0.6],
    },
    {
      id: 'plain', type: 'color', label: 'Plain', uniformName: 'uPlain',
      default: [1, 0, 0, 1],
    },
  ],
  defaults: {
    core: [0, 0.5, 1, 0.6],
    plain: [1, 0, 0, 1],
  },
}

function kit(mode: 'original' | 'brand' | 'hybrid' = 'brand'): BrandKit {
  return {
    id: 'kit-a',
    userId: 'user-a',
    name: 'Kit',
    palette: {
      primary: '#FF3366', secondary: '#20D6A7', accent: '#7C5CFF',
      background: '#05070A', highlight: '#FFE66D', text: '#F7FAFC',
    },
    extractedPalette: null,
    extractionMetadata: null,
    defaultStrength: 1,
    engineRules: { shaderPads: { mode, strength: 1 } },
    presetRules: {},
    useForAppAccent: false,
    autoApply: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('Shader Brand Kit personalization', () => {
  it('resolves semantic colors at render time without mutating defaults', () => {
    const defaults = structuredClone(DEF.defaults)
    const context = resolveShaderBrandPalette(DEF, DEF.defaults, kit('brand'))
    const mapped = resolveShaderColorParam([0, 0.5, 1, 0.6], 'primary', context)

    expect(mapped).toEqual([1, 0.2, 0.4, 0.6])
    expect(DEF.defaults).toEqual(defaults)
  })

  it('preserves authored colors in Original mode and for anonymous color params', () => {
    const authored: [number, number, number, number] = [0.1, 0.2, 0.3, 0.4]
    const original = resolveShaderBrandPalette(DEF, DEF.defaults, kit('original'))
    const branded = resolveShaderBrandPalette(DEF, DEF.defaults, kit('brand'))

    expect(resolveShaderColorParam(authored, 'primary', original)).toEqual(authored)
    expect(resolveShaderColorParam(authored, undefined, branded)).toEqual(authored)
  })

  it('preserves a legacy Reactor recipe-specific Brand Kit rule', () => {
    const legacyKit = kit('brand')
    legacyKit.presetRules[LEGACY_REACTOR_SCENE_IDS.singularity] = {
      mode: 'original',
      enabled: false,
    }

    const context = resolveShaderBrandPalette(REACTOR, applyReactorRecipe('singularity'), legacyKit)
    expect(context.enabled).toBe(false)
    expect(context.mode).toBe('original')
  })

  it('uploads universal palette, strength, enable, and neutral impact uniforms', () => {
    const program = {
      setVec4: vi.fn(),
      setFloat: vi.fn(),
    }
    applyShaderBrandUniforms(program as never, resolveShaderBrandPalette(DEF, DEF.defaults, kit('brand')))

    expect(program.setVec4).toHaveBeenCalledWith('uBrandPrimary', 1, 0.2, 0.4, 1)
    expect(program.setVec4).toHaveBeenCalledWith('uBrandImpact', 1, 1, 1, 1)
    expect(program.setFloat).toHaveBeenCalledWith('uBrandStrength', 1)
    expect(program.setFloat).toHaveBeenCalledWith('uBrandEnabled', 1)
  })
})
