import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID, cinema2AmbientOcclusionEffectDefinition } from '../effects/Cinema2AmbientOcclusionEffect'
import {
  CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID,
  cinema2AntiAliasingEffectDefinition,
  loadCinema2AntiAliasingSources,
  portFxaaFragment,
  portSmaaFragment,
  portSmaaVertex,
  resolveCinema2AntiAliasingMode,
  setCinema2AntiAliasingSourceLoaderForTests,
} from '../effects/Cinema2AntiAliasingEffect'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import type { Cinema2EffectRenderExecutionContext } from '../effects/Cinema2EffectContracts'
import { cinema2StableId, type Cinema2EffectId, type Cinema2EffectManifest } from '../contracts/Cinema2NativePresetManifest'
import { getCinema2RenderTargetPool } from '../runtime/Cinema2RenderTargetPool'

const manifest = (typeId: string, parameters: Record<string, unknown> = {}): Readonly<Cinema2EffectManifest> => ({
  id: cinema2StableId<Cinema2EffectId>('test-effect'), typeId, version: 1, enabled: true, order: 0, scope: 'output', parameters: { mix: 1, ...parameters },
}) as never

describe('registration is opt-in', () => {
  it('registers both effects without creating anything', () => {
    expect(cinema2NativeEffectRegistry.get(CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID, 1)?.create).toBe(cinema2AmbientOcclusionEffectDefinition.create)
    expect(cinema2NativeEffectRegistry.get(CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID, 1)?.create).toBe(cinema2AntiAliasingEffectDefinition.create)
  })

  it('is not used by any first-party preset', async () => {
    const { cinema2NativePresetRegistry } = await import('..')
    const presets = (cinema2NativePresetRegistry as unknown as { list?: () => readonly { effects?: readonly { typeId: string }[] }[] }).list?.() ?? []
    expect(presets.length).toBeGreaterThan(5)
    for (const preset of presets) {
      for (const effect of preset.effects ?? []) {
        expect(['ambient-occlusion', 'anti-aliasing']).not.toContain(effect.typeId)
      }
    }
  })
})

describe('parameter validation', () => {
  it('accepts valid ambient occlusion parameters and rejects out-of-range ones', () => {
    expect(cinema2AmbientOcclusionEffectDefinition.validate!(manifest('ambient-occlusion', { radius: 0.8, intensity: 1.5, bias: 0.05, power: 1.2, denoise: 1, emissiveProtect: 0.5, output: 'occlusion' }))).toEqual([])
    const codes = cinema2AmbientOcclusionEffectDefinition.validate!(manifest('ambient-occlusion', { radius: 0, intensity: 9, output: 'depth' })).map(diagnostic => diagnostic.path)
    expect(codes.sort()).toEqual(['$.parameters.intensity', '$.parameters.output', '$.parameters.radius'])
  })

  it('accepts the four anti-aliasing modes and rejects others', () => {
    for (const mode of ['auto', 'off', 'fxaa', 'smaa']) expect(cinema2AntiAliasingEffectDefinition.validate!(manifest('anti-aliasing', { mode }))).toEqual([])
    expect(cinema2AntiAliasingEffectDefinition.validate!(manifest('anti-aliasing', { mode: 'msaa', threshold: 0.9 })).map(diagnostic => diagnostic.path).sort()).toEqual(['$.parameters.mode', '$.parameters.threshold'])
  })

  it('resolves auto to the quality tier (FXAA on low, SMAA above)', () => {
    expect([resolveCinema2AntiAliasingMode('auto', 'low'), resolveCinema2AntiAliasingMode(undefined, 'medium'), resolveCinema2AntiAliasingMode('auto', 'high')]).toEqual(['fxaa', 'smaa', 'smaa'])
    expect(resolveCinema2AntiAliasingMode('fxaa', 'high')).toBe('fxaa')
    expect(resolveCinema2AntiAliasingMode('off', 'low')).toBe('off')
  })
})

describe('Three.js shader adaptation', () => {
  it('turns the installed SMAA and FXAA shaders into WebGL2 programs', async () => {
    const sources = await loadCinema2AntiAliasingSources()
    for (const shader of [sources.smaa.edges, sources.smaa.weights, sources.smaa.blend]) {
      const vertex = portSmaaVertex(shader)
      expect(vertex.startsWith('#version 300 es')).toBe(true)
      expect(vertex).toMatch(/gl_VertexID/)
      expect(vertex).not.toMatch(/projectionMatrix|modelViewMatrix|attribute /)
      expect(vertex).toMatch(/SMAA\w+VS\( vUv \);/)
      const fragment = portSmaaFragment(shader)
      expect(fragment.startsWith('#version 300 es')).toBe(true)
      expect(fragment).toMatch(/pc_fragColor/)
    }
    const edges = portSmaaFragment(sources.smaa.edges, { hdrEdges: true })
    expect(edges).toMatch(/aaCompress\( texture2D\( colorTex/)
    expect(edges).toMatch(/uniform float u_smaaThreshold/)
    expect(edges).not.toMatch(/SMAA_THRESHOLD/)
    expect(portSmaaFragment(sources.smaa.weights)).toMatch(/#define SMAA_MAX_SEARCH_STEPS 8/)
    const fxaa = portFxaaFragment(sources.fxaa)
    expect(fxaa).toMatch(/return aaCompress\( dot\(/)
    expect(sources.smaa.areaImageUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(sources.smaa.searchImageUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('fails loudly if the installed Three.js changes the shader it adapts', () => {
    expect(() => portFxaaFragment({ vertexShader: '', fragmentShader: 'void main() {}' })).toThrow(/FXAA/)
    expect(() => portSmaaFragment({ vertexShader: '', fragmentShader: 'void main() {}' }, { hdrEdges: true })).toThrow(/SMAA edge/)
    expect(() => portSmaaVertex({ vertexShader: 'void main() {}', fragmentShader: '' })).toThrow(/vertex setup call/)
  })
})

function context(gl: WebGL2RenderingContext, overrides: Partial<Cinema2EffectRenderExecutionContext> = {}): Cinema2EffectRenderExecutionContext {
  const texture = {} as WebGLTexture
  const input = { id: 'color', attachment: 'color' as const, texture, width: 640, height: 360 }
  void gl
  return { frame: {} as never, input, inputs: [input], target: null, width: 640, height: 360, mix: 1, parameters: { mix: 1 }, quality: 'high', ...overrides } as never
}

describe('bypass behaviour', () => {
  function create(definition: typeof cinema2AmbientOcclusionEffectDefinition, typeId: string) {
    const gl = createCinemaMockWebGL()
    gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
    const instance = definition.create({ gl, effect: manifest(typeId), history: {} as never })
    return { gl, instance }
  }

  it('creating an effect compiles nothing until it renders', () => {
    const { gl } = create(cinema2AmbientOcclusionEffectDefinition, 'ambient-occlusion')
    expect(gl.__calls.createdPrograms).toBe(0)
    const aa = create(cinema2AntiAliasingEffectDefinition, 'anti-aliasing')
    expect(aa.gl.__calls.createdPrograms).toBe(0)
  })

  it('ambient occlusion on low quality, or without depth or camera, only copies the image: one program, no render targets', () => {
    for (const overrides of [{ quality: 'low' as const }, { quality: 'high' as const }]) {
      const { gl, instance } = create(cinema2AmbientOcclusionEffectDefinition, 'ambient-occlusion')
      instance.render(context(gl, overrides))
      expect(gl.__calls.createdPrograms).toBe(1)
      expect(gl.__calls.drawCount).toBe(1)
      expect(getCinema2RenderTargetPool(gl).getStats().totalAllocations).toBe(0)
      instance.dispose()
      expect(gl.__calls.deletedPrograms).toBe(1)
    }
  })

  it('anti-aliasing off copies without ever loading Three', () => {
    const loader = vi.fn()
    setCinema2AntiAliasingSourceLoaderForTests(async () => { loader(); throw new Error('should not load') })
    const { gl, instance } = create(cinema2AntiAliasingEffectDefinition, 'anti-aliasing')
    instance.render(context(gl, { parameters: { mix: 1, mode: 'off' } }))
    expect(loader).not.toHaveBeenCalled()
    expect(gl.__calls.drawCount).toBe(1)
    instance.dispose()
    setCinema2AntiAliasingSourceLoaderForTests(null)
  })

  it('anti-aliasing passes the image through while its shaders load, then reports a load failure once', async () => {
    let reject: (error: Error) => void = () => {}
    setCinema2AntiAliasingSourceLoaderForTests(() => new Promise((_, fail) => { reject = fail }))
    const { gl, instance } = create(cinema2AntiAliasingEffectDefinition, 'anti-aliasing')
    const render = () => instance.render(context(gl, { parameters: { mix: 1, mode: 'fxaa' } }))
    expect(render).not.toThrow()
    expect(gl.__calls.drawCount).toBe(1)
    reject(new Error('chunk failed'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(render).toThrow(/chunk failed/)
    instance.dispose()
    setCinema2AntiAliasingSourceLoaderForTests(null)
  })
})
