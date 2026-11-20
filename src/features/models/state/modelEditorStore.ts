import type { BuiltinModel } from '../domain/builtinModels'
import { create } from 'zustand'
import type { Group } from 'three'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { modelAssetRepository, parseModelOrganization, type ModelMetadata } from '../data/modelAssetRepository'
import { ModelAssetError, parseModelRecipe, text, type ModelAsset, type ModelAssetVersion, type ModelGeneratorRecipe, type ModelGeometryStats } from '../domain/modelAssetTypes'
import type { ModelArtifact } from '../generator/createModelArtifact'
import { checkAbort, MODEL_INPUT_LIMITS } from '../geometry/modelQualityBudget'
import type { BuiltinModelEditValues, createBuiltinModelEdit } from '../geometry/builtinModelEdits'
import { captureModelPreview } from './modelViewportBridge'
export interface PreviewModel { group: Group; stats: ModelGeometryStats; dispose(): void }
export type ModelSaveOutcome = { ok: true; id: string; version: number } | { ok: false }
interface BuiltinEditSession extends ReturnType<typeof createBuiltinModelEdit> {
  values: BuiltinModelEditValues
  exported: BuiltinModelEditValues | null
}
export interface ModelEditorState extends ModelMetadata {
  builtinModel: BuiltinModel | null
  builtinEdit: BuiltinEditSession | null
  builtinExporting: boolean
  builtinExportError: string | null
  id: string | null; sessionKey: number; sourceMediaId: string | null; asset: ModelAsset | null
  activeVersion: number; versions: ModelAssetVersion[]; libraryRevision: number
  source: Blob | null; sourceInfo: ModelGeometryStats['source'] | null; recipe: ModelGeneratorRecipe | null
  savedRecipe: ModelGeneratorRecipe | null; savedMetadata: ModelMetadata | null
  model: PreviewModel | null; artifact: ModelArtifact | null; preview: Blob | null
  dirty: boolean; generationPending: boolean
  status: 'idle' | 'loading-source' | 'preparing' | 'generating' | 'loading-model' | 'ready' | 'error' | 'saving' | 'deleting'
  saveFailure: boolean
  builtinOrganizationLoading: boolean
  builtinOrganizationError: string | null
  error: string | null; progress: string | null; warnings: string[]; needsConfirmation: boolean; confirmed: boolean
  saveTarget: ModelAsset | null; publishedVersion: ModelAssetVersion | null; pendingOperationId: string | null
  begin(source: UploadedMedia): string
  load(asset: ModelAsset, version?: number): void
  loadBuiltin(model: BuiltinModel): void
  loadBuiltinOrganization(): Promise<void>
  editBuiltin(patch: Partial<BuiltinModelEditValues>): void
  resetBuiltinEdits(): void
  retrySource(): Promise<void>; prepare(): Promise<void>
  setRecipe(patch: Partial<ModelGeneratorRecipe>): void
  setMetadata(patch: Partial<ModelMetadata>): void
  confirmForeground(confirmed: boolean): void
  generate(): Promise<void>; save(asNewName?: string): Promise<ModelSaveOutcome>; deleteModel(): Promise<boolean>
  acceptFavorite(assetId: string, favorite: boolean): void
  revert(): void; reloadLatest(): Promise<void>; moreVersions(): Promise<void>; download(kind: 'glb' | 'png'): Promise<void>
  cancel(): void; reset(): void
}
let controller: AbortController | null = null, revision = 0, sessionSerial = 0
let generationTimer: ReturnType<typeof setTimeout> | null = null
const baseline = () => ({ builtinModel: null, builtinEdit: null, builtinExporting: false, builtinExportError: null, id: null, sessionKey: 0, sourceMediaId: null, name: '', description: null, favorite: false, tags: [], collectionIds: [],
  asset: null, activeVersion: 0, versions: [], source: null, sourceInfo: null, recipe: null, savedRecipe: null, savedMetadata: null, model: null, artifact: null, preview: null,
  dirty: false, generationPending: false, status: 'idle' as const, saveFailure: false, error: null, progress: null, warnings: [], needsConfirmation: false, confirmed: false,
  builtinOrganizationLoading: false, builtinOrganizationError: null,
  saveTarget: null, publishedVersion: null, pendingOperationId: null })
function message(error: unknown) { return error instanceof Error ? error.message : 'The model operation failed.' }
const metadata = (state: ModelMetadata): ModelMetadata => ({ name: state.name, description: state.description, favorite: state.favorite, tags: [...state.tags], collectionIds: [...state.collectionIds] })
const geometryKey = (recipe: ModelGeneratorRecipe) => JSON.stringify({ ...recipe, preview: undefined })
const traceKey = (recipe: ModelGeneratorRecipe) => JSON.stringify([recipe.foreground, recipe.trace, recipe.quality])
const busy = (state: ModelEditorState) => state.status === 'saving' || state.status === 'deleting' || state.builtinExporting
const sameBuiltinEdits = (a: BuiltinModelEditValues, b: BuiltinModelEditValues | null) => a === b || JSON.stringify(a) === JSON.stringify(b)
export const selectBuiltinModelEdited = ({ builtinEdit }: ModelEditorState) => !!builtinEdit && !sameBuiltinEdits(builtinEdit.values, builtinEdit.original)
export const selectBuiltinModelNeedsExport = (state: ModelEditorState) => {
  const edit = state.builtinEdit
  return !!edit && selectBuiltinModelEdited(state) && !sameBuiltinEdits(edit.values, edit.exported)
}
export const selectModelEditorNeedsGuard = (state: ModelEditorState) => state.dirty || busy(state) || selectBuiltinModelNeedsExport(state)
/** Whether Generate 3D Model (or Regenerate) can run now: a prepared preview exists, the foreground is confirmed where that is required, and the model is not busy, published or locked. */
export const selectModelCanGenerate = (state: ModelEditorState) => !(busy(state) || !!state.publishedVersion || !!state.pendingOperationId || !state.source) && !!state.preview && !(state.needsConfirmation && !state.confirmed)
export const selectModelCanSave = (state: ModelEditorState) => state.builtinModel
  ? !!state.savedMetadata && state.dirty && !busy(state) && state.status !== 'loading-model'
  // An imported model is stored as-is, so only its title, description, favorite, tags and collections can change.
  : state.asset?.kind === 'imported'
    ? !!state.name.trim() && state.dirty && !busy(state) && !!state.model && !!state.savedMetadata
  : !!state.name.trim() && state.dirty && !busy(state) && !state.generationPending && !!state.model && !!state.recipe && (state.artifact ? geometryKey(state.artifact.recipe) === geometryKey(state.recipe) : JSON.stringify(state.recipe) === JSON.stringify(state.savedRecipe)) && (!state.needsConfirmation || state.confirmed) && (!state.error || state.saveFailure || !!state.saveTarget || !!state.pendingOperationId || !!state.publishedVersion)
async function originalImage(media: UploadedMedia, signal: AbortSignal): Promise<Blob> {
  if (media.type !== 'image' || media.uploading || media.uploadError || !media.dbId) throw new Error('Select a successfully uploaded image to create a model.')
  await useMediaStore.getState().ensureMediaSigned([media.id], 'visible')
  checkAbort(signal)
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = useMediaStore.getState().items.find(item => item.id === media.id)
    if (!current?.url) throw new Error('The original image is unavailable. Reload the media library.')
    const response = await fetch(current.url, { signal })
    if (response.ok) {
      if (Number(response.headers.get('content-length')) > MODEL_INPUT_LIMITS.bytes) throw new Error('The source exceeds the 16 MiB model input budget.')
      const blob = await response.blob()
      if (blob.size > MODEL_INPUT_LIMITS.bytes) throw new Error('The source exceeds the 16 MiB model input budget.')
      return blob
    }
    if (attempt || ![401, 403, 404].includes(response.status) || !await useMediaStore.getState().retryMediaAsset(media.id, 'original')) throw new Error('The original image could not be loaded. Retry or replace the source.')
  }
  throw new Error('The source could not be loaded.')
}
export const useModelEditorStore = create<ModelEditorState>((set, get) => {
  function stopTimer() { if (generationTimer) clearTimeout(generationTimer); generationTimer = null }
  function start() { controller?.abort(); controller = new AbortController(); return { signal: controller.signal, token: ++revision } }
  function current(token: number) { return revision === token }
  function dirty() {
    const s = get()
    const metadataChanged = JSON.stringify(metadata(s)) !== JSON.stringify(s.savedMetadata)
    return s.builtinModel ? metadataChanged : !s.asset?.currentVersion || metadataChanged || JSON.stringify(s.recipe) !== JSON.stringify(s.savedRecipe)
  }
  function disposeCurrent() { const s = get(); s.model?.dispose(); if (s.artifact && s.artifact !== s.model) s.artifact.dispose() }
  async function saveBuiltinOrganization(model: BuiltinModel): Promise<ModelSaveOutcome> {
    const state = get()
    if (!selectModelCanSave(state)) return { ok: false }
    set({ status: 'saving', builtinOrganizationError: null })
    try {
      const organization = await modelAssetRepository.updateBuiltinOrganization(model.id, { tags: state.tags, collectionIds: state.collectionIds })
      if (get().sessionKey !== state.sessionKey) return { ok: false }
      set(s => ({
        ...organization, savedMetadata: metadata({ ...s, ...organization }),
        dirty: false, status: state.status, libraryRevision: s.libraryRevision + 1,
      }))
      return { ok: true, id: model.id, version: 0 }
    } catch (error) {
      if (get().sessionKey === state.sessionKey) set({ status: state.status, builtinOrganizationError: message(error) })
      return { ok: false }
    }
  }
  /** An imported model has one immutable GLB; saving changes only its title, description, favorite, tags and collections. */
  async function saveImportedMetadata(asNewName?: string): Promise<ModelSaveOutcome> {
    const state = get(), asset = state.asset
    if (!asset || asNewName || !selectModelCanSave(state)) return { ok: false }
    const form = { ...metadata(state), name: state.name.trim(), tags: [...new Set(state.tags.map(t => t.trim()))].sort(), collectionIds: [...new Set(state.collectionIds)].sort() }
    try { text(form.name); if (form.description) text(form.description, 4000); parseModelOrganization({ tags: form.tags, collection_ids: form.collectionIds }) } catch (error) { set({ error: message(error) }); return { ok: false } }
    const { token } = start(); set({ status: 'saving', progress: 'Saving model metadata…', saveFailure: false, error: null })
    try {
      const canonical = await modelAssetRepository.updateMetadata(asset.id, asset.currentVersion, form)
      if (!current(token)) return { ok: false }
      set(s => ({ asset: canonical, name: canonical.name, description: canonical.description, favorite: canonical.favorite, tags: form.tags, collectionIds: form.collectionIds,
        savedMetadata: form, dirty: false, status: 'ready', saveFailure: false, error: null, progress: null, libraryRevision: s.libraryRevision + 1 }))
      return { ok: true, id: canonical.id, version: canonical.currentVersion }
    } catch (error) {
      if (current(token)) set({ status: 'ready', dirty: true, saveFailure: true, progress: null, error: message(error) })
      return { ok: false }
    }
  }
  return {
    ...baseline(), libraryRevision: 0,
    reset() { stopTimer(); controller?.abort(); controller = null; revision++; disposeCurrent(); set(baseline()) },
    cancel() {
      controller?.abort(); stopTimer()
      if (get().status === 'saving') return
      revision++; set({ generationPending: false, status: get().model ? 'ready' : 'preparing', error: 'Model operation cancelled.' })
    },
    begin(media) {
      get().reset()
      const id = `draft-${crypto.randomUUID()}`, { signal, token } = start()
      set({ id, sessionKey: ++sessionSerial, sourceMediaId: media.dbId ?? media.id, name: media.title ?? media.name, dirty: true, status: 'loading-source' })
      void (async () => {
        try {
          const [{ createDefaultModelRecipe }, source] = await Promise.all([import('../generator/createModelArtifact'), originalImage(media, signal)])
          if (!current(token)) return
          set({ source, recipe: createDefaultModelRecipe(), status: 'preparing' }); await get().prepare()
        } catch (error) { if (current(token)) set({ status: 'error', error: message(error) }) }
      })()
      return id
    },
    loadBuiltin(builtinModel) {
      get().reset(); const { signal, token } = start()
      set({ builtinModel, id: builtinModel.id, name: builtinModel.name, description: builtinModel.description, sessionKey: ++sessionSerial, status: 'loading-model' })
      void get().loadBuiltinOrganization()
      void (async () => {
        try {
          const [{ loadBuiltinModelPreview }, { createBuiltinModelEdit }] = await Promise.all([
            import('../data/loadModelPreview'), import('../geometry/builtinModelEdits'),
          ])
          const model = await loadBuiltinModelPreview(builtinModel, signal)
          if (!current(token)) { model.dispose(); return }
          const edit = createBuiltinModelEdit(model.group, model.stats)
          set({ model, builtinEdit: { ...edit, values: edit.original, exported: null }, status: 'ready' })
        } catch(error) { if (current(token)) set({ status: 'error', error: message(error) }) }
      })()
    },
    editBuiltin(patch) {
      const state = get(), { model, builtinEdit } = state
      if (!model || !builtinEdit || busy(state)) return
      const values = { ...builtinEdit.values, ...patch }
      if (sameBuiltinEdits(values, builtinEdit.values)) return
      const stats = builtinEdit.apply(values)
      set({ model: { ...model, stats }, builtinEdit: { ...builtinEdit, values }, builtinExportError: null })
    },
    resetBuiltinEdits() {
      const edit = get().builtinEdit
      if (edit) get().editBuiltin(edit.original)
    },
    async loadBuiltinOrganization() {
      const { builtinModel, sessionKey, savedMetadata, builtinOrganizationLoading } = get()
      if (!builtinModel || savedMetadata || builtinOrganizationLoading) return
      set({ builtinOrganizationLoading: true, builtinOrganizationError: null })
      try {
        const organization = await modelAssetRepository.getBuiltinOrganization(builtinModel.id)
        if (get().sessionKey !== sessionKey) return
        set(s => ({ ...organization, savedMetadata: metadata({ ...s, ...organization }), builtinOrganizationLoading: false }))
      } catch (error) {
        if (get().sessionKey === sessionKey) set({ builtinOrganizationLoading: false, builtinOrganizationError: message(error) })
      }
    },
    load(asset, selectedVersion = asset.currentVersion) {
      get().reset(); const { signal, token } = start()
      set({ id: asset.id, sessionKey: ++sessionSerial, asset, ...metadata({ ...asset, tags: [], collectionIds: [] }), activeVersion: selectedVersion, status: 'loading-model' })
      void (async () => {
        let loaded: PreviewModel | null = null
        try {
          if (asset.status === 'deletion_pending') throw new Error('Model deletion cleanup is pending. Retry Delete to finish cleanup.')
          if (!selectedVersion) throw new Error('This draft has no published model. Delete the incomplete draft or create a new model from its source.')
          const [{ loadModelPreview }, version, organization, versions] = await Promise.all([
            import('../data/loadModelPreview'), modelAssetRepository.getVersion(asset.id, selectedVersion), modelAssetRepository.getOrganization(asset.id), modelAssetRepository.listVersions(asset.id),
          ])
          loaded = await loadModelPreview({ ...asset, currentVersion: selectedVersion }, signal)
          if (!current(token)) { loaded.dispose(); return }
          const savedMeta = { name: asset.name, description: asset.description, favorite: asset.favorite, ...organization }
          set({ model: loaded, recipe: version.generatorRecipe, savedRecipe: version.generatorRecipe, ...savedMeta, savedMetadata: savedMeta,
            versions, sourceMediaId: asset.sourceMediaId, confirmed: true, sourceInfo: version.geometryStats.source ?? null, status: 'ready' })
          // An imported model has no source snapshot, trace or recipe to rebuild from: the saved GLB is the model.
          if (!version.generatorRecipe) return
          const { downloadModelArtifact } = await import('../data/modelEditorArtifacts')
          const [sourceResult, traceResult] = await Promise.allSettled([
            downloadModelArtifact(asset.id, selectedVersion, 'sourceSnapshotPath', signal), downloadModelArtifact(asset.id, selectedVersion, 'traceSvgPath', signal),
          ])
          if (!current(token)) return
          if (sourceResult.status === 'rejected') { set({ warnings: ['The source snapshot is unavailable. The saved GLB remains viewable; geometry editing and Save As are unavailable.'] }); return }
          set({ source: sourceResult.value, preview: sourceResult.value })
          if (traceResult.status === 'rejected') { set({ warnings: ['The stored trace is unavailable. Showing the saved GLB; Regenerate can rebuild the trace from the source snapshot.'] }); return }
          const { createModelArtifactFromTrace } = await import('../generator/createModelArtifact')
          const artifact = await createModelArtifactFromTrace(sourceResult.value, await traceResult.value.text(), version.generatorRecipe, signal)
          if (!current(token)) { artifact.dispose(); return }
          loaded.dispose(); loaded = null
          set({ artifact, model: artifact, recipe: artifact.recipe, savedRecipe: artifact.recipe, warnings: artifact.warnings.map(w => w.message), status: 'ready' }); set({ dirty: dirty() })
        } catch (error) { if (!current(token)) { if (loaded !== get().model) loaded?.dispose(); return }; set({ status: get().model ? 'ready' : 'error', error: get().model ? null : message(error), warnings: get().model ? [message(error)] : [] }) }
      })()
    },
    acceptFavorite(assetId, favorite) { if (get().asset?.id !== assetId) return; set(s => ({ favorite, asset: s.asset ? { ...s.asset, favorite } : null, savedMetadata: s.savedMetadata ? { ...s.savedMetadata, favorite } : null })); set({ dirty: dirty() }) },
    setMetadata(patch) {
      const state = get()
      if (busy(state)) return
      if (state.builtinModel) {
        if (!state.savedMetadata) return
        set({ tags: patch.tags ?? state.tags, collectionIds: patch.collectionIds ?? state.collectionIds, builtinOrganizationError: null })
        set({ dirty: dirty() })
      } else {
        set(patch)
        set({ dirty: dirty(), error: null, saveFailure: false })
      }
    },
    setRecipe(patch) {
      const state = get(), recipe = state.recipe
      if (!recipe || busy(state) || state.publishedVersion || state.pendingOperationId) return
      try {
        const next = parseModelRecipe({ ...recipe, ...patch })
        const changedTrace = traceKey(next) !== traceKey(recipe)
        const needsPreparation = changedTrace || !state.preview || (!!state.artifact && traceKey(next) !== traceKey(state.artifact.recipe))
        set({ recipe: next, dirty: true, error: null, saveFailure: false })
        set({ dirty: dirty() })
        if (Object.keys(patch).every(key => key === 'preview')) return
        stopTimer(); controller?.abort(); revision++
        set({ generationPending: true, ...(changedTrace ? { preview: null, confirmed: false } : {}) })
        generationTimer = setTimeout(() => {
          generationTimer = null
          void (async () => { if (needsPreparation) await get().prepare(); if (!get().needsConfirmation || get().confirmed) await get().generate(); else set({ generationPending: false }) })()
        }, 300)
      } catch (error) { set({ error: message(error), dirty: true }) }
    },
    confirmForeground(confirmed) { set({ confirmed }); if (confirmed && get().model) void get().generate() },
    async retrySource() {
      const media = useMediaStore.getState().items.find(item => (item.dbId ?? item.id) === get().sourceMediaId)
      if (!media) { set({ status: 'error', error: 'The source was removed. Choose another uploaded image.' }); return }
      const { signal, token } = start(); set({ status: 'loading-source', error: null })
      try {
        const [{ createDefaultModelRecipe }, source] = await Promise.all([import('../generator/createModelArtifact'), originalImage(media, signal)])
        if (!current(token)) return
        set({ source, recipe: get().recipe ?? createDefaultModelRecipe(), status: 'preparing' }); await get().prepare()
      } catch (error) { if (current(token)) set({ status: 'error', error: message(error) }) }
    },
    async prepare() {
      const { source, recipe } = get(); if (!source || !recipe) return
      const { signal, token } = start(); set({ status: 'preparing', error: null })
      try {
        const { prepareModelInput } = await import('../trace/imageInput')
        const result = await prepareModelInput(source, recipe, recipe.quality ?? 'normal', signal)
        const { inspectModelSource } = await import('../data/modelEditorArtifacts'); const sourceInfo = await inspectModelSource(result.sourceSnapshot)
        if (!current(token)) return
        set({ sourceInfo })
        set({ preview: result.foregroundPreview ?? result.sourceSnapshot, recipe: result.recipe, needsConfirmation: result.requiresForegroundConfirmation,
          warnings: result.warnings.map(w => w.message), status: get().model ? 'ready' : 'preparing' })
      } catch (error) { if (current(token)) set({ status: 'error', error: message(error), preview: null, generationPending: false }) }
    },
    async generate() {
      const { source, recipe, confirmed, needsConfirmation, artifact: previous } = get()
      if (!source || !recipe || !get().preview || busy(get()) || (needsConfirmation && !confirmed)) return
      stopTimer(); const { signal, token } = start(); const requestedKey = geometryKey(recipe)
      set({ status: 'generating', generationPending: true, error: null })
      try {
        const engine = await import('../generator/createModelArtifact')
        const artifact = previous && traceKey(previous.recipe) === traceKey(recipe)
          ? await engine.createModelArtifactFromTrace(previous.sourceSnapshot, previous.traceSvg, recipe, signal)
          : await engine.createModelArtifact({ source, recipe, foregroundConfirmed: confirmed, signal })
        if (!current(token) || !get().recipe || geometryKey(get().recipe!) !== requestedKey) { artifact.dispose(); return }
        const nextRecipe = { ...artifact.recipe, preview: get().recipe!.preview }; artifact.recipe = nextRecipe
        disposeCurrent()
        set({ artifact, model: artifact, recipe: nextRecipe, warnings: artifact.warnings.map(w => w.message), generationPending: false, status: 'ready', error: null })
        set({ dirty: dirty() })
      } catch (error) { if (current(token)) set({ status: 'error', generationPending: false, error: message(error) }) }
    },
    async save(asNewName) {
      if (busy(get())) return { ok: false }
      const { builtinModel } = get()
      if (builtinModel) return asNewName ? { ok: false } : saveBuiltinOrganization(builtinModel)
      stopTimer()
      if (get().asset?.kind === 'imported') return saveImportedMetadata(asNewName)
      if (asNewName) set({ name: asNewName, saveTarget: null, publishedVersion: null, pendingOperationId: null, dirty: true })
      const s = get()
      if (!s.name.trim() || !s.recipe || !s.model || (s.needsConfirmation && !s.confirmed)) { set({ error: 'Prepare a named, confirmed model before saving.' }); return { ok: false } }
      if (s.generationPending || (s.artifact && geometryKey(s.artifact.recipe) !== geometryKey(s.recipe))) {
        await get().generate()
        if (get().generationPending || get().error) return { ok: false }
      }
      try { text(get().name); if (get().description) text(get().description, 4000); parseModelOrganization({ tags: get().tags, collection_ids: get().collectionIds }) } catch (error) { set({ error: message(error) }); return { ok: false } }
      const { signal, token } = start(); set({ status: 'saving', progress: 'Preparing save…', saveFailure: false, error: null })
      try {
        const artifacts = await import('../data/modelEditorArtifacts')
        let target = get().saveTarget ?? (asNewName ? null : get().asset)
        if (!target) {
          const linked = useMediaStore.getState().items.some(item => item.dbId === get().sourceMediaId)
          target = await modelAssetRepository.createDraft({ name: get().name, description: get().description, favorite: get().favorite, sourceMediaId: linked ? get().sourceMediaId : null })
          if (!current(token)) return { ok: false }
          set({ saveTarget: target })
        }
        set({ saveTarget: target })
        let published = get().publishedVersion
        if (get().pendingOperationId && !published) {
          published = await modelAssetRepository.cancelSave(get().pendingOperationId!)
          if (published) target = { ...target, currentVersion: published.version, status: 'ready' }
          set({ pendingOperationId: null, publishedVersion: published, saveTarget: target })
        }
        const state = get(), recipe = parseModelRecipe(state.recipe), form = { ...metadata(state), name: state.name.trim(), tags: [...new Set(state.tags.map(t => t.trim()))].sort(), collectionIds: [...new Set(state.collectionIds)].sort() }
        const metadataOnly = !asNewName && target.id === state.asset?.id && !published && state.savedRecipe && JSON.stringify(recipe) === JSON.stringify(state.savedRecipe)
        if (!published && !metadataOnly) {
          const artifact = state.artifact
          if (!artifact || !state.source) throw new Error('The editable source or generated GLB is unavailable. Regenerate before saving.')
          const thumbnail = await captureModelPreview(state.model!.group, signal)
          checkAbort(signal)
          const sourceInfo = await artifacts.inspectModelSource(artifact.sourceSnapshot)
          const operationId = crypto.randomUUID(); set({ pendingOperationId: operationId, saveTarget: target, progress: 'Uploading versioned artifacts…' })
          published = await modelAssetRepository.saveVersion({ modelAssetId: target.id, operationId, expectedVersion: target.currentVersion,
            generatorRecipe: recipe, geometryStats: { ...artifact.stats, glbBytes: artifact.glb.size, materialCount: artifact.materialCount, source: sourceInfo },
            files: { ...artifact.files, thumbnail: { data: thumbnail, contentType: 'image/png' } }, signal })
          if (!current(token)) return { ok: false }
          target = { ...target, currentVersion: published.version, status: 'ready' }
          set(state => ({ publishedVersion: published, saveTarget: target, pendingOperationId: null, libraryRevision: state.libraryRevision + 1 }))
        }
        if (published) {
          set({ progress: `Verifying saved version ${published.version}…` })
          const verified = await artifacts.verifyPublishedModel(target, published.version, recipe, published.geometryStats, signal)
          if (!current(token)) { verified.dispose(); return { ok: false } }
          const previous = get().model; set({ model: verified }); previous?.dispose()
        }
        checkAbort(signal); set({ progress: 'Saving model metadata…' })
        const canonical = await modelAssetRepository.updateMetadata(target.id, target.currentVersion, form)
        if (!current(token)) return { ok: false }
        set(state => ({ asset: canonical, id: canonical.id, activeVersion: published?.version ?? state.activeVersion, savedRecipe: recipe, savedMetadata: form,
          name: canonical.name, description: canonical.description, favorite: canonical.favorite, tags: form.tags, collectionIds: form.collectionIds, dirty: false, status: 'ready', saveFailure: false, error: null, progress: null, saveTarget: null, publishedVersion: null, pendingOperationId: null, libraryRevision: state.libraryRevision + 1 }))
        try { const versions = await modelAssetRepository.listVersions(canonical.id); if (current(token)) set({ versions }) } catch { /* Saved state is already verified; version-list retry is independent. */ }
        return { ok: true, id: canonical.id, version: canonical.currentVersion }
      } catch (error) {
        if (!current(token)) return { ok: false }
        if (error instanceof ModelAssetError && error.kind !== 'cleanup_pending' && !get().publishedVersion) set({ pendingOperationId: null })
        const prefix = get().publishedVersion ? `Version ${get().publishedVersion!.version} is published but save completion needs retry. ` : ''
        set({ status: 'error', dirty: true, saveFailure: true, progress: null, error: prefix + message(error) }); return { ok: false }
      }
    },
    async deleteModel() {
      const asset = get().asset; if (!asset || busy(get())) return false
      const { token } = start(); set({ status: 'deleting', progress: 'Deleting model files…', error: null })
      try {
        await modelAssetRepository.delete(asset.id)
        if (!current(token)) return false
        get().reset(); set(state => ({ libraryRevision: state.libraryRevision + 1 })); return true
      } catch (error) { if (current(token)) set(state => ({ asset: { ...asset, status: 'deletion_pending' }, status: 'error', error: message(error), progress: null, libraryRevision: state.libraryRevision + 1 })); return false }
    },
    async reloadLatest() {
      const asset = get().asset; if (!asset || busy(get())) return
      const { token } = start(); set({ status: 'loading-model', error: null })
      try { const latest = await modelAssetRepository.get(asset.id); if (current(token)) get().load(latest) }
      catch (error) { if (current(token)) set({ status: 'error', error: message(error) }) }
    },
    revert() {
      const { asset, activeVersion } = get()
      if (busy(get())) return
      if (asset?.currentVersion) get().load(asset, activeVersion || asset.currentVersion)
      else if (get().recipe) { void import('../generator/createModelArtifact').then(({ createDefaultModelRecipe }) => { get().setRecipe(createDefaultModelRecipe()); void get().prepare() }) }
    },
    async moreVersions() {
      const { asset, versions, id } = get(); if (!asset) return
      try { const more = await modelAssetRepository.listVersions(asset.id, versions.at(-1)?.version); if (get().id === id) set({ versions: [...new Map([...versions, ...more].map(v => [v.version, v])).values()] }) } catch (error) { set({ error: message(error) }) }
    },
    async download(kind) {
      const state = get(), { builtinModel, builtinEdit, model } = state
      if (builtinModel && kind === 'glb') {
        if (!model || !builtinEdit || !selectBuiltinModelEdited(state) || busy(state)) return
        const { signal, token } = start()
        set({ builtinExporting: true, builtinExportError: null })
        try {
          const [{ exportModelGlb }, { downloadModelBlob }] = await Promise.all([
            import('../export/exportGlb'), import('../data/modelEditorArtifacts'),
          ])
          const blob = await exportModelGlb(model.group, signal)
          if (!current(token)) return
          downloadModelBlob(blob, `${builtinModel.name} edited`, kind)
          set({ builtinExporting: false, builtinEdit: { ...builtinEdit, exported: builtinEdit.values } })
        } catch (error) {
          if (current(token)) set({ builtinExporting: false, builtinExportError: message(error) })
        }
        return
      }
      try {
        const s = get(), helpers = await import('../data/modelEditorArtifacts')
        const blob = kind === 'png' ? s.model ? await captureModelPreview(s.model.group, undefined, 1024, false) : null
          : s.artifact?.glb ?? (s.asset ? await helpers.downloadModelArtifact(s.asset.id, s.activeVersion, 'glbPath') : null)
        if (!blob) throw new Error('No generated model is available to export.')
        helpers.downloadModelBlob(blob, s.name, kind)
      } catch (error) { set({ error: message(error) }) }
    },
  }
})
