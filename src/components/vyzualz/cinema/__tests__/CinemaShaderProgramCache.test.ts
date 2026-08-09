import { describe, expect, it, vi } from 'vitest'
import type { ShaderDefinition } from '../../react/shaders/registry/shaderRegistryTypes'
import {
  acquireCinemaShaderProgramGraph,
  disposeCinemaShaderProgramCache,
  getCinemaShaderProgramCacheDiagnostics,
} from '../CinemaShaderProgramCache'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

function shader(id: string): ShaderDefinition {
  return {
    id,
    name: id,
    description: 'Cache lifecycle fixture',
    category: 'generator',
    version: 1,
    fragSrc: '#version 300 es\nprecision highp float; out vec4 outColor; void main(){ outColor=vec4(1.0); }',
    params: [],
    defaults: {},
  }
}

describe('CinemaShaderProgramCache', () => {
  it('bounds released same-context graphs and disposes every program at context shutdown', () => {
    const gl = createCinemaMockWebGL()
    for (let index = 0; index < 10; index += 1) {
      const lease = acquireCinemaShaderProgramGraph(gl, shader(`cache-scene-${index}`))
      expect(lease.graph).not.toBeNull()
      lease.release()
    }

    expect(getCinemaShaderProgramCacheDiagnostics(gl)).toMatchObject({
      size: 8,
      referencedCount: 0,
      missCount: 10,
      evictionCount: 2,
    })
    expect(gl.__calls.deletedPrograms).toBe(2)
    disposeCinemaShaderProgramCache(gl)
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(getCinemaShaderProgramCacheDiagnostics(gl).size).toBe(0)
  })

  it('does not cache a partial compile failure', () => {
    const gl = createCinemaMockWebGL()
    vi.mocked(gl.getShaderParameter).mockReturnValue(false)
    const lease = acquireCinemaShaderProgramGraph(gl, shader('compile-failure'))
    expect(lease.graph).toBeNull()
    expect(lease.error?.code).toBe('PROGRAM_COMPILE_FAIL')
    expect(getCinemaShaderProgramCacheDiagnostics(gl)).toMatchObject({ size: 0, missCount: 1 })
    disposeCinemaShaderProgramCache(gl)
    expect(gl.__calls.deletedShaders).toBe(gl.__calls.createdShaders)
  })
})
