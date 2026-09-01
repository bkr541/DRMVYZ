/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as opentype from 'opentype.js'

import { createDefaultCinema3DObjectDefinition } from '../Cinema3DObjectState'
import { cinemaStableId, type CinemaAssetId, type CinemaCameraId } from '../CinemaIdentifiers'
import { CinemaRuntime } from '../runtime/CinemaRuntime'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema reusable 3D object runtime', () => {
  it('uses the real CinemaRuntime service, preserves mesh resources for live changes, and rebuilds structural changes', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    expect(created.runtime).not.toBeNull()
    const runtime = created.runtime
    if (!runtime) return

    const authored = {
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'text' as const, text: 'O', fontIdentity: 'stage5-proof-font', font: null },
    }
    const object = runtime.webgl.objectInstances.createObject(authored)
    const first = object.prepareText({ font: productionProofFont(), fontRevision: 1 })
    expect(first.status).toBe('ready')
    expect(first.localBounds).not.toBeNull()
    expect(first.worldBounds).not.toBeNull()
    expect(first.metadata.glyphs).toHaveLength(1)
    expect(first.metadata.components).toHaveLength(1)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 1, gpuUploadCount: 1 })

    const transformed = {
      ...authored,
      geometry: { ...authored.geometry, extrusionDepth: 1.25 },
      transform: { ...authored.transform, position: [2, 3, 4] as const },
      appearance: { ...authored.appearance, emissiveIntensity: 0.8 },
    }
    expect(object.setDefinition(transformed)).toBe('transform')
    expect(object.getSnapshot().status).toBe('ready')
    expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBe(1)
    expect(object.draw({ width: 640, height: 360, dpr: 1 }, camera())).toBe(true)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ gpuUploadCount: 1, drawCount: 1 })

    const recolored = {
      ...transformed,
      appearance: { ...transformed.appearance, frontColor: [0.8, 0.2, 0.9, 1] as const },
    }
    expect(object.setDefinition(recolored)).toBe('material')
    expect(object.getSnapshot().status).toBe('ready')
    expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBe(1)

    const higherQuality = { ...recolored, geometry: { ...recolored.geometry, quality: 'high' as const } }
    expect(object.setDefinition(higherQuality)).toBe('geometry')
    expect(object.getSnapshot().status).toBe('unavailable')
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0 })
    expect(object.prepareText({ font: productionProofFont(), fontRevision: 1 }).status).toBe('ready')
    expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBe(2)

    const changedSource = { ...higherQuality, source: { ...higherQuality.source, text: 'OO' } }
    expect(object.setDefinition(changedSource)).toBe('source')
    expect(object.prepareText({ font: productionProofFont(), fontRevision: 1 }).status).toBe('ready')
    expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBe(3)

    object.dispose()
    expect(runtime.webgl.objectInstances.getDiagnostics().activeObjectCount).toBe(0)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0 })
    runtime.dispose()
  })


  it('compiles Media Library SVGs through the canonical asset manager and replaces changed source revisions', async () => {
    // CinemaRuntime.create doesn't expose a way to inject the asset manager's
    // fetch dependency (unlike CinemaSvgVectorProductionPath.test.ts, which
    // constructs CinemaAssetManager directly and can). Left on the real
    // global fetch, the AbortController this test's jsdom environment
    // constructs isn't the same class Node's native fetch (undici) checks
    // its `signal` option against, so the request throws a realm-mismatch
    // TypeError before it ever reaches the network. Stubbing global fetch
    // sidesteps that entirely — same fix, just at the global level instead
    // of the constructor argument the simpler test could use.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      `<svg><path d="M0 0 L100 0 L100 100 L0 100 Z"/></svg>`,
      { status: 200 },
    )))
    const gl = createCinemaMockWebGL()
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, { requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    const assetId = cinemaStableId<CinemaAssetId>('stage5-svg-asset', 'asset')
    runtime.assets.setSources([{
      assetId,
      revision: 1,
      name: 'Stage 5 SVG',
      mimeType: 'image/svg+xml',
      mediaKind: 'svg',
      runtimeUrl: 'data:image/svg+xml,%3Csvg%3E%3Cpath%20d%3D%22M0%200%20L100%200%20L100%20100%20L0%20100%20Z%22/%3E%3C/svg%3E',
    }])
    const object = runtime.webgl.objectInstances.createObject({
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'svg', asset: { assetId, role: 'logo' } },
    })
    const first = await object.prepareSvg(runtime.assets)
    expect(first.status).toBe('ready')
    expect(first.metadata.components.length).toBeGreaterThan(0)
    expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBe(1)

    const repeated = await object.prepareSvg(runtime.assets)
    expect(repeated.meshKey).toBe(first.meshKey)
    expect(runtime.webgl.objects3d.getDiagnostics().gpuUploadCount).toBe(1)

    runtime.assets.setSources([{
      assetId,
      revision: 2,
      name: 'Stage 5 SVG',
      mimeType: 'image/svg+xml',
      mediaKind: 'svg',
      runtimeUrl: 'data:image/svg+xml,%3Csvg%3E%3Cpath%20d%3D%22M0%200%20L120%200%20L120%20100%20L0%20100%20Z%22/%3E%3C/svg%3E',
    }])
    const replaced = await object.prepareSvg(runtime.assets)
    expect(replaced.status).toBe('ready')
    expect(replaced.meshKey).not.toBe(first.meshKey)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 1, activeLeaseCount: 1, gpuUploadCount: 2 })
    runtime.dispose()
  })

  it('keeps live object leases valid across the Cinema-owned WebGL context recovery path', () => {
    const canvas = document.createElement('canvas')
    const gl = createCinemaMockWebGL()
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, { requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    const object = runtime.webgl.objectInstances.createObject({
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'text', text: 'O', fontIdentity: 'stage5-context-font', font: null },
    })
    expect(object.prepareText({ font: productionProofFont(), fontRevision: 1 }).status).toBe('ready')
    expect(object.draw({ width: 320, height: 180, dpr: 1 }, camera())).toBe(true)
    runtime.webgl.handleContextLost()
    expect(object.getSnapshot().status).toBe('ready')
    expect(object.draw({ width: 320, height: 180, dpr: 1 }, camera())).toBe(false)
    runtime.webgl.rebuildAfterContextRestore()
    expect(object.draw({ width: 320, height: 180, dpr: 1 }, camera())).toBe(true)
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ activeLeaseCount: 1, gpuUploadCount: 2, drawCount: 2 })
    runtime.dispose()
  })

  it('keeps a missing SVG authored object valid while exposing a safe runtime error', async () => {
    const gl = createCinemaMockWebGL()
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(gl)
    const created = CinemaRuntime.create(canvas, { requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() })
    const runtime = created.runtime
    expect(runtime).not.toBeNull()
    if (!runtime) return

    const object = runtime.webgl.objectInstances.createObject({
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'svg', asset: null },
    })
    const snapshot = await object.prepareSvg(runtime.assets)
    expect(snapshot.status).toBe('error')
    expect(snapshot.error).toContain('missing or unavailable')
    expect(runtime.webgl.objects3d.getDiagnostics()).toMatchObject({ cachedMeshCount: 0, activeLeaseCount: 0 })
    runtime.dispose()
  })
})

function camera() {
  return {
    cameraId: cinemaStableId<CinemaCameraId>('stage5-camera', 'camera'),
    position: [0, 0, 5] as const,
    rotation: [0, 0, 0] as const,
    target: [0, 0, 0] as const,
    fovDegrees: 50,
    rollRadians: 0,
    near: 0.01,
    far: 100,
  }
}

function productionProofFont(): opentype.Font {
  const outer = [[0, 0], [600, 0], [600, 1000], [0, 1000]] as const
  const hole = [[180, 220], [420, 220], [420, 780], [180, 780]] as const
  const glyph = {
    index: 1,
    advanceWidth: 650,
    getPath(x: number, y: number, fontSize: number) {
      const scale = fontSize / 1000
      const commands: Array<Record<string, number | string>> = []
      for (const ring of [outer, hole]) {
        commands.push({ type: 'M', x: x + ring[0][0] * scale, y: y + ring[0][1] * scale })
        for (let index = 1; index < ring.length; index += 1) commands.push({ type: 'L', x: x + ring[index][0] * scale, y: y + ring[index][1] * scale })
        commands.push({ type: 'Z' })
      }
      return { commands }
    },
  }
  return {
    unitsPerEm: 1000,
    ascender: 1000,
    charToGlyph: () => glyph as unknown as opentype.Glyph,
    getKerningValue: () => 0,
  } as unknown as opentype.Font
}
