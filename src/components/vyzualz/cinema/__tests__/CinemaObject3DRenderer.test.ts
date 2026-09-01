import { describe, expect, it, vi } from 'vitest'
import {
  CinemaObject3DRenderer,
  createCinemaObjectModelMatrix,
  createCinemaObjectNormalMatrix,
} from '../CinemaObject3DRenderer'
import { extrudeCinemaVectorShape, type CinemaVectorCpuMesh } from '../CinemaVectorGeometry'
import type { CinemaCameraUniformSnapshot } from '../CinemaRendererContracts'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

const VIEWPORT = { width: 640, height: 360, dpr: 1 }
const CAMERA: CinemaCameraUniformSnapshot = {
  cameraId: 'stage2-camera' as CinemaCameraUniformSnapshot['cameraId'],
  position: [0, 0, 6],
  rotation: [0, 0, 0],
  target: [0, 0, 0],
  fovDegrees: 50,
  rollRadians: 0,
  near: 0.1,
  far: 100,
}

describe('CinemaObject3DRenderer', () => {
  it('shares one GPU mesh across leases and evicts it when the final lease releases', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new CinemaObject3DRenderer(gl)
    const mesh = syntheticMesh()

    const first = renderer.acquireMesh('synthetic-rect:v1', mesh)
    const second = renderer.acquireMesh('synthetic-rect:v1', mesh)

    expect(first.indexCount).toBe(mesh.indices.length)
    expect(first.surfaces).toEqual(mesh.surfaces)
    expect(gl.__calls.createdVertexArrays).toBe(1)
    expect(gl.__calls.createdBuffers).toBe(3)
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 2, gpuUploadCount: 1 })

    first.release()
    expect(gl.__calls.deletedBuffers).toBe(0)
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 1 })

    second.release()
    second.release()
    expect(gl.__calls.deletedVertexArrays).toBe(1)
    expect(gl.__calls.deletedBuffers).toBe(3)
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0, gpuDeleteCount: 1 })
    renderer.dispose()
  })

  it('builds model and inverse-transpose normal matrices without rebuilding geometry', () => {
    const model = createCinemaObjectModelMatrix({
      position: [3, 4, 5],
      rotation: [0, 0, 0],
      scale: [2, 3, 4],
      pivot: [1, 2, 3],
    })
    const normal = createCinemaObjectNormalMatrix(model)

    expect(Array.from(model)).toEqual([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      1, -2, -7, 1,
    ])
    expect(normal[0]).toBeCloseTo(0.5)
    expect(normal[4]).toBeCloseTo(1 / 3)
    expect(normal[8]).toBeCloseTo(0.25)
  })

  it('reuses one shader program while duplicate instances draw indexed surface ranges with independent transforms', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new CinemaObject3DRenderer(gl)
    const mesh = syntheticMesh()
    const first = renderer.acquireMesh('synthetic-rect:v1', mesh)
    const second = renderer.acquireMesh('synthetic-rect:v1', mesh)

    expect(renderer.draw({
      mesh: first,
      viewport: VIEWPORT,
      camera: CAMERA,
      transform: { position: [-2, 0, 0], scale: [1, 1, 1] },
      material: { frontColor: [1, 0.2, 0.1, 1], sideColor: [0.2, 0.4, 1, 1], emissiveIntensity: 0.25 },
    })).toBe(true)
    expect(renderer.draw({
      mesh: second,
      viewport: VIEWPORT,
      camera: CAMERA,
      transform: { position: [2, 0, 0], scale: [2, 0.5, 1.5] },
    })).toBe(true)

    expect(gl.__calls.createdPrograms).toBe(1)
    expect(gl.__calls.createdBuffers).toBe(3)
    expect(gl.__calls.drawCount).toBe(6)
    expect(renderer.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, programCreateCount: 1, drawCount: 2 })

    const drawCalls = (gl.drawElements as unknown as ReturnType<typeof vi.fn>).mock.calls
    expect(drawCalls.slice(0, 3).map((call: unknown[]) => [call[1], call[3]])).toEqual([
      [mesh.surfaces.front.indexCount, mesh.surfaces.front.indexStart * Uint32Array.BYTES_PER_ELEMENT],
      [mesh.surfaces.back.indexCount, mesh.surfaces.back.indexStart * Uint32Array.BYTES_PER_ELEMENT],
      [mesh.surfaces.sides.indexCount, mesh.surfaces.sides.indexStart * Uint32Array.BYTES_PER_ELEMENT],
    ])
    const matrixCalls = (gl.uniformMatrix4fv as unknown as ReturnType<typeof vi.fn>).mock.calls
    const firstModel = matrixCalls[0]?.[2] as Float32Array
    const secondModel = matrixCalls[3]?.[2] as Float32Array
    expect(firstModel[12]).toBe(-2)
    expect(secondModel[12]).toBe(2)
    expect(secondModel[0]).toBe(2)
    expect(secondModel[5]).toBe(0.5)
    expect(secondModel[10]).toBe(1.5)

    first.release()
    second.release()
    renderer.dispose()
    expect(gl.__calls.deletedPrograms).toBe(1)
  })

  it('abandons stale context handles and recreates active GPU resources once after restoration', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new CinemaObject3DRenderer(gl)
    const lease = renderer.acquireMesh('synthetic-rect:v1', syntheticMesh())
    expect(renderer.draw({ mesh: lease, viewport: VIEWPORT, camera: CAMERA })).toBe(true)

    renderer.handleContextLost()
    expect(renderer.getDiagnostics()).toMatchObject({ contextLost: true, contextGeneration: 1 })
    expect(gl.__calls.deletedBuffers).toBe(0)
    expect(gl.__calls.deletedPrograms).toBe(0)

    renderer.rebuildAfterContextRestore()
    expect(renderer.getDiagnostics()).toMatchObject({ contextLost: false, contextGeneration: 2, gpuUploadCount: 2, programCreateCount: 2 })
    expect(gl.__calls.createdBuffers).toBe(6)
    expect(gl.__calls.createdPrograms).toBe(2)

    expect(renderer.draw({ mesh: lease, viewport: VIEWPORT, camera: CAMERA })).toBe(true)
    expect(renderer.getDiagnostics()).toMatchObject({ gpuUploadCount: 2, programCreateCount: 2, drawCount: 2 })

    lease.release()
    renderer.dispose()
    renderer.dispose()
    expect(gl.__calls.deletedBuffers).toBe(3)
    expect(gl.__calls.deletedVertexArrays).toBe(1)
    expect(gl.__calls.deletedPrograms).toBe(1)
  })

  it('rolls back failed GPU allocation and failed restore without retaining partial resources', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new CinemaObject3DRenderer(gl)
    const createBuffer = gl.createBuffer as unknown as ReturnType<typeof vi.fn>

    createBuffer.mockReturnValueOnce(null)
    expect(() => renderer.acquireMesh('allocation-failure', syntheticMesh())).toThrow(/allocate/)
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0, gpuUploadCount: 0 })
    expect(gl.__calls.deletedVertexArrays).toBe(1)
    expect(gl.__calls.deletedBuffers).toBe(2)

    const lease = renderer.acquireMesh('restore-failure', syntheticMesh())
    renderer.draw({ mesh: lease, viewport: VIEWPORT, camera: CAMERA })
    renderer.handleContextLost()
    createBuffer.mockReturnValueOnce(null)

    expect(() => renderer.rebuildAfterContextRestore()).toThrow(/allocate/)
    expect(renderer.getDiagnostics()).toMatchObject({
      contextLost: true,
      cachedMeshCount: 1,
      activeLeaseCount: 1,
      gpuUploadCount: 1,
    })

    renderer.rebuildAfterContextRestore()
    expect(renderer.getDiagnostics()).toMatchObject({ contextLost: false, gpuUploadCount: 2, programCreateCount: 2 })
    lease.release()
    renderer.dispose()
  })

  it('rejects malformed meshes and stable-key collisions without corrupting the cache', () => {
    const gl = createCinemaMockWebGL()
    const renderer = new CinemaObject3DRenderer(gl)
    const mesh = syntheticMesh()
    const lease = renderer.acquireMesh('synthetic-rect:v1', mesh)
    const changed = { ...mesh, positions: new Float32Array(mesh.positions) }
    changed.positions[0] += 0.25

    expect(() => renderer.acquireMesh('synthetic-rect:v1', changed)).toThrow(/key collision/)
    expect(() => renderer.acquireMesh('malformed', {
      ...mesh,
      indices: new Uint32Array([999, 0, 1]),
    })).toThrow(/out-of-range/)
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 1, gpuUploadCount: 1 })

    lease.release()
    renderer.dispose()
  })
})

function syntheticMesh(): CinemaVectorCpuMesh {
  const result = extrudeCinemaVectorShape({
    fillRule: 'nonzero',
    components: [{
      id: 'component',
      regions: [{
        id: 'rectangle',
        outer: { id: 'outer', points: [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]] },
      }],
    }],
  })
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
