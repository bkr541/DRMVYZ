import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrandKitAssetWithMedia } from '../BrandKitTypes'
import {
  clearAllBrandAssetRuntime,
  clearBrandAssetRuntimeForUser,
  configureBrandAssetRuntimeForTests,
  getBrandAssetCacheSnapshot,
  resolveBrandAssetRuntime,
} from '../brandAssetRuntime'

function asset(id = 'media-1', storagePath = `user-a/${id}.svg`): BrandKitAssetWithMedia {
  return {
    id: `asset-${id}`, brandKitId: 'kit-1', mediaItemId: id, role: 'primaryLogo', sortOrder: 0,
    isPaletteSource: false, presentation: null, createdAt: '', updatedAt: '',
    media: {
      id, userId: 'user-a', name: `${id}.svg`, storagePath, thumbnailPath: null,
      mimeType: 'image/svg+xml', mediaRole: 'svg', metadata: {},
    },
  }
}

let restoreDependencies: (() => void) | null = null

beforeEach(() => clearAllBrandAssetRuntime())
afterEach(() => {
  restoreDependencies?.()
  restoreDependencies = null
  clearAllBrandAssetRuntime()
})

describe('Brand asset runtime cache', () => {
  it('deduplicates concurrent signed loads and image decode', async () => {
    const sign = vi.fn(async () => ({ url: 'https://signed/one', error: null }))
    const decode = vi.fn(async () => ({ width: 100, height: 50 } as unknown as CanvasImageSource))
    restoreDependencies = configureBrandAssetRuntimeForTests({
      now: () => 1000,
      sign,
      fetchBlob: vi.fn(async () => new Blob(['svg'])),
      decode,
      createObjectUrl: () => 'blob:one',
      revokeObjectUrl: vi.fn(),
    })

    const first = resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    const second = resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    expect(first).toBe(second)
    const [a, b] = await Promise.all([first, second])
    expect(a.status).toBe('ready')
    expect(b.image).toBe(a.image)
    expect(sign).toHaveBeenCalledTimes(1)
    expect(decode).toHaveBeenCalledTimes(1)
  })

  it('refreshes a signed asset near expiry and revokes superseded object URLs', async () => {
    let now = 0
    let generation = 0
    const revokeObjectUrl = vi.fn()
    const sign = vi.fn(async () => ({ url: `https://signed/${++generation}`, error: null }))
    restoreDependencies = configureBrandAssetRuntimeForTests({
      now: () => now,
      sign,
      fetchBlob: vi.fn(async () => new Blob(['svg'])),
      decode: vi.fn(async url => ({ width: 100, height: 50, url } as unknown as CanvasImageSource)),
      createObjectUrl: () => `blob:${generation}`,
      revokeObjectUrl,
    })

    const first = await resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    now = 3_400_001
    const refreshed = await resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    expect(first.status).toBe('ready')
    expect(refreshed.status).toBe('ready')
    expect(refreshed.image).not.toBe(first.image)
    expect(sign).toHaveBeenCalledTimes(2)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:1')
  })

  it('preserves the last decoded mark as stale during a temporary refresh failure', async () => {
    let now = 0
    let shouldFail = false
    restoreDependencies = configureBrandAssetRuntimeForTests({
      now: () => now,
      sign: vi.fn(async () => shouldFail
        ? Promise.reject(new Error('offline'))
        : { url: 'https://signed/one', error: null }),
      fetchBlob: vi.fn(async () => new Blob(['svg'])),
      decode: vi.fn(async () => ({ width: 100, height: 50 } as unknown as CanvasImageSource)),
      createObjectUrl: () => 'blob:one',
      revokeObjectUrl: vi.fn(),
    })

    const ready = await resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    shouldFail = true
    now = 3_400_001
    const stale = await resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    expect(stale.status).toBe('stale')
    expect(stale.image).toBe(ready.image)
    expect(stale.lastError).toContain('offline')
  })

  it('isolates accounts and clears only the requested user cache', async () => {
    restoreDependencies = configureBrandAssetRuntimeForTests({
      now: () => 1,
      sign: vi.fn(async path => ({ url: `https://signed/${path}`, error: null })),
      fetchBlob: vi.fn(async () => new Blob(['svg'])),
      decode: vi.fn(async () => ({ width: 10, height: 10 } as unknown as CanvasImageSource)),
      createObjectUrl: () => `blob:${Math.random()}`,
      revokeObjectUrl: vi.fn(),
    })
    await resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    await resolveBrandAssetRuntime({ userId: 'user-b', asset: asset() })
    expect(getBrandAssetCacheSnapshot()).toHaveLength(2)
    clearBrandAssetRuntimeForUser('user-a')
    expect(getBrandAssetCacheSnapshot().map(entry => entry.userId)).toEqual(['user-b'])
  })

  it('revokes a signed object URL when sign-out clears an in-flight decode', async () => {
    let releaseDecode!: (image: CanvasImageSource) => void
    const decode = vi.fn(() => new Promise<CanvasImageSource>(resolve => { releaseDecode = resolve }))
    const revokeObjectUrl = vi.fn()
    restoreDependencies = configureBrandAssetRuntimeForTests({
      now: () => 1,
      sign: vi.fn(async () => ({ url: 'https://signed/slow', error: null })),
      fetchBlob: vi.fn(async () => new Blob(['svg'])),
      decode, createObjectUrl: () => 'blob:slow', revokeObjectUrl,
    })
    const pending = resolveBrandAssetRuntime({ userId: 'user-a', asset: asset() })
    await Promise.resolve()
    await Promise.resolve()
    clearBrandAssetRuntimeForUser('user-a')
    releaseDecode({ width: 10, height: 10 } as unknown as CanvasImageSource)
    const result = await pending
    expect(result.status).toBe('idle')
    expect(result.image).toBeNull()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:slow')
    expect(getBrandAssetCacheSnapshot()).toHaveLength(0)
  })

  it('returns a stable missing state for deleted media without decoding', async () => {
    const decode = vi.fn()
    restoreDependencies = configureBrandAssetRuntimeForTests({ decode })
    const deleted = { ...asset(), media: null }
    const result = await resolveBrandAssetRuntime({ userId: 'user-a', asset: deleted })
    expect(result).toMatchObject({ status: 'missing', image: null, source: 'none' })
    expect(result.lastError).toContain('missing')
    expect(decode).not.toHaveBeenCalled()
  })

  it('falls back from a failed local object URL to private storage', async () => {
    const decode = vi.fn(async (url: string) => {
      if (url === 'blob:local-broken') throw new Error('decode failed')
      return { width: 100, height: 50 } as unknown as CanvasImageSource
    })
    const sign = vi.fn(async () => ({ url: 'https://signed/fallback', error: null }))
    restoreDependencies = configureBrandAssetRuntimeForTests({
      now: () => 1, sign,
      fetchBlob: vi.fn(async () => new Blob(['svg'])),
      decode, createObjectUrl: () => 'blob:fallback', revokeObjectUrl: vi.fn(),
    })
    const result = await resolveBrandAssetRuntime({
      userId: 'user-a', asset: asset(), localUrl: 'blob:local-broken',
    })
    expect(result).toMatchObject({ status: 'ready', source: 'signed' })
    expect(sign).toHaveBeenCalledTimes(1)
  })
})
