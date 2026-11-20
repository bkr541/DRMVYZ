import { describe, expect, it } from 'vitest'
import { glb } from '../__tests__/glbFixtures'
import { assertImageBudget, isGlbFile, MODEL_IMPORT_LIMITS, readImageSize, scanGlbContainer } from './glbContainer'

const png = (width: number, height: number) => {
  const bytes = new Uint8Array(33); const view = new DataView(bytes.buffer)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); view.setUint32(8, 13); bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width); view.setUint32(20, height)
  return bytes
}
const jpeg = (width: number, height: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x01, 0x01, 0x11, 0x00])

describe('GLB container scan', () => {
  it('recognises GLB files by extension or MIME type', () => {
    expect(isGlbFile({ name: 'Diamond.GLB', type: '' })).toBe(true)
    expect(isGlbFile({ name: 'diamond.bin', type: 'model/gltf-binary' })).toBe(true)
    expect(isGlbFile({ name: 'diamond.gltf', type: 'model/gltf+json' })).toBe(false)
    expect(isGlbFile({ name: 'logo.png', type: 'image/png' })).toBe(false)
  })

  it('reads PNG and JPEG sizes from their headers', () => {
    expect(readImageSize(png(4096, 2048))).toEqual({ width: 4096, height: 2048 })
    expect(readImageSize(jpeg(3000, 1500))).toEqual({ width: 3000, height: 1500 })
    expect(readImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })

  it('reports the size of images stored in the binary chunk', () => {
    const a = png(4096, 4096), b = jpeg(2048, 1024)
    const binary = new Uint8Array(a.length + b.length); binary.set(a); binary.set(b, a.length)
    const container = scanGlbContainer(glb({ asset: { version: '2.0' }, images: [{ bufferView: 0, mimeType: 'image/png' }, { bufferView: 1, mimeType: 'image/jpeg' }, { uri: 'data:image/png;base64,AAAA' }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: a.length }, { buffer: 0, byteOffset: a.length, byteLength: b.length }] }, binary))
    expect(container.images).toEqual([{ mimeType: 'image/png', width: 4096, height: 4096 }, { mimeType: 'image/jpeg', width: 2048, height: 1024 }, { mimeType: null, width: null, height: null }])
    expect(assertImageBudget(container.images)).toEqual({ maxSide: 4096, bytes: 4096 * 4096 * 4 + 2048 * 1024 * 4 })
  })

  it('rejects files that are not complete self-contained GLB 2.0', () => {
    expect(() => scanGlbContainer(new ArrayBuffer(8))).toThrow(/too small/)
    expect(() => scanGlbContainer(new Uint8Array(40).buffer)).toThrow(/not a binary glTF/)
    const wrongVersion = glb({ asset: { version: '2.0' } }); new DataView(wrongVersion).setUint32(4, 1, true)
    expect(() => scanGlbContainer(wrongVersion)).toThrow(/version 2/)
    const truncated = glb({ asset: { version: '2.0' } }); expect(() => scanGlbContainer(truncated.slice(0, truncated.byteLength - 4))).toThrow(/truncated/)
    expect(() => scanGlbContainer(glb({ buffers: [{ uri: 'model.bin', byteLength: 4 }] }))).toThrow(/external files/)
    expect(() => scanGlbContainer(glb({ images: [{ uri: 'diamond.png' }] }))).toThrow(/external files/)
  })

  it('names the compression a GLB needs that the viewer cannot decode', () => {
    expect(() => scanGlbContainer(glb({ extensionsRequired: ['KHR_draco_mesh_compression'] }))).toThrow(/Draco/)
    expect(() => scanGlbContainer(glb({ extensionsUsed: ['EXT_meshopt_compression'] }))).toThrow(/Meshopt/)
    expect(() => scanGlbContainer(glb({ extensionsUsed: ['KHR_texture_basisu'] }))).toThrow(/KTX2/)
    expect(() => scanGlbContainer(glb({ extensionsUsed: ['KHR_materials_clearcoat'] }))).not.toThrow()
  })

  it('refuses an oversized texture before anything is decoded', () => {
    expect(() => assertImageBudget([{ mimeType: 'image/png', width: 16384, height: 16384 }])).toThrow(/limit is 8192/)
    const each = MODEL_IMPORT_LIMITS.imageBytes / (8192 * 8192 * 4)
    expect(() => assertImageBudget(Array.from({ length: Math.floor(each) + 1 }, () => ({ mimeType: null, width: 8192, height: 8192 })))).toThrow(/MiB of memory/)
    // 4K textures, several of them, are fine; unknown sizes are left for the post-decode check.
    expect(() => assertImageBudget([...Array.from({ length: 4 }, () => ({ mimeType: 'image/png', width: 4096, height: 4096 })), { mimeType: 'image/webp', width: null, height: null }])).not.toThrow()
  })
})
