import { describe, expect, it } from 'vitest'

import {
  CinemaSvgVectorMeshCache,
  cinemaStableId,
  compileCinemaSvgVector,
  type CinemaAssetId,
} from '../index'

const assetId = cinemaStableId<CinemaAssetId>('media-svg-stage4', 'asset')

function compile(rawSvg: string, revision: string | number = 1) {
  return compileCinemaSvgVector({ assetId, revision, rawSvg })
}

describe('Cinema SVG true 3D vector compiler', () => {
  it('compiles supported filled primitives and disconnected components into the shared solid mesh', () => {
    const result = compile(`
      <svg viewBox="0 0 100 100">
        <rect x="0" y="0" width="20" height="20" />
        <circle cx="50" cy="10" r="10" />
        <ellipse cx="80" cy="10" rx="10" ry="6" />
        <polygon points="0,60 20,60 10,80" />
      </svg>
    `)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.shape.components).toHaveLength(4)
    expect(result.value.mesh.positions.length).toBeGreaterThan(0)
    expect(result.value.mesh.surfaces.front.indexCount).toBeGreaterThan(0)
    expect(result.value.mesh.surfaces.sides.indexCount).toBeGreaterThan(0)
  })

  it('applies nested affine transforms and flips SVG Y into Cinema local coordinates deterministically', () => {
    const raw = `<svg><g transform="translate(20 30)"><g transform="scale(2)"><rect x="0" y="0" width="10" height="20" transform="rotate(90 5 10)" /></g></g></svg>`
    const first = compile(raw)
    const second = compile(raw)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(Array.from(first.value.mesh.positions)).toEqual(Array.from(second.value.mesh.positions))
    expect(first.value.cacheKey).toBe(second.value.cacheKey)
    expect(first.value.localBounds.center[0]).toBeCloseTo(0)
    expect(first.value.localBounds.center[1]).toBeCloseTo(0)
  })

  it('preserves compound holes for evenodd and nonzero fill rules', () => {
    const evenodd = compile(`<svg><path fill-rule="evenodd" d="M0 0 L100 0 L100 100 L0 100 Z M25 25 L25 75 L75 75 L75 25 Z" /></svg>`)
    expect(evenodd.ok).toBe(true)
    if (evenodd.ok) expect(evenodd.value.shape.components[0].regions[0].holes).toHaveLength(1)

    const nonzero = compile(`<svg><path fill-rule="nonzero" d="M0 0 L100 0 L100 100 L0 100 Z M25 25 L25 75 L75 75 L75 25 Z" /></svg>`)
    expect(nonzero.ok).toBe(true)
    if (nonzero.ok) expect(nonzero.value.shape.components[0].regions[0].holes).toHaveLength(1)
  })

  it('rejects unsupported, malformed, open/stroke-only, and self-intersecting geometry safely', () => {
    expect(compile(`<svg><text x="0" y="10">NO</text></svg>`)).toMatchObject({ ok: false, error: { code: 'unsupported-svg' } })
    expect(compile(`<svg><path fill="none" stroke="black" d="M0 0 L10 10" /></svg>`)).toMatchObject({ ok: false, error: { code: 'unsupported-svg' } })
    expect(compile(`<svg><path d="M0 0 L10 0 L10 10" /></svg>`)).toMatchObject({ ok: false, error: { code: 'unsupported-svg' } })
    expect(compile(`<svg><path d="M0 0 L10 10 L0 10 L10 0 Z" /></svg>`)).toMatchObject({ ok: false, error: { code: 'invalid-topology' } })
    expect(compile(`<not-svg />`)).toMatchObject({ ok: false, error: { code: 'malformed-svg' } })
  })

  it('enforces deterministic complexity budgets before mesh allocation', () => {
    const result = compileCinemaSvgVector({
      assetId,
      revision: 1,
      rawSvg: `<svg><circle cx="0" cy="0" r="100" /></svg>`,
      options: { curveTolerance: 0.01, limits: { maxPointsPerContour: 16 } },
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'too-complex' } })
  })

  it('reuses unchanged asset revisions and invalidates cache entries by asset identity', () => {
    const cache = new CinemaSvgVectorMeshCache()
    const request = { assetId, revision: 7, rawSvg: `<svg><rect width="10" height="10" /></svg>` }
    expect(cache.getOrCompile(request).ok).toBe(true)
    expect(cache.getOrCompile(request).ok).toBe(true)
    expect(cache.getStats()).toEqual({ entries: 1, buildCount: 1, hitCount: 1 })
    expect(cache.getOrCompile({ ...request, revision: 8 }).ok).toBe(true)
    expect(cache.getStats().entries).toBe(1)
    cache.invalidateAsset(assetId)
    expect(cache.getStats().entries).toBe(0)
  })
})
