import { describe, expect, it } from 'vitest'
import { validateCinema2UserGlb } from '../model/Cinema2UserModelResolver'
import { glb } from '../../../../features/models/__tests__/glbFixtures'

/** One triangle, so the geometry checks pass and only the texture/skin/animation rules are under test. */
const base = (extra: Record<string, unknown> = {}) => ({
  asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], materials: [{}],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  accessors: [{ count: 3, componentType: 5126, type: 'VEC3' }, { count: 3, componentType: 5123, type: 'SCALAR' }],
  buffers: [{ byteLength: 64 }], bufferViews: [{ buffer: 0, byteLength: 64 }], ...extra,
})
const png = (side: number) => {
  const bytes = new Uint8Array(33), view = new DataView(bytes.buffer)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); view.setUint32(8, 13); bytes.set([0x49, 0x48, 0x44, 0x52], 12); view.setUint32(16, side); view.setUint32(20, side)
  return bytes
}
const textured = (side: number, extra: Record<string, unknown> = {}) => glb(base({
  images: [{ bufferView: 1, mimeType: 'image/png' }], textures: [{ source: 0 }], bufferViews: [{ buffer: 0, byteLength: 64 }, { buffer: 0, byteOffset: 0, byteLength: 33 }], ...extra,
}), (() => { const b = new Uint8Array(64); b.set(png(side)); return b })())

describe('the Cinema 2.0 private model profile', () => {
  it('accepts a created model\'s surface texture within the texture budget, but refuses animations', () => {
    expect(() => validateCinema2UserGlb(textured(1024))).not.toThrow()
    expect(() => validateCinema2UserGlb(textured(16384))).toThrow(/limit is 8192/)
    expect(() => validateCinema2UserGlb(glb(base({ animations: [{}] })))).toThrow(/without animations/)
    expect(() => validateCinema2UserGlb(glb(base()))).not.toThrow()
  })

  it('accepts embedded textures and animations on an imported model, within the texture budget', () => {
    expect(() => validateCinema2UserGlb(textured(4096), { imported: true })).not.toThrow()
    expect(() => validateCinema2UserGlb(glb(base({ animations: [{}] })), { imported: true })).not.toThrow()
  })

  it('refuses an oversized texture on an imported model before anything is decoded', () => {
    expect(() => validateCinema2UserGlb(textured(16384), { imported: true })).toThrow(/limit is 8192/)
  })

  it('refuses a skeleton for both kinds, with a reason', () => {
    const skinned = glb(base({ skins: [{ joints: [0] }] }))
    expect(() => validateCinema2UserGlb(skinned)).toThrow(/skeleton/)
    expect(() => validateCinema2UserGlb(skinned, { imported: true })).toThrow(/skeleton/)
  })
})
