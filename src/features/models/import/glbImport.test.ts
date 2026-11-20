// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { glb } from './glbContainer.test'
import type { ModelAssetRepository } from '../data/modelAssetRepository'
import type { ModelAsset } from '../domain/modelAssetTypes'

const mocks = vi.hoisted(() => ({ decode: vi.fn(), thumbnail: vi.fn(), disposed: vi.fn() }))
vi.mock('../data/loadModelPreview', () => ({ decodeModelPreview: mocks.decode }))
vi.mock('../export/renderModelThumbnail', () => ({ renderModelThumbnail: mocks.thumbnail }))
vi.mock('../data/modelAssetRepository', () => ({ modelAssetRepository: {} }))

import { importGlbModel, inspectGlbFile } from './glbImport'

const stats = { triangles: 14760, vertices: 7396, meshes: 9, bounds: { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] } }
function decoded(imageSide = 4096, animations = 0) {
  const group = new Group()
  const map = new Texture(); (map as unknown as { image: object }).image = { width: imageSide, height: imageSide }
  group.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map })), new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
  return { group, stats, animations, dispose: mocks.disposed }
}
const file = (name = 'DVYDRM_Pure_Diamond_3D.glb', json: Record<string, unknown> = { asset: { version: '2.0' } }) => new File([glb(json)], name, { type: 'model/gltf-binary' })
const signal = () => new AbortController().signal

beforeEach(() => {
  vi.clearAllMocks()
  mocks.decode.mockImplementation(async () => decoded())
  mocks.thumbnail.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
})

describe('inspecting a local GLB', () => {
  it('measures a valid GLB, draws its thumbnail and always releases the decoded model', async () => {
    const inspection = await inspectGlbFile(file(), signal())
    expect(inspection.fileName).toBe('DVYDRM_Pure_Diamond_3D.glb')
    expect(inspection.stats).toMatchObject({ triangles: 14760, vertices: 7396, meshes: 9, materialCount: 2, glbBytes: inspection.bytes.byteLength,
      imported: { fileName: 'DVYDRM_Pure_Diamond_3D.glb', imageCount: 0, maxImageSide: 4096 } })
    expect(inspection.thumbnail?.type).toBe('image/png'); expect(inspection.warnings).toEqual([])
    expect(mocks.disposed).toHaveBeenCalledTimes(1)
  })

  it('keeps the model when no thumbnail can be drawn, and says so', async () => {
    mocks.thumbnail.mockRejectedValue(new Error('WebGL is unavailable'))
    const inspection = await inspectGlbFile(file(), signal())
    expect(inspection.thumbnail).toBeNull(); expect(inspection.warnings[0]).toMatch(/thumbnail/)
    expect(mocks.disposed).toHaveBeenCalledTimes(1)
  })

  it('warns that animations are kept but not played', async () => {
    mocks.decode.mockImplementation(async () => decoded(1024, 2))
    expect((await inspectGlbFile(file(), signal())).warnings.join(' ')).toMatch(/animations/)
  })

  it('refuses the wrong type, an empty file and an oversized file before reading it', async () => {
    await expect(inspectGlbFile(new File(['x'], 'logo.png', { type: 'image/png' }), signal())).rejects.toThrow(/Only \.glb/)
    await expect(inspectGlbFile(new File([], 'empty.glb'), signal())).rejects.toThrow(/empty/)
    const big = new File(['x'], 'big.glb'); Object.defineProperty(big, 'size', { value: 65 * 1024 * 1024 })
    await expect(inspectGlbFile(big, signal())).rejects.toThrow(/limit is 64 MB/)
    expect(mocks.decode).not.toHaveBeenCalled()
  })

  it('stops on container problems without decoding anything', async () => {
    await expect(inspectGlbFile(new File([new Uint8Array(64)], 'junk.glb'), signal())).rejects.toThrow(/not a binary glTF/)
    await expect(inspectGlbFile(file('draco.glb', { extensionsUsed: ['KHR_draco_mesh_compression'] }), signal())).rejects.toThrow(/Draco/)
    expect(mocks.decode).not.toHaveBeenCalled()
  })

  it('measures textures the header could not size, and releases the model when they are too large', async () => {
    mocks.decode.mockImplementation(async () => decoded(16384))
    await expect(inspectGlbFile(file(), signal())).rejects.toThrow(/limit is 8192/)
    expect(mocks.disposed).toHaveBeenCalledTimes(1)
  })

  it('releases the model and the thumbnail work when the import is cancelled', async () => {
    const controller = new AbortController()
    mocks.thumbnail.mockImplementation(async () => { controller.abort(); throw new DOMException('Thumbnail cancelled.', 'AbortError') })
    await expect(inspectGlbFile(file(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.disposed).toHaveBeenCalledTimes(1)
  })
})

describe('importing an inspected GLB', () => {
  const inspection = async () => inspectGlbFile(file(), signal())
  const asset = { id: 'c0000000-0000-4000-8000-000000000001', kind: 'imported', name: 'Diamond', currentVersion: 1 } as ModelAsset
  function repository(overrides: Partial<ModelAssetRepository> = {}) {
    return {
      createDraft: vi.fn().mockResolvedValue({ ...asset, currentVersion: 0 }),
      saveVersion: vi.fn().mockResolvedValue({ version: 1 }),
      updateMetadata: vi.fn().mockResolvedValue(asset),
      delete: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as ModelAssetRepository & Record<'createDraft' | 'saveVersion' | 'updateMetadata' | 'delete', ReturnType<typeof vi.fn>>
  }

  it('stores the original bytes as version 1 of an imported model, then applies title, tags and collections', async () => {
    const repo = repository(), checked = await inspection()
    const saved = await importGlbModel(checked, { name: ' Diamond ', description: 'Pure', tags: [' Logo ', 'logo', ''], collectionIds: ['x', 'x'] }, { repository: repo })
    expect(saved).toBe(asset)
    expect(repo.createDraft).toHaveBeenCalledWith({ name: 'Diamond', description: 'Pure', favorite: false, kind: 'imported' })
    const call = repo.saveVersion.mock.calls[0]![0]
    expect(call).toMatchObject({ modelAssetId: asset.id, expectedVersion: 0, generatorRecipe: null, geometryStats: checked.stats })
    expect(call.files.glb).toEqual({ data: checked.bytes, contentType: 'model/gltf-binary' })
    expect(call.files.thumbnail.contentType).toBe('image/png')
    expect(call.files).not.toHaveProperty('source')
    expect(repo.updateMetadata).toHaveBeenCalledWith(asset.id, 1, { name: 'Diamond', description: 'Pure', favorite: false, tags: ['Logo', 'logo'], collectionIds: ['x'] })
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('omits the thumbnail when none was drawn', async () => {
    mocks.thumbnail.mockRejectedValue(new Error('no webgl'))
    const repo = repository(); await importGlbModel(await inspection(), { name: 'Diamond' }, { repository: repo })
    expect(repo.saveVersion.mock.calls[0]![0].files).not.toHaveProperty('thumbnail')
  })

  it('removes the half-made record when the upload fails, and reports the original error', async () => {
    const repo = repository({ saveVersion: vi.fn().mockRejectedValue(new Error('Upload failed')) })
    await expect(importGlbModel(await inspection(), { name: 'Diamond' }, { repository: repo })).rejects.toThrow('Upload failed')
    expect(repo.delete).toHaveBeenCalledWith(asset.id)
  })

  it('removes the record when the metadata step fails, and a failed cleanup does not hide the real error', async () => {
    const repo = repository({ updateMetadata: vi.fn().mockRejectedValue(new Error('Model version conflict')), delete: vi.fn().mockRejectedValue(new Error('offline')) })
    await expect(importGlbModel(await inspection(), { name: 'Diamond' }, { repository: repo })).rejects.toThrow('Model version conflict')
    expect(repo.delete).toHaveBeenCalledTimes(1)
  })

  it('rejects a blank name before creating anything', async () => {
    const repo = repository()
    await expect(importGlbModel(await inspection(), { name: '   ' }, { repository: repo })).rejects.toThrow()
    expect(repo.createDraft).not.toHaveBeenCalled()
  })
})
