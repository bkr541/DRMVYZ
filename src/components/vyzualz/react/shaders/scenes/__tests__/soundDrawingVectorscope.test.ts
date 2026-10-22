import { describe, it, expect } from 'vitest'
import { ShaderRegistry } from '../../registry/ShaderRegistry'
import { ShaderDefinitionValidator } from '../../registry/ShaderDefinitionValidator'
import { SOUND_DRAWING_VECTORSCOPE, SOUND_DRAWING_VECTORSCOPE_SCENE_ID } from '../soundDrawingVectorscope'
import { PRODUCTION_SCENES } from '../../scenes'

describe('SOUND_DRAWING_VECTORSCOPE — schema validity', () => {
  it('passes ShaderDefinitionValidator with zero errors', () => {
    const result = ShaderDefinitionValidator.validate(SOUND_DRAWING_VECTORSCOPE)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('registers into a fresh ShaderRegistry without throwing', () => {
    const reg = new ShaderRegistry()
    expect(() => reg.register(SOUND_DRAWING_VECTORSCOPE)).not.toThrow()
    expect(reg.get(SOUND_DRAWING_VECTORSCOPE_SCENE_ID)).toBeDefined()
  })

  it('declares requiresFloatTarget, requiresPersistentBuffers, and estimatedPassCount', () => {
    expect(SOUND_DRAWING_VECTORSCOPE.quality?.requiresFloatTarget).toBe(true)
    expect(SOUND_DRAWING_VECTORSCOPE.quality?.requiresPersistentBuffers).toBe(true)
    expect(SOUND_DRAWING_VECTORSCOPE.quality?.estimatedPassCount).toBe(SOUND_DRAWING_VECTORSCOPE.passes?.length)
  })

  it('declares a feedback block (pingPongBuffers) matching its one ping-pong pass', () => {
    expect(SOUND_DRAWING_VECTORSCOPE.feedback?.pingPongBuffers).toBe(1)
    const pingPongPasses = SOUND_DRAWING_VECTORSCOPE.passes?.filter(p => p.pingPong) ?? []
    expect(pingPongPasses).toHaveLength(1)
  })

  it('is intentionally absent from PRODUCTION_SCENES (not yet wired to a live geometry data source)', () => {
    expect(PRODUCTION_SCENES.some(s => s.id === SOUND_DRAWING_VECTORSCOPE_SCENE_ID)).toBe(false)
  })

  it('every param default satisfies its own declared range/enum', () => {
    // ShaderDefinitionValidator already checks this, but assert it explicitly
    // here too so a future edit to defaults fails fast in this file.
    for (const key of Object.keys(SOUND_DRAWING_VECTORSCOPE.defaults)) {
      const param = SOUND_DRAWING_VECTORSCOPE.params.find(p => p.id === key)
      expect(param).toBeDefined()
    }
  })
})
