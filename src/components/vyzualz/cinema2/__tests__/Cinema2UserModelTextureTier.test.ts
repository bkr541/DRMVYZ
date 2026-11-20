import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { CINEMA2_USER_MODEL_TEXTURE_BYTES, CINEMA2_USER_MODEL_TEXTURE_SIDE, Cinema2UserModelTextureTier, textureBytes } from '../modules/three/Cinema2UserModelTextureTier'

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
  it('limits the longest side to 1024 on low, 2048 on medium and 4096 on high, and gives each tier a memory allowance', () => {
    expect(CINEMA2_USER_MODEL_TEXTURE_SIDE).toEqual({ low: 1024, medium: 2048, high: 4096 })
    expect(CINEMA2_USER_MODEL_TEXTURE_BYTES.low).toBeLessThan(CINEMA2_USER_MODEL_TEXTURE_BYTES.medium); expect(CINEMA2_USER_MODEL_TEXTURE_BYTES.medium).toBeLessThan(CINEMA2_USER_MODEL_TEXTURE_BYTES.high)
  })

  it('swaps a smaller copy into the material on low, keeping the texture settings, and steps down to what the memory allowance permits on high', () => {
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
    // Two 4096 px maps (about 180 MB) do not fit the high allowance, so they step down to 2048; a pair that fits comes back as saved.
    expect(tier.apply([material], 'high')).toBe(0)
    expect(material.map!.image).toMatchObject({ width: 2048, height: 2048 })
    const fits = new THREE.MeshStandardMaterial({ map: texture(2048) }), fitsOriginal = fits.map
    expect(tier.apply([fits], 'high')).toBe(0); expect(fits.map).toBe(fitsOriginal)
    expect(tier.apply([material], 'low')).toBe(2); expect(material.map!.image).toMatchObject({ width: 1024, height: 1024 })
  })

  it('fits the user\'s real models: 391 MB and 257 MB of textures end up inside every tier\'s allowance, shrinking only the biggest maps', () => {
    const maps = (sizes: [number, number][]) => sizes.map(([w, h]) => new THREE.Texture({ width: w, height: h } as unknown as HTMLImageElement))
    const diamond = maps([[4096, 4096], [4096, 4096], [4096, 4096], [4096, 4096], [3072, 1024], [3072, 1024], [3072, 1024]])
    const pure = maps([[4096, 4096], [4096, 4096], [4096, 4096]])
    expect(textureBytes(diamond) / 1048576).toBeGreaterThan(380); expect(textureBytes(pure) / 1048576).toBeGreaterThan(250)
    const { factory } = fakeCanvasFactory(), tier = new Cinema2UserModelTextureTier(THREE, factory)
    for (const set of [diamond, pure]) {
      const materials = set.map(map => new THREE.MeshStandardMaterial({ map }))
      for (const quality of ['high', 'medium', 'low'] as const) {
        const caps = tier.fit(materials, quality)
        for (const texture of set) expect(caps.get(texture)).toBeLessThanOrEqual(CINEMA2_USER_MODEL_TEXTURE_SIDE[quality])
        expect(textureBytes(set, caps)).toBeLessThanOrEqual(CINEMA2_USER_MODEL_TEXTURE_BYTES[quality])
      }
    }
    // On high the four 90 MB maps drop to 2048 at most, and the smaller wide maps keep their full size while memory allows; nothing falls below 1024.
    const caps = tier.fit(diamond.map(map => new THREE.MeshStandardMaterial({ map })), 'high')
    for (const map of diamond.slice(0, 4)) expect(caps.get(map)).toBeLessThanOrEqual(2048)
    expect(Math.min(...diamond.map(map => caps.get(map)!))).toBeGreaterThanOrEqual(1024)
    expect(textureBytes(diamond, caps) / 1048576).toBeGreaterThan(60)
  })

  it('never steps a small model down: textures that already fit keep the tier\'s full side', () => {
    const { factory } = fakeCanvasFactory(), tier = new Cinema2UserModelTextureTier(THREE, factory)
    const chamber = new THREE.Texture({ width: 512, height: 512 } as unknown as HTMLImageElement), materials = [new THREE.MeshStandardMaterial({ map: chamber })]
    for (const quality of ['low', 'medium', 'high'] as const) expect(tier.fit(materials, quality).get(chamber)).toBe(512)
    const big = new THREE.Texture({ width: 2048, height: 2048 } as unknown as HTMLImageElement)
    expect(tier.fit([new THREE.MeshStandardMaterial({ map: big })], 'high').get(big)).toBe(2048)
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
