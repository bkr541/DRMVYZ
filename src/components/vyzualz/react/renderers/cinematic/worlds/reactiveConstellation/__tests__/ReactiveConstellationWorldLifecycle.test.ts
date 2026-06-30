import { describe, expect, it } from 'vitest'
import type { CinematicWebGLServices } from '../../../../CinematicWorldRenderer'
import { ReactiveConstellationWorld } from '../../ReactiveConstellationWorld'

interface FakeGpuHarness {
  services: CinematicWebGLServices
  createdBuffers: WebGLBuffer[]
  createdVaos: WebGLVertexArrayObject[]
  deletedBuffers: WebGLBuffer[]
  deletedVaos: WebGLVertexArrayObject[]
  programLabels: string[]
}

function createHarness(): FakeGpuHarness {
  const createdBuffers: WebGLBuffer[] = []
  const createdVaos: WebGLVertexArrayObject[] = []
  const deletedBuffers: WebGLBuffer[] = []
  const deletedVaos: WebGLVertexArrayObject[] = []
  const programLabels: string[] = []
  const gl = {
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    createBuffer: () => {
      const buffer = { id: `buffer-${createdBuffers.length}` } as unknown as WebGLBuffer
      createdBuffers.push(buffer)
      return buffer
    },
    createVertexArray: () => {
      const vao = { id: `vao-${createdVaos.length}` } as unknown as WebGLVertexArrayObject
      createdVaos.push(vao)
      return vao
    },
    bindVertexArray: () => undefined,
    bindBuffer: () => undefined,
    bufferData: () => undefined,
    enableVertexAttribArray: () => undefined,
    vertexAttribPointer: () => undefined,
    vertexAttribDivisor: () => undefined,
    deleteBuffer: (buffer: WebGLBuffer) => deletedBuffers.push(buffer),
    deleteVertexArray: (vao: WebGLVertexArrayObject) => deletedVaos.push(vao),
  } as unknown as WebGL2RenderingContext

  const resources = {
    trackBuffer: (buffer: WebGLBuffer) => buffer,
    trackVAO: (vao: WebGLVertexArrayObject) => vao,
    untrackBuffer: () => undefined,
    untrackVAO: () => undefined,
  }
  const program = {} as never
  const services = {
    gl,
    resources,
    compileProgram: (descriptor: { label: string }) => {
      programLabels.push(descriptor.label)
      return program
    },
  } as unknown as CinematicWebGLServices

  return { services, createdBuffers, createdVaos, deletedBuffers, deletedVaos, programLabels }
}

describe('ReactiveConstellationWorld GPU lifecycle', () => {
  it('allocates both node and beam programs and disposes every tracked VAO and buffer once', () => {
    const harness = createHarness()
    const world = new ReactiveConstellationWorld()
    world.initialize({ services: harness.services, config: {} as never, presetId: 'test' })

    expect(harness.programLabels).toEqual([
      'cinematic/world/reactiveConstellation/nodes',
      'cinematic/world/reactiveConstellation/beams',
    ])
    expect(harness.createdBuffers.length).toBeGreaterThan(0)
    expect(harness.createdVaos.length).toBeGreaterThan(0)

    world.dispose()
    world.dispose()
    expect(harness.deletedBuffers).toHaveLength(harness.createdBuffers.length)
    expect(harness.deletedVaos).toHaveLength(harness.createdVaos.length)
  })

  it('drops invalid context-owned handles without deleting them and allows a clean restored instance', () => {
    const lostHarness = createHarness()
    const lostWorld = new ReactiveConstellationWorld()
    lostWorld.initialize({ services: lostHarness.services, config: {} as never, presetId: 'lost' })
    lostWorld.onContextLost()
    lostWorld.onContextRestored()
    lostWorld.dispose()
    expect(lostHarness.deletedBuffers).toHaveLength(0)
    expect(lostHarness.deletedVaos).toHaveLength(0)

    const restoredHarness = createHarness()
    const restoredWorld = new ReactiveConstellationWorld()
    restoredWorld.initialize({ services: restoredHarness.services, config: {} as never, presetId: 'restored' })
    restoredWorld.dispose()
    expect(restoredHarness.deletedBuffers).toHaveLength(restoredHarness.createdBuffers.length)
    expect(restoredHarness.deletedVaos).toHaveLength(restoredHarness.createdVaos.length)
  })

  it('does not leak WebGL resources across repeated preset or world switches', () => {
    const harness = createHarness()
    for (let index = 0; index < 6; index += 1) {
      const world = new ReactiveConstellationWorld()
      world.initialize({ services: harness.services, config: {} as never, presetId: `switch-${index}` })
      world.reset('presetChanged')
      world.dispose()
    }

    expect(harness.programLabels).toHaveLength(12)
    expect(harness.deletedBuffers).toHaveLength(harness.createdBuffers.length)
    expect(harness.deletedVaos).toHaveLength(harness.createdVaos.length)
    expect(new Set(harness.deletedBuffers).size).toBe(harness.deletedBuffers.length)
    expect(new Set(harness.deletedVaos).size).toBe(harness.deletedVaos.length)
  })
})
