import { describe, it, expect, vi } from 'vitest'
import { GeometryPass, GEOMETRY_SEGMENT_FLOAT_STRIDE } from '../GeometryPass'
import type { GeometryPassInput } from '../shaderRuntimeTypes'

// ── Mock WebGL2 context ───────────────────────────────────────────────────────

function makeMockGL() {
  let objId = 1
  const calls: { method: string; args: unknown[] }[] = []
  const track = (method: string, args: unknown[]) => { calls.push({ method, args }) }

  const gl = {
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    FLOAT: 0x1406,
    TRIANGLE_STRIP: 0x0005,
    FRAMEBUFFER: 0x8D40,
    COLOR_BUFFER_BIT: 0x4000,
    TEXTURE_2D: 0x0DE1,

    createVertexArray: vi.fn(() => ({ _va: objId++ } as unknown as WebGLVertexArrayObject)),
    bindVertexArray: vi.fn((...a: unknown[]) => track('bindVertexArray', a)),
    deleteVertexArray: vi.fn((...a: unknown[]) => track('deleteVertexArray', a)),

    createBuffer: vi.fn(() => ({ _b: objId++ } as unknown as WebGLBuffer)),
    bindBuffer: vi.fn((...a: unknown[]) => track('bindBuffer', a)),
    bufferData: vi.fn((...a: unknown[]) => track('bufferData', a)),
    bufferSubData: vi.fn((...a: unknown[]) => track('bufferSubData', a)),
    deleteBuffer: vi.fn((...a: unknown[]) => track('deleteBuffer', a)),

    enableVertexAttribArray: vi.fn((...a: unknown[]) => track('enableVertexAttribArray', a)),
    vertexAttribPointer: vi.fn((...a: unknown[]) => track('vertexAttribPointer', a)),
    vertexAttribDivisor: vi.fn((...a: unknown[]) => track('vertexAttribDivisor', a)),

    drawArraysInstanced: vi.fn((...a: unknown[]) => track('drawArraysInstanced', a)),

    bindFramebuffer: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),

    _calls: calls,
  }
  return gl as unknown as WebGL2RenderingContext & typeof gl
}

function makeMockProgram() {
  return {
    activate: vi.fn(),
    setSampler: vi.fn(),
  } as unknown as import('../ShaderProgram').ShaderProgram
}

function makeSegments(count: number): GeometryPassInput {
  const data = new Float32Array(count * GEOMETRY_SEGMENT_FLOAT_STRIDE)
  for (let i = 0; i < count; i++) {
    const base = i * GEOMETRY_SEGMENT_FLOAT_STRIDE
    data[base] = i; data[base + 1] = 0
    data[base + 2] = i + 1; data[base + 3] = 0
    data[base + 4] = 1; data[base + 5] = 1; data[base + 6] = 1; data[base + 7] = 1
    data[base + 8] = 1; data[base + 9] = 0; data[base + 10] = 1
  }
  return { data, count }
}

describe('GeometryPass', () => {
  it('does nothing for a zero-count segment buffer (no VAO/buffer allocation, no draw call)', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], { data: new Float32Array(0), count: 0 })
    expect(gl.createVertexArray).not.toHaveBeenCalled()
    expect(gl.drawArraysInstanced).not.toHaveBeenCalled()
  })

  it('allocates the VAO and corner template buffer exactly once across multiple frames', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(5))
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(5))
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(5))
    expect(gl.createVertexArray).toHaveBeenCalledTimes(1)
    // Two buffers are created up front: the static corner template + the instance buffer.
    expect(gl.createBuffer).toHaveBeenCalledTimes(2)
  })

  it('issues one instanced TRIANGLE_STRIP draw call of 4 vertices per segment count', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(7))
    expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(1)
    expect(gl.drawArraysInstanced).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4, 7)
  })

  it('uploads instance data via bufferSubData, not bufferData, on steady-state frames', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(10)) // first frame allocates capacity
    const bufferDataCallsBefore = (gl.bufferData as ReturnType<typeof vi.fn>).mock.calls.length
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(10)) // steady-state frame
    const bufferDataCallsAfter = (gl.bufferData as ReturnType<typeof vi.fn>).mock.calls.length
    expect(bufferDataCallsAfter).toBe(bufferDataCallsBefore) // no new allocation
    expect(gl.bufferSubData).toHaveBeenCalled()
  })

  it('grows the instance buffer (reallocates) only when segment count exceeds current capacity', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(10))
    const bufferDataCallsAfterFirst = (gl.bufferData as ReturnType<typeof vi.fn>).mock.calls.length
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(100_000)) // far exceeds default capacity
    const bufferDataCallsAfterGrow = (gl.bufferData as ReturnType<typeof vi.fn>).mock.calls.length
    expect(bufferDataCallsAfterGrow).toBeGreaterThan(bufferDataCallsAfterFirst)
  })

  it('binds provided textures and sets sampler uniforms before drawing', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    const program = makeMockProgram()
    const texture = {} as WebGLTexture
    pass.run(program, null, 100, 100, [{ unit: 0, texture, uniformName: 'uTex' }], makeSegments(3))
    expect(program.setSampler).toHaveBeenCalledWith('uTex', 0)
  })

  it('clears the target when opts.clear is true', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(2), { clear: true })
    expect(gl.clear).toHaveBeenCalled()
  })

  it('dispose() deletes the VAO and both buffers and is idempotent', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(3))
    pass.dispose()
    expect(gl.deleteVertexArray).toHaveBeenCalledTimes(1)
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(2)
    pass.dispose() // idempotent — no further deletes
    expect(gl.deleteVertexArray).toHaveBeenCalledTimes(1)
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(2)
  })

  it('a disposed pass draws nothing on a subsequent run()', () => {
    const gl = makeMockGL()
    const pass = new GeometryPass(gl)
    pass.dispose()
    pass.run(makeMockProgram(), null, 100, 100, [], makeSegments(5))
    expect(gl.drawArraysInstanced).not.toHaveBeenCalled()
  })
})
