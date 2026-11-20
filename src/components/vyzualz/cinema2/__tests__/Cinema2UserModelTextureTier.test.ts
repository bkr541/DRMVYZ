import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CINEMA2_USER_MODEL_TEXTURE_SIDE, Cinema2UserModelTextureTier } from '../modules/three/Cinema2UserModelTextureTier'

/** A canvas stand-in that records what was drawn, since the test environment has no 2D canvas. */
function fakeCanvasFactory() {
  const created: { width: number; height: number; draws: number }[] = []
  const factory = (width: number, height: number) => {
    const record = { width, height, draws: 0 }; created.push(record)
    return { width, height, getContext: () => ({ imageSmoothingEnabled: false, imageSmoothingQuality: 'low', drawImage: () => { record.draws++ } }) } as unknown as HTMLCanvasElement
  }
  return { factory, created }
}
const texture = (side: number, colorSpace: string = THREE.SRGBColorSpace) => {
  const t = new THREE.Texture({ width: side, height: side } as unknown as HTMLImageElement); t.colorSpace = colorSpace as never; t.repeat.set(2, 3); t.flipY = false; return t
}

describe('user model texture tiers', () => {
  it('caps the longest side at 1024 on low, 2048 on medium, and leaves high as saved', () => {
    expect(CINEMA2_USER_MODEL_TEXTURE_SIDE.low).toBe(1024); expect(CINEMA2_USER_MODEL_TEXTURE_SIDE.medium).toBe(2048); expect(CINEMA2_USER_MODEL_TEXTURE_SIDE.high).toBe(Infinity)
  })

  it('swaps a smaller copy into the material on low, keeping the texture settings, and restores the original on high', () => {
    const { factory, created } = fakeCanvasFactory(), tier = new Cinema2UserModelTextureTier(THREE, factory)
    const original = texture(4096), data = texture(4096, THREE.LinearSRGBColorSpace), material = new THREE.MeshStandardMaterial({ map: original, roughnessMap: data })
    expect(tier.apply([material], 'low')).toBe(2)
    const small = material.map!, image = small.image as { width: number; height: number }
    expect(small).not.toBe(original); expect(image).toMatchObject({ width: 1024, height: 1024 })
    expect(small.colorSpace).toBe(THREE.SRGBColorSpace); expect(material.roughnessMap!.colorSpace).toBe(THREE.LinearSRGBColorSpace)
    expect(small.repeat.toArray()).toEqual([2, 3]); expect(small.flipY).toBe(false)
    // The shared decoded texture is never touched.
    expect(original.image).toMatchObject({ width: 4096, height: 4096 })
    // 4096 to 1024 is halved step by step (2048, then 1024) rather than in one jump.
    expect(created.filter(c => c.width === 2048).length).toBeGreaterThan(0)
    expect(tier.apply([material], 'medium')).toBe(2)
    expect(material.map!.image).toMatchObject({ width: 2048, height: 2048 })
    expect(tier.apply([material], 'high')).toBe(2)
    expect(material.map).toBe(original); expect(material.roughnessMap).toBe(data)
  })

  it('leaves textures already within the cap alone, and makes one copy per texture and size even when materials share it', () => {
    const { factory, created } = fakeCanvasFactory(), tier = new Cinema2UserModelTextureTier(THREE, factory)
    const small = texture(512), shared = texture(4096)
    const a = new THREE.MeshStandardMaterial({ map: small }), b = new THREE.MeshStandardMaterial({ map: shared }), c = new THREE.MeshStandardMaterial({ map: shared })
    tier.apply([a, b, c], 'low')
    expect(a.map).toBe(small); expect(b.map).toBe(c.map)
    const drawsAfterFirst = created.length
    tier.apply([a, b, c], 'low')
    expect(created.length).toBe(drawsAfterFirst)
  })

  it('keeps the aspect ratio of a non-square texture', () => {
    const { factory } = fakeCanvasFactory(), tier = new Cinema2UserModelTextureTier(THREE, factory)
    const wide = new THREE.Texture({ width: 4096, height: 1024 } as unknown as HTMLImageElement), material = new THREE.MeshStandardMaterial({ map: wide })
    tier.apply([material], 'low')
    expect(material.map!.image).toMatchObject({ width: 1024, height: 256 })
  })

  it('disposes its copies on release and never the originals', () => {
    const { factory } = fakeCanvasFactory(), tier = new Cinema2UserModelTextureTier(THREE, factory)
    const original = texture(4096), material = new THREE.MeshStandardMaterial({ map: original })
    const originalDispose = vi.spyOn(original, 'dispose'); tier.apply([material], 'low')
    const copyDispose = vi.spyOn(material.map!, 'dispose'); tier.release()
    expect(copyDispose).toHaveBeenCalledTimes(1); expect(originalDispose).not.toHaveBeenCalled()
  })
})
