import { describe, expect, it, vi } from 'vitest'

import {
  CinemaAssetManager,
  CinemaObject3DRenderer,
  CinemaSvgVectorMeshCache,
  cinemaStableId,
  compileCinemaSvgAssetSource,
  type CinemaAssetId,
} from '../index'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

describe('Cinema SVG vector production services', () => {
  it('loads a Media Library SVG source, compiles once, reuses one Stage 2 GPU mesh, and releases it', async () => {
    const gl = createCinemaMockWebGL()
    const assetId = cinemaStableId<CinemaAssetId>('media-stage4-production-svg', 'asset')
    const manager = new CinemaAssetManager(gl, { report: vi.fn() }, {
      fetch: vi.fn(async () => new Response(
        `<svg><path fill-rule="evenodd" d="M0 0 L100 0 L100 100 L0 100 Z M25 25 L25 75 L75 75 L75 25 Z" /></svg>`,
        { status: 200 },
      )) as unknown as typeof fetch,
      createImage: () => { throw new Error('flat image decode is not part of this proof') },
      createVideo: () => { throw new Error('video decode is not part of this proof') },
      createObjectUrl: () => { throw new Error('object URL is not part of this proof') },
      revokeObjectUrl: vi.fn(),
    })
    manager.setSources([{
      assetId,
      revision: 3,
      name: 'Stage 4 Vector',
      mimeType: 'image/svg+xml',
      mediaKind: 'svg',
      runtimeUrl: 'https://signed.example/stage4.svg',
    }])

    const cache = new CinemaSvgVectorMeshCache()
    const first = await compileCinemaSvgAssetSource(manager, cache, assetId)
    const second = await compileCinemaSvgAssetSource(manager, cache, assetId)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(cache.getStats()).toEqual({ entries: 1, buildCount: 1, hitCount: 1 })

    const renderer = new CinemaObject3DRenderer(gl)
    const firstLease = renderer.acquireMesh(first.value.cacheKey, first.value.mesh)
    const secondLease = renderer.acquireMesh(second.value.cacheKey, second.value.mesh)
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 2, gpuUploadCount: 1 })

    const drew = renderer.draw({
      mesh: firstLease,
      viewport: { width: 640, height: 360, dpr: 1 },
      camera: {
        cameraId: cinemaStableId('stage4-camera', 'camera'),
        position: [0, 0, 4],
        rotation: [0, 0, 0],
        target: [0, 0, 0],
        fovDegrees: 50,
        rollRadians: 0,
        near: 0.1,
        far: 100,
      },
      transform: { scale: [1, 1, 0.35] },
    })
    expect(drew).toBe(true)
    expect(renderer.getDiagnostics().drawCount).toBe(1)

    firstLease.release()
    secondLease.release()
    expect(renderer.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0, gpuDeleteCount: 1 })
    manager.dispose()
    renderer.dispose()
  })
})
