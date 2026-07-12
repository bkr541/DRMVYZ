import { describe, expect, it, vi } from 'vitest'
import { BoundedLruCache } from './boundedLru'
import { BoundedObjectUrlCache } from './mediaAssetCache'

describe('bounded media caches', () => {
  it('evicts the least-recently-used entry and updates recency on access', () => {
    const evicted: string[] = []
    const cache = new BoundedLruCache<string, string>({ maxEntries: 2, onEvict: value => evicted.push(value) })
    cache.set('a', 'A')
    cache.set('b', 'B')
    expect(cache.get('a')).toBe('A')
    cache.set('c', 'C')
    expect(cache.keys()).toEqual(['a', 'c'])
    expect(evicted).toEqual(['B'])
  })

  it('revokes object URLs on eviction, prefix purge, and clear', () => {
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { revokeObjectURL })
    const cache = new BoundedObjectUrlCache(2)
    cache.set('user-1/media-1/original', 'blob:one')
    cache.set('user-1/media-1/thumb', 'blob:two')
    cache.get('user-1/media-1/original')
    cache.set('user-1/media-2/original', 'blob:three')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:two')
    expect(cache.purgePrefix('user-1/media-1')).toBe(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:one')
    cache.clear()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:three')
    vi.unstubAllGlobals()
  })

  it('keeps original and derivative variants distinct under one stable media prefix', () => {
    const cache = new BoundedObjectUrlCache(4)
    cache.set('user-1/media-1/original', 'https://signed/original')
    cache.set('user-1/media-1/thumbnail', 'https://signed/thumb')
    expect(cache.size).toBe(2)
    expect(cache.purgePrefix('user-1/media-1/')).toBe(2)
    expect(cache.size).toBe(0)
  })
})
