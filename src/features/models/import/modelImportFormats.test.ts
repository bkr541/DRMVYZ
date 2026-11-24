import { describe, expect, it } from 'vitest'
import { MODEL_FORMATS, isModelBatch, modelImportFormat } from './modelImportFormats'
import { packGltf } from './packGltf'
import { scanGlbContainer } from './glbContainer'
import { validateModelRuntimeGlb } from './validateModelRuntimeGlb'

const signal = () => new AbortController().signal
const document = (uri = 'mesh.bin', count = 3) => ({ asset: { version: '2.0' }, buffers: [{ uri, byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count, type: 'VEC3', min: [0,0,0], max: [1,1,0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 })
const resource = () => new File([new Float32Array([0,0,0,1,0,0,0,1,0])], 'mesh.bin')

describe('Phase 05 local model interchange', () => {
  it.each(MODEL_FORMATS)('routes %s files to the model workflow', format => {
    const file = new File(['x'], `fixture.${format.toUpperCase()}`)
    expect(modelImportFormat(file)).toBe(format); expect(isModelBatch([file])).toBe(true)
  })
  it('rejects unknown formats and standalone resources, and accepts one glTF with companions', () => {
    const gltf = new File(['{}'], 'model.gltf'), image = new File(['x'], 'image.png')
    expect(modelImportFormat(new File(['x'], 'model.exe'))).toBeNull()
    expect(isModelBatch([image])).toBe(false); expect(isModelBatch([gltf, resource(), image])).toBe(true)
    expect(isModelBatch([gltf, gltf, resource()])).toBe(false)
  })
  it('embeds a local buffer and retains the original scene and geometry metadata', async () => {
    const bytes = await packGltf(JSON.stringify(document('geometry/mesh.bin')), [resource()], signal())
    const glb = scanGlbContainer(bytes)
    expect(glb.json.buffers).toEqual([{ byteLength: 36 }]); expect(glb.json.meshes).toEqual(document().meshes)
    expect(() => validateModelRuntimeGlb(bytes, { imported: true })).not.toThrow()
  })
  it.each(['https://example.invalid/mesh.bin', '../mesh.bin', '%2e%2e/mesh.bin', '//server/mesh.bin'])('rejects unsafe resource %s', async uri => {
    await expect(packGltf(JSON.stringify(document(uri)), [resource()], signal())).rejects.toThrow(/Unsafe or external/)
  })
  it('reports missing files, malformed documents, length mismatches, and duplicate companions', async () => {
    await expect(packGltf(JSON.stringify(document()), [], signal())).rejects.toThrow(/Missing glTF resource/)
    await expect(packGltf('{', [], signal())).rejects.toThrow()
    await expect(packGltf(JSON.stringify(document()), [new File(['x'], 'mesh.bin')], signal())).rejects.toThrow(/length/)
    await expect(packGltf(JSON.stringify(document()), [resource(), resource()], signal())).rejects.toThrow(/Duplicate/)
    const textured = { ...document(), images: [{ uri: 'missing.png' }] }
    await expect(packGltf(JSON.stringify(textured), [resource()], signal())).rejects.toThrow(/missing.png/)
  })
  it('rejects oversized triangle declarations and rigs in the shared runtime profile', async () => {
    const oversized = await packGltf(JSON.stringify(document('mesh.bin', 900000)), [resource()], signal())
    expect(() => validateModelRuntimeGlb(oversized, { imported: true })).toThrow(/triangle budget/)
    const rig = await packGltf(JSON.stringify({ ...document(), skins: [{ joints: [0] }] }), [resource()], signal())
    expect(() => validateModelRuntimeGlb(rig, { imported: true })).toThrow(/skeleton/)
  })
  it('rejects an aborted import before reading resources', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(packGltf(JSON.stringify(document()), [resource()], controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
