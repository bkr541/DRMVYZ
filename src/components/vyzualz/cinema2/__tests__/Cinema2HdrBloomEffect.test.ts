import { describe, expect, it } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { cinema2HdrBloomEffectDefinition } from '../effects/Cinema2HdrBloomEffect'
import { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'
import { Cinema2ResourceManager } from '../runtime/Cinema2ResourceManager'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST } from '../presets/Cinema2BlockshiftPreset'
import type { Cinema2EffectRenderExecutionContext } from '../effects/Cinema2EffectContracts'

it('bypasses HDR bloom without mip allocation at zero, then reuses and disposes its chain', () => {
  const gl = createCinemaMockWebGL(), effect = CINEMA2_BLOCKSHIFT_PRESET_MANIFEST.effects!.find(effect => effect.typeId === 'hdr-bloom')!
  const resources = new Cinema2ResourceManager(gl)
  const history = new Cinema2HistoryService(gl, resources, CINEMA2_BLOCKSHIFT_PRESET_MANIFEST.id)
  const instance = cinema2HdrBloomEffectDefinition.create({ gl, effect, history })
  const frame = { frameId: 1, timestampMs: 0, deltaTimeSec: 0, elapsedTimeSec: 0, contextGeneration: 1, viewport: { width: 960, height: 540, dpr: 1 }, audio: null, director: null }
  const input = { id: 'source', attachment: 'color' as const, texture: {} as WebGLTexture, width: 960, height: 540 }
  const context: Cinema2EffectRenderExecutionContext = { frame, input, inputs: [input], target: null, width: 960, height: 540, mix: 1, quality: 'high', parameters: { ...effect.parameters, intensity: 0 } }
  instance.render(context)
  expect(gl.__calls.createdTextures).toBe(0)
  expect(gl.__calls.drawCount).toBe(1)
  instance.render({ ...context, parameters: effect.parameters! })
  expect(gl.__calls.createdTextures).toBe(8)
  const warm = gl.__calls.createdTextures
  instance.render({ ...context, parameters: effect.parameters! })
  expect(gl.__calls.createdTextures).toBe(warm)
  instance.render({ ...context, width: 540, height: 960 })
  expect(gl.__calls.createdTextures).toBe(warm) // A resize while zero does not allocate a new chain.
  instance.render({ ...context, width: 540, height: 960, parameters: effect.parameters! })
  expect(gl.__calls.deletedTextures).toBe(warm)
  instance.dispose(); instance.dispose()
  expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
  expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
  expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
  history.dispose(); resources.dispose()
})

describe('shared HDR bloom authored values', () => {
  it('validates the restrained BLOCKSHIFT configuration and rejects invalid intensity', () => {
    const effect = CINEMA2_BLOCKSHIFT_PRESET_MANIFEST.effects!.find(effect => effect.typeId === 'hdr-bloom')!
    expect(cinema2HdrBloomEffectDefinition.validate?.(effect)).toEqual([])
    expect(cinema2HdrBloomEffectDefinition.validate?.({ ...effect, parameters: { ...effect.parameters, intensity: -1 } })).not.toEqual([])
  })
})
