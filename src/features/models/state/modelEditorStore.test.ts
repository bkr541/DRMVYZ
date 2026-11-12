import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Group } from 'three'
const mocks = vi.hoisted(() => ({ media: {} as Record<string, unknown>, prepare: vi.fn(), generate: vi.fn(), getVersion: vi.fn(), load: vi.fn(), fromTrace: vi.fn(), organization: vi.fn(), versions: vi.fn(), inspect: vi.fn(), download: vi.fn(), draft: vi.fn(), save: vi.fn(), metadata: vi.fn(), verify: vi.fn(), capture: vi.fn(), cancel: vi.fn(), remove: vi.fn(), get: vi.fn() }))
vi.mock('../../../stores/mediaStore', () => ({ useMediaStore: { getState: () => mocks.media } }))
vi.mock('../generator/createModelArtifact', () => ({ createDefaultModelRecipe: () => structuredClone(recipe), createModelArtifact: mocks.generate, createModelArtifactFromTrace: mocks.fromTrace }))
vi.mock('../trace/imageInput', () => ({ prepareModelInput: mocks.prepare }))
vi.mock('../data/modelAssetRepository', async importOriginal => ({ ...await importOriginal<typeof import('../data/modelAssetRepository')>(), modelAssetRepository: { getVersion: mocks.getVersion, getOrganization: mocks.organization, listVersions: mocks.versions, createDraft: mocks.draft, saveVersion: mocks.save, updateMetadata: mocks.metadata, cancelSave: mocks.cancel, delete: mocks.remove, get: mocks.get } }))
vi.mock('../data/modelEditorArtifacts', () => ({ inspectModelSource: mocks.inspect, downloadModelArtifact: mocks.download, verifyPublishedModel: mocks.verify }))
vi.mock('./modelViewportBridge', () => ({ captureModelPreview: mocks.capture }))
vi.mock('../data/loadModelPreview', () => ({ loadModelPreview: mocks.load }))
import { useModelEditorStore, selectModelEditorNeedsGuard, selectModelCanSave } from './modelEditorStore'
import { recipe, stats, MODEL_ID, USER_A } from '../__tests__/modelAssetFixtures'
import type { UploadedMedia } from '../../../stores/mediaStore'
const source = new Blob(['source'], { type: 'image/png' })
const media = { id: MODEL_ID, dbId: MODEL_ID, type: 'image', name: 'Logo.png', url: 'https://example.invalid/original.png', thumbnailUrl: 'https://example.invalid/thumbnail.png' } as UploadedMedia
const savedAsset = (version = 1) => ({ id: MODEL_ID, userId: USER_A, name: 'Saved logo', description: null, favorite: false, sourceMediaId: MODEL_ID, status: 'ready' as const, currentVersion: version, createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z' })
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
const artifact = () => ({ group: new Group(), stats, dispose: vi.fn(), recipe: structuredClone(recipe), sourceSnapshot: source, traceSvg: '<svg/>', glb: new Blob(['glb']), materialCount: 1, dimensions: [2, 2, 2] as [number, number, number], files: { source: { data: source, contentType: 'image/png' as const }, glb: { data: new Blob(['glb']), contentType: 'model/gltf-binary' as const }, trace: { data: new Blob(['<svg/>']), contentType: 'image/svg+xml' as const } }, warnings: [] })
beforeEach(() => {
  vi.resetAllMocks(); useModelEditorStore.getState().reset()
  mocks.media = { items: [media], ensureMediaSigned: vi.fn().mockResolvedValue(undefined), retryMediaAsset: vi.fn().mockResolvedValue(true) }
  mocks.prepare.mockResolvedValue({ foregroundPreview: source, sourceSnapshot: source, recipe: structuredClone(recipe), requiresForegroundConfirmation: false, warnings: [] })
  mocks.generate.mockImplementation(async input => ({ ...artifact(), recipe: input.recipe }))
  mocks.fromTrace.mockImplementation(async (_source, _trace, next) => ({ ...artifact(), recipe: next }))
  mocks.inspect.mockResolvedValue({ width: 32, height: 32, mimeType: 'image/png', byteSize: 6 })
  mocks.organization.mockResolvedValue({ tags: [], collectionIds: [] }); mocks.versions.mockResolvedValue([])
  mocks.download.mockRejectedValue(new Error('Missing source'))
  mocks.capture.mockResolvedValue(new Blob(['PNG'], { type: 'image/png' }))
  mocks.draft.mockResolvedValue(savedAsset(0)); mocks.save.mockImplementation(async input => ({ version: input.expectedVersion + 1, generatorRecipe: input.generatorRecipe, geometryStats: stats }))
  mocks.verify.mockImplementation(async () => artifact())
  mocks.metadata.mockImplementation(async (id, version, meta) => ({ ...savedAsset(version), id, ...meta }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source)))
})
afterEach(() => { useModelEditorStore.getState().reset(); vi.unstubAllGlobals() })

describe('model editor lifecycle', () => {
  it('fetches the original signed bytes and generates using the Phase 02 engine without changing image state', async () => {
    const id = useModelEditorStore.getState().begin(media)
    await flush()
    expect(id).toMatch(/^draft-/)
    expect(fetch).toHaveBeenCalledWith(media.url, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(selectModelEditorNeedsGuard(useModelEditorStore.getState())).toBe(true)
    await useModelEditorStore.getState().generate()
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ source: expect.any(Blob), recipe, foregroundConfirmed: false }))
    expect(useModelEditorStore.getState()).toMatchObject({ status: 'ready', dirty: true, sourceMediaId: MODEL_ID })
    expect(useModelEditorStore.getState().artifact?.files.source.data).toBe(source)
  })
  it('refreshes an expired original URL once and never uses the thumbnail', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValueOnce(new Response(source))
    useModelEditorStore.getState().begin(media); await flush()
    expect(mocks.media.retryMediaAsset).toHaveBeenCalledWith(MODEL_ID, 'original')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('can retry a failed source download without replacing the draft identity', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    const id = useModelEditorStore.getState().begin(media); await flush()
    expect(useModelEditorStore.getState().status).toBe('error')
    await useModelEditorStore.getState().retrySource()
    expect(useModelEditorStore.getState().id).toBe(id)
    expect(useModelEditorStore.getState().source).toBeInstanceOf(Blob)
  })
  it('does not start generation before the source preview has been prepared', async () => {
    mocks.prepare.mockReturnValueOnce(new Promise(() => {}))
    useModelEditorStore.getState().begin(media); await flush()
    await useModelEditorStore.getState().generate()
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('requires foreground confirmation and retains the preview', async () => {
    mocks.prepare.mockResolvedValueOnce({ sourceSnapshot: source, foregroundPreview: source, recipe, requiresForegroundConfirmation: true, warnings: [] })
    useModelEditorStore.getState().begin(media); await flush()
    await useModelEditorStore.getState().generate()
    expect(mocks.generate).not.toHaveBeenCalled()
    useModelEditorStore.getState().confirmForeground(true)
    await useModelEditorStore.getState().generate()
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expect(useModelEditorStore.getState().preview).toBe(source)
  })
  it('disposes a stale async generation after cancellation, and resets resources on discard', async () => {
    let resolve!: (value: ReturnType<typeof artifact>) => void
    mocks.generate.mockReturnValueOnce(new Promise(done => { resolve = done }))
    useModelEditorStore.getState().begin(media); await flush()
    const pending = useModelEditorStore.getState().generate(); await flush()
    useModelEditorStore.getState().cancel()
    const stale = artifact(); resolve(stale); await pending
    expect(stale.dispose).toHaveBeenCalledTimes(1)
    expect(useModelEditorStore.getState().model).toBeNull()
    const kept = artifact(); useModelEditorStore.setState({ model: kept }); useModelEditorStore.getState().reset()
    expect(kept.dispose).toHaveBeenCalledTimes(1)
    expect(selectModelEditorNeedsGuard(useModelEditorStore.getState())).toBe(false)
  })
  it('retains a generated source snapshot if original media disappears', async () => {
    useModelEditorStore.getState().begin(media); await flush()
    await useModelEditorStore.getState().generate(); mocks.media.items = []
    expect(useModelEditorStore.getState().artifact?.sourceSnapshot).toBe(source)
  })
  it('loads saved model identity separately and keeps it clean', async () => {
    const loaded = artifact(); mocks.getVersion.mockResolvedValue({ generatorRecipe: recipe, geometryStats: stats }); mocks.load.mockResolvedValue(loaded)
    const asset = { id: MODEL_ID, userId: USER_A, name: 'Saved logo', currentVersion: 2 } as import('../domain/modelAssetTypes').ModelAsset
    useModelEditorStore.getState().load(asset); await flush()
    expect(mocks.getVersion).toHaveBeenCalledWith(MODEL_ID, 2)
    expect(useModelEditorStore.getState()).toMatchObject({ id: MODEL_ID, asset, model: loaded, dirty: false, status: 'ready' })
  })
})


describe('model save and edit lifecycle', () => {
  async function draft() {
    useModelEditorStore.setState({ id: 'draft-test', name: 'Logo', source, recipe: structuredClone(recipe), preview: source, model: artifact(), artifact: artifact(), dirty: true, status: 'ready' })
  }
  it('publishes all artifacts, verifies the downloaded GLB before clearing dirty, and saves organization', async () => {
    await draft(); let finish!: (value: ReturnType<typeof artifact>) => void
    mocks.verify.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const saving = useModelEditorStore.getState().save(); await flush()
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 0, files: expect.objectContaining({ thumbnail: expect.objectContaining({ contentType: 'image/png' }) }) }))
    expect(useModelEditorStore.getState()).toMatchObject({ dirty: true, status: 'saving' })
    expect(mocks.metadata).not.toHaveBeenCalled()
    finish(artifact()); expect(await saving).toMatchObject({ ok: true, version: 1 })
    expect(useModelEditorStore.getState()).toMatchObject({ dirty: false, id: MODEL_ID, activeVersion: 1 })
  })
  it('retains a failed draft and reuses its target on retry', async () => {
    await draft(); mocks.save.mockRejectedValueOnce(new Error('Storage denied'))
    expect(await useModelEditorStore.getState().save()).toEqual({ ok: false })
    expect(useModelEditorStore.getState()).toMatchObject({ dirty: true, error: 'Storage denied', source, saveFailure: true })
    expect(selectModelCanSave(useModelEditorStore.getState())).toBe(true)
    expect(await useModelEditorStore.getState().save()).toMatchObject({ ok: true })
    expect(mocks.draft).toHaveBeenCalledTimes(1)
  })
  it('retries verification after publication without writing a duplicate version', async () => {
    await draft(); mocks.verify.mockRejectedValueOnce(new Error('Signed URL expired'))
    await useModelEditorStore.getState().save()
    expect(useModelEditorStore.getState().publishedVersion?.version).toBe(1)
    expect(useModelEditorStore.getState().dirty).toBe(true)
    await useModelEditorStore.getState().save()
    expect(mocks.save).toHaveBeenCalledTimes(1); expect(mocks.verify).toHaveBeenCalledTimes(2)
    expect(useModelEditorStore.getState().dirty).toBe(false)
  })
  it('renames without uploading or incrementing the immutable version', async () => {
    await draft(); useModelEditorStore.setState({ asset: savedAsset(), activeVersion: 1, savedRecipe: recipe })
    useModelEditorStore.getState().setMetadata({ name: 'Renamed', tags: ['Logo'] })
    await useModelEditorStore.getState().save()
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.capture).not.toHaveBeenCalled()
    expect(mocks.metadata).toHaveBeenCalledWith(MODEL_ID, 1, expect.objectContaining({ name: 'Renamed', tags: ['Logo'] }))
  })
  it('copies to a distinct identity and preserves the original history', async () => {
    await draft(); useModelEditorStore.setState({ asset: savedAsset(), activeVersion: 1, savedRecipe: recipe })
    const copyId = 'c0000000-0000-4000-8000-000000000009'; mocks.draft.mockResolvedValueOnce({ ...savedAsset(0), id: copyId })
    expect(await useModelEditorStore.getState().save('Logo copy')).toMatchObject({ ok: true, id: copyId, version: 1 })
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ modelAssetId: copyId, expectedVersion: 0 }))
  })
  it('keeps a conflicting draft and can explicitly reload the latest version', async () => {
    await draft(); useModelEditorStore.setState({ asset: savedAsset(), activeVersion: 1 })
    mocks.save.mockRejectedValueOnce(new Error('Model version conflict'))
    await useModelEditorStore.getState().save()
    expect(useModelEditorStore.getState().dirty).toBe(true)
    mocks.get.mockResolvedValue(savedAsset(2)); mocks.getVersion.mockResolvedValue({ generatorRecipe: recipe, geometryStats: stats }); mocks.load.mockResolvedValue(artifact())
    await useModelEditorStore.getState().reloadLatest(); await flush()
    expect(useModelEditorStore.getState()).toMatchObject({ activeVersion: 2, dirty: false })
  })
  it('debounces geometry edits, reuses the trace, and does not regenerate preview-only lighting', async () => {
    vi.useFakeTimers()
    try {
      await draft(); const original = useModelEditorStore.getState().artifact!
      useModelEditorStore.getState().setRecipe({ geometry: { ...recipe.geometry, depth: 2 } })
      useModelEditorStore.getState().setRecipe({ geometry: { ...recipe.geometry, depth: 3 } })
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(mocks.fromTrace).toHaveBeenCalledTimes(1)
      expect(mocks.fromTrace).toHaveBeenCalledWith(source, original.traceSvg, expect.objectContaining({ geometry: expect.objectContaining({ depth: 3 }) }), expect.any(AbortSignal))
      const next = useModelEditorStore.getState().recipe!
      useModelEditorStore.getState().setRecipe({ preview: { ...next.preview, lightIntensity: 2 } })
      await vi.advanceTimersByTimeAsync(301)
      expect(mocks.fromTrace).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })
  it('prepares the latest raster foreground when a trace change is followed by a geometry change during debounce', async () => {
    vi.useFakeTimers()
    try {
      await draft()
      mocks.prepare.mockImplementation(async (_source, next) => ({ sourceSnapshot: source, foregroundPreview: source, recipe: next, requiresForegroundConfirmation: false, warnings: [] }))
      useModelEditorStore.getState().setRecipe({ foreground: { ...recipe.foreground, invert: true } })
      useModelEditorStore.getState().setRecipe({ geometry: { ...recipe.geometry, depth: 3 } })
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(mocks.prepare).toHaveBeenCalledWith(source, expect.objectContaining({ foreground: expect.objectContaining({ invert: true }), geometry: expect.objectContaining({ depth: 3 }) }), 'normal', expect.any(AbortSignal))
      expect(useModelEditorStore.getState().generationPending).toBe(false)
    } finally { vi.useRealTimers() }
  })
  it('preserves a readable saved GLB when its source snapshot is missing', async () => {
    mocks.getVersion.mockResolvedValue({ generatorRecipe: recipe, geometryStats: stats }); mocks.load.mockResolvedValue(artifact())
    useModelEditorStore.getState().load(savedAsset()); await flush()
    expect(useModelEditorStore.getState()).toMatchObject({ status: 'ready', dirty: false, source: null })
    expect(useModelEditorStore.getState().warnings[0]).toContain('source snapshot is unavailable')
  })
})
