import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Group } from 'three'
const mocks = vi.hoisted(() => ({ media: {} as Record<string, unknown>, prepare: vi.fn(), generate: vi.fn(), getVersion: vi.fn(), load: vi.fn(), fromTrace: vi.fn(), organization: vi.fn(), versions: vi.fn(), inspect: vi.fn(), download: vi.fn(), draft: vi.fn(), save: vi.fn(), metadata: vi.fn(), verify: vi.fn(), capture: vi.fn(), cancel: vi.fn(), remove: vi.fn(), get: vi.fn(), exportGlb: vi.fn(), inspectGlb: vi.fn(), importGlb: vi.fn() }))
vi.mock('../../../stores/mediaStore', () => ({ useMediaStore: { getState: () => mocks.media } }))
vi.mock('../generator/createModelArtifact', () => ({ createDefaultModelRecipe: () => structuredClone(recipe), createModelArtifact: mocks.generate, createModelArtifactFromTrace: mocks.fromTrace }))
vi.mock('../trace/imageInput', () => ({ prepareModelInput: mocks.prepare }))
vi.mock('../data/modelAssetRepository', async importOriginal => ({ ...await importOriginal<typeof import('../data/modelAssetRepository')>(), modelAssetRepository: { getVersion: mocks.getVersion, getOrganization: mocks.organization, listVersions: mocks.versions, createDraft: mocks.draft, saveVersion: mocks.save, updateMetadata: mocks.metadata, cancelSave: mocks.cancel, delete: mocks.remove, get: mocks.get } }))
vi.mock('../data/modelEditorArtifacts', () => ({ inspectModelSource: mocks.inspect, downloadModelArtifact: mocks.download, verifyPublishedModel: mocks.verify }))
vi.mock('./modelViewportBridge', () => ({ captureModelPreview: mocks.capture }))
vi.mock('../data/loadModelPreview', () => ({ loadModelPreview: mocks.load }))
vi.mock('../export/exportGlb', () => ({ exportModelGlb: mocks.exportGlb }))
vi.mock('../import/glbImport', () => ({ inspectGlbFile: mocks.inspectGlb, importGlbModel: mocks.importGlb }))
import { useModelEditorStore, selectModelEditorNeedsGuard, selectModelCanSave, selectModelCanSaveAs, selectModelCanRevert } from './modelEditorStore'
import { recipe, stats, MODEL_ID, USER_A } from '../__tests__/modelAssetFixtures'
import type { UploadedMedia } from '../../../stores/mediaStore'
const source = new Blob(['source'], { type: 'image/png' })
const media = { id: MODEL_ID, dbId: MODEL_ID, type: 'image', name: 'Logo.png', url: 'https://example.invalid/original.png', thumbnailUrl: 'https://example.invalid/thumbnail.png' } as UploadedMedia
const savedAsset = (version = 1) => ({ id: MODEL_ID, kind: 'generated' as const, userId: USER_A, name: 'Saved logo', description: null, favorite: false, sourceMediaId: MODEL_ID, status: 'ready' as const, currentVersion: version, createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z' })
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve() }
const artifact = () => ({ components: { fingerprint: 'aaaaaaaaaaaaaaaa', components: [{ id: '1111111111111111', area: 1, relativeArea: 0.9995 }, { id: '2222222222222222', area: 0.0005, relativeArea: 0.0005 }] }, group: new Group(), contourPreview: source, stats, dispose: vi.fn(), recipe: structuredClone(recipe), sourceSnapshot: source, traceSvg: '<svg/>', glb: new Blob(['glb']), materialCount: 1, dimensions: [2, 2, 2] as [number, number, number], files: { source: { data: source, contentType: 'image/png' as const }, glb: { data: new Blob(['glb']), contentType: 'model/gltf-binary' as const }, trace: { data: new Blob(['<svg/>']), contentType: 'image/svg+xml' as const } }, warnings: [] })
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
  it('prepares settings without implicitly generating the first model', async () => {
    vi.useFakeTimers()
    try {
      useModelEditorStore.getState().begin(media); await flush()
      expect(useModelEditorStore.getState().status).toBe('awaiting-generation')
      mocks.prepare.mockImplementation(async (_source, next) => ({ sourceSnapshot: source, foregroundPreview: source, recipe: next, requiresForegroundConfirmation: false, warnings: [] }))
      useModelEditorStore.getState().setRecipe({ trace: { ...recipe.trace, threshold: 0.23 } })
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(useModelEditorStore.getState()).toMatchObject({ status: 'awaiting-generation', generationPending: false, model: null })
      expect(mocks.generate).not.toHaveBeenCalled()
      await useModelEditorStore.getState().generate()
      expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ recipe: expect.objectContaining({ trace: expect.objectContaining({ threshold: 0.23 }) }) }))
    } finally { vi.useRealTimers() }
  })
  it('selects small components and persists cleanup through generation, undo, redo and restore', async () => {
    vi.useFakeTimers()
    try {
      const original = artifact()
      useModelEditorStore.setState({ source, preview: source, recipe: original.recipe, model: original, artifact: original, status: 'ready' })
      const settle = async () => { await vi.advanceTimersByTimeAsync(301); await flush() }
      useModelEditorStore.getState().selectSmallComponents(0.1)
      expect(useModelEditorStore.getState().selectedComponents).toEqual(['2222222222222222'])
      useModelEditorStore.getState().removeSelectedComponents(); await settle()
      expect(useModelEditorStore.getState().artifact?.recipe.cleanup?.excludedComponentIds).toEqual(['2222222222222222'])
      useModelEditorStore.getState().undoCleanup(); await settle()
      expect(useModelEditorStore.getState().recipe?.cleanup).toBeUndefined()
      useModelEditorStore.getState().redoCleanup(); await settle()
      expect(useModelEditorStore.getState().recipe?.cleanup?.excludedComponentIds).toEqual(['2222222222222222'])
      useModelEditorStore.getState().selectComponent('1111111111111111')
      useModelEditorStore.getState().removeSelectedComponents()
      expect(useModelEditorStore.getState().recipe?.cleanup?.excludedComponentIds).toEqual(['2222222222222222'])
      expect(useModelEditorStore.getState().cleanupNotice).toContain('Keep at least one')
      useModelEditorStore.getState().restoreComponents(); await settle()
      expect(useModelEditorStore.getState().artifact?.recipe.cleanup).toBeUndefined()
    } finally { vi.useRealTimers() }
  })
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
      useModelEditorStore.getState().setRecipe({ transform: { ...recipe.transform, rotation: [0, Math.PI / 4, 0] } })
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(mocks.fromTrace).toHaveBeenCalledTimes(1)
      expect(mocks.fromTrace).toHaveBeenCalledWith(source, original.traceSvg, expect.objectContaining({
        geometry: expect.objectContaining({ depth: 3 }), transform: expect.objectContaining({ rotation: [0, Math.PI / 4, 0] }),
      }), expect.any(AbortSignal), expect.any(Function))
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
  it('keeps the current preview and model during threshold edits and automatically rebuilds an already confirmed opaque source', async () => {
    vi.useFakeTimers()
    try {
      await draft()
      const state = useModelEditorStore.getState(), previous = state.artifact!
      const nextPreview = new Blob(['new traced outline'], { type: 'image/svg+xml' })
      useModelEditorStore.setState({ needsConfirmation: true, confirmed: true })
      mocks.prepare.mockImplementation(async (_source, next) => ({ sourceSnapshot: source, foregroundPreview: new Blob(['mask']), recipe: next, requiresForegroundConfirmation: true, warnings: [] }))
      mocks.generate.mockImplementation(async input => ({ ...artifact(), recipe: input.recipe, contourPreview: nextPreview }))
      state.setRecipe({ foreground: { ...recipe.foreground, mode: 'luminance' }, trace: { ...recipe.trace, threshold: 0.12 } })
      expect(useModelEditorStore.getState()).toMatchObject({ preview: source, confirmed: true, generationPending: true })
      expect(useModelEditorStore.getState().artifact).toBe(previous)
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ foregroundConfirmed: true, recipe: expect.objectContaining({ trace: expect.objectContaining({ threshold: 0.12 }) }) }))
      expect(useModelEditorStore.getState()).toMatchObject({ preview: nextPreview, confirmed: true, generationPending: false, status: 'ready' })
      expect(useModelEditorStore.getState().model).toBe(useModelEditorStore.getState().artifact)
    } finally { vi.useRealTimers() }
  })
  it('retains the last model and preview when foreground preparation fails and does not generate from stale input', async () => {
    vi.useFakeTimers()
    try {
      await draft(); const previous = useModelEditorStore.getState().artifact
      mocks.prepare.mockRejectedValueOnce(new Error('Empty foreground'))
      useModelEditorStore.getState().setRecipe({ trace: { ...recipe.trace, threshold: 0.12 } })
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.fromTrace).not.toHaveBeenCalled()
      expect(useModelEditorStore.getState()).toMatchObject({ preview: source, artifact: previous, generationPending: false, status: 'error', error: 'Empty foreground' })
      expect(selectModelCanSave(useModelEditorStore.getState())).toBe(false)
      expect(selectModelCanSaveAs(useModelEditorStore.getState())).toBe(false)
    } finally { vi.useRealTimers() }
  })
  it('does not allow a superseded preparation to start generation for a newer pending edit', async () => {
    vi.useFakeTimers()
    try {
      await draft()
      let finish!: (value: unknown) => void
      mocks.prepare.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      useModelEditorStore.getState().setRecipe({ trace: { ...recipe.trace, threshold: 0.2 } })
      await vi.advanceTimersByTimeAsync(301); await flush()
      useModelEditorStore.getState().setRecipe({ trace: { ...recipe.trace, threshold: 0.12 } })
      finish({ sourceSnapshot: source, foregroundPreview: source, recipe, requiresForegroundConfirmation: false, warnings: [] })
      await flush()
      expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.fromTrace).not.toHaveBeenCalled()
      mocks.prepare.mockImplementation(async (_source, next) => ({ sourceSnapshot: source, foregroundPreview: source, recipe: next, requiresForegroundConfirmation: false, warnings: [] }))
      await vi.advanceTimersByTimeAsync(301); await flush()
      expect(mocks.generate).toHaveBeenCalledTimes(1)
      expect(useModelEditorStore.getState().recipe?.trace.threshold).toBe(0.12)
    } finally { vi.useRealTimers() }
  })
  it('preserves a readable saved GLB when its source snapshot is missing', async () => {
    mocks.getVersion.mockResolvedValue({ generatorRecipe: recipe, geometryStats: stats }); mocks.load.mockResolvedValue(artifact())
    useModelEditorStore.getState().load(savedAsset()); await flush()
    expect(useModelEditorStore.getState()).toMatchObject({ status: 'ready', dirty: false, source: null })
    expect(useModelEditorStore.getState().warnings[0]).toContain('source snapshot is unavailable')
  })
  describe('an imported GLB', () => {
    const imported = () => ({ ...savedAsset(1), kind: 'imported' as const, sourceMediaId: null })
    const importedVersion = { generatorRecipe: null, geometryStats: { ...stats, imported: { fileName: 'Diamond.glb', imageCount: 2, maxImageSide: 4096 } } }
    const open = async () => {
      mocks.getVersion.mockResolvedValue(importedVersion); mocks.load.mockResolvedValue(artifact())
      mocks.versions.mockResolvedValue([{ version: 1, ...importedVersion }])
      useModelEditorStore.getState().load(imported()); await flush()
      // The edit session is created after a lazy module import, which takes longer than a microtask flush.
      await vi.waitFor(() => expect(useModelEditorStore.getState().builtinEdit).not.toBeNull())
    }

    it('opens the saved GLB directly, without looking for a source snapshot or trace or rebuilding the geometry', async () => {
      await open()
      expect(useModelEditorStore.getState()).toMatchObject({ status: 'ready', dirty: false, recipe: null, source: null, artifact: null, warnings: [], error: null })
      expect(useModelEditorStore.getState().model).not.toBeNull()
      expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.fromTrace).not.toHaveBeenCalled()
    })

    it('saves only title, description, tags and collections, as the same immutable version', async () => {
      await open()
      const store = useModelEditorStore.getState()
      expect(selectModelCanSave(useModelEditorStore.getState())).toBe(false)
      store.setMetadata({ name: 'Pure Diamond', description: 'Faceted', tags: ['Logo'], collectionIds: [] })
      expect(selectModelCanSave(useModelEditorStore.getState())).toBe(true)
      expect(await useModelEditorStore.getState().save()).toMatchObject({ ok: true, id: MODEL_ID, version: 1 })
      expect(mocks.metadata).toHaveBeenCalledWith(MODEL_ID, 1, expect.objectContaining({ name: 'Pure Diamond', tags: ['Logo'] }))
      expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled()
      expect(useModelEditorStore.getState()).toMatchObject({ dirty: false, status: 'ready', name: 'Pure Diamond' })
    })

    const inspection = { fileName: 'Diamond.glb', bytes: new ArrayBuffer(16), stats: { ...stats, imported: { fileName: 'Diamond.glb', imageCount: 2, maxImageSide: 4096 } }, thumbnail: new Blob(['png'], { type: 'image/png' }), warnings: [] }
    const edited = async () => {
      await open(); mocks.exportGlb.mockResolvedValue(new Blob(['edited'], { type: 'model/gltf-binary' })); mocks.inspectGlb.mockResolvedValue(inspection)
      useModelEditorStore.getState().editBuiltin({ scale: 1.5, rotation: [0, 45, 0] })
    }

    it('starts an edit session and treats geometry edits as unsaved changes that can be restored', async () => {
      await open()
      expect(useModelEditorStore.getState().builtinEdit?.values).toMatchObject({ scale: 1, rotation: [0, 0, 0] })
      useModelEditorStore.getState().editBuiltin({ scale: 1.5 })
      expect(useModelEditorStore.getState()).toMatchObject({ dirty: true })
      expect(selectModelCanSave(useModelEditorStore.getState())).toBe(true)
      expect(selectModelEditorNeedsGuard(useModelEditorStore.getState())).toBe(true)
      useModelEditorStore.getState().resetBuiltinEdits()
      expect(useModelEditorStore.getState().dirty).toBe(false)
    })

    it('saves edits as the next immutable version: exports, re-checks the exported file, publishes, then reloads it', async () => {
      await edited()
      mocks.save.mockResolvedValue({ version: 2, geometryStats: inspection.stats })
      mocks.metadata.mockImplementation(async (id, version, meta) => ({ ...imported(), currentVersion: version, ...meta }))
      mocks.getVersion.mockResolvedValue(importedVersion)
      expect(await useModelEditorStore.getState().save()).toMatchObject({ ok: true, id: MODEL_ID, version: 2 })
      expect(mocks.exportGlb).toHaveBeenCalledTimes(1)
      expect(mocks.inspectGlb.mock.calls[0]![0]).toMatchObject({ name: 'Diamond.glb' })
      const saved = mocks.save.mock.calls[0]![0]
      expect(saved).toMatchObject({ modelAssetId: MODEL_ID, expectedVersion: 1, generatorRecipe: null, geometryStats: inspection.stats })
      expect(saved.files.glb.data).toBe(inspection.bytes); expect(saved.files.thumbnail.contentType).toBe('image/png')
      expect(mocks.metadata).toHaveBeenCalledWith(MODEL_ID, 2, expect.objectContaining({ name: 'Saved logo' }))
      expect(mocks.draft).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(useModelEditorStore.getState().builtinEdit?.values.scale).toBe(1))
      expect(useModelEditorStore.getState()).toMatchObject({ dirty: false, status: 'ready', activeVersion: 2 })
      expect(useModelEditorStore.getState().builtinEdit?.values.scale).toBe(1)
    })

    it('keeps the edits and does not publish when the exported GLB fails its checks', async () => {
      await edited(); mocks.inspectGlb.mockRejectedValue(new Error('An embedded texture is 16384 × 16384; the limit is 8192 pixels on a side.'))
      expect(await useModelEditorStore.getState().save()).toEqual({ ok: false })
      expect(mocks.save).not.toHaveBeenCalled()
      expect(useModelEditorStore.getState()).toMatchObject({ dirty: true, saveFailure: true, error: expect.stringContaining('limit is 8192') })
      expect(useModelEditorStore.getState().builtinEdit?.values.scale).toBe(1.5)
    })

    it('Save As New Model exports the edits into a separate imported model with the current tags, and leaves the original alone', async () => {
      await edited()
      const copy = { ...imported(), id: 'c0000000-0000-4000-8000-000000000009', name: 'Diamond copy', currentVersion: 1 }
      mocks.importGlb.mockResolvedValue(copy); mocks.getVersion.mockResolvedValue(importedVersion)
      useModelEditorStore.getState().setMetadata({ tags: ['Logo'] })
      expect(await useModelEditorStore.getState().save('Diamond copy')).toMatchObject({ ok: true, id: copy.id, version: 1 })
      expect(mocks.importGlb).toHaveBeenCalledWith(inspection, expect.objectContaining({ name: 'Diamond copy', tags: ['Logo'] }), expect.anything())
      expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.metadata).not.toHaveBeenCalled()
    })

    it('Save As New Model without edits copies the stored original GLB', async () => {
      await open(); mocks.inspectGlb.mockResolvedValue(inspection)
      mocks.download.mockResolvedValue(new Blob(['original'], { type: 'model/gltf-binary' }))
      mocks.importGlb.mockResolvedValue({ ...imported(), id: 'c0000000-0000-4000-8000-000000000009', currentVersion: 1 }); mocks.getVersion.mockResolvedValue(importedVersion)
      expect(await useModelEditorStore.getState().save('Copy')).toMatchObject({ ok: true })
      expect(mocks.exportGlb).not.toHaveBeenCalled(); expect(mocks.download).toHaveBeenCalledWith(MODEL_ID, 1, 'glbPath', expect.anything())
    })

    it('says so when the version saved but the title and tags did not', async () => {
      await edited(); mocks.save.mockResolvedValue({ version: 2, geometryStats: inspection.stats }); mocks.getVersion.mockResolvedValue(importedVersion)
      mocks.metadata.mockRejectedValue(new Error('offline'))
      expect(await useModelEditorStore.getState().save()).toMatchObject({ ok: true, version: 2 })
      await flush()
      expect(useModelEditorStore.getState().warnings.join(' ')).toMatch(/Version 2 was saved, but/)
    })

    it('keeps the edits and offers a retry when the metadata save fails', async () => {
      await open()
      useModelEditorStore.getState().setMetadata({ name: 'Pure Diamond' })
      mocks.metadata.mockRejectedValueOnce(new Error('Model version conflict'))
      expect(await useModelEditorStore.getState().save()).toEqual({ ok: false })
      expect(useModelEditorStore.getState()).toMatchObject({ dirty: true, saveFailure: true, status: 'ready', error: 'Model version conflict' })
      expect(selectModelCanSave(useModelEditorStore.getState())).toBe(true)
    })
  })

})

describe('Save As and Revert availability, and the copy\'s tags and collections', () => {
  it('Revert needs unsaved changes and an idle editor, and a shipped model never has it', () => {
    const state = () => useModelEditorStore.getState()
    expect(selectModelCanRevert(state())).toBe(false)
    useModelEditorStore.setState({ dirty: true })
    expect(selectModelCanRevert(state())).toBe(true)
    useModelEditorStore.setState({ status: 'saving' })
    expect(selectModelCanRevert(state())).toBe(false)
    useModelEditorStore.setState({ status: 'ready', builtinModel: { id: 'b', name: 'B', description: '', url: '', thumbnailUrl: '' } })
    expect(selectModelCanRevert(state())).toBe(false)
  })

  it('Save As needs a ready model (imported) or a prepared one with nothing pending (generated), and never a shipped model', () => {
    const state = () => useModelEditorStore.getState()
    expect(selectModelCanSaveAs(state())).toBe(false)
    useModelEditorStore.setState({ asset: { ...savedAsset(), kind: 'imported' } as never, model: { group: new Group(), stats, dispose: vi.fn() } as never, status: 'ready' })
    expect(selectModelCanSaveAs(state())).toBe(true)
    useModelEditorStore.setState({ status: 'loading-model' })
    expect(selectModelCanSaveAs(state())).toBe(false)
    useModelEditorStore.setState({ asset: savedAsset() as never, status: 'ready', artifact: artifact() as never, source: source as never, recipe: structuredClone(recipe), generationPending: false })
    expect(selectModelCanSaveAs(state())).toBe(true)
    useModelEditorStore.setState({ generationPending: true })
    expect(selectModelCanSaveAs(state())).toBe(false)
    useModelEditorStore.setState({ generationPending: false, builtinModel: { id: 'b', name: 'B', description: '', url: '', thumbnailUrl: '' } })
    expect(selectModelCanSaveAs(state())).toBe(false)
  })

  it('a copy takes the tags and collections chosen for it along with its name', async () => {
    useModelEditorStore.setState({ tags: ['old'], collectionIds: ['c-old'] })
    // Nothing is prepared, so the save itself is refused; the chosen organization and name are what this checks.
    await useModelEditorStore.getState().save('Copy', { tags: ['new', 'tags'], collectionIds: ['c-new'] })
    expect(useModelEditorStore.getState()).toMatchObject({ name: 'Copy', tags: ['new', 'tags'], collectionIds: ['c-new'] })
  })

  it('an ordinary save leaves the organization alone', async () => {
    useModelEditorStore.setState({ tags: ['keep'], collectionIds: ['c-keep'] })
    await useModelEditorStore.getState().save()
    expect(useModelEditorStore.getState()).toMatchObject({ tags: ['keep'], collectionIds: ['c-keep'] })
  })
})
