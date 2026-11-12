import { create } from 'zustand'
import type { Group } from 'three'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { modelAssetRepository, parseModelOrganization, type ModelMetadata } from '../data/modelAssetRepository'
import { ModelAssetError, parseModelRecipe, text, type ModelAsset, type ModelAssetVersion, type ModelGeneratorRecipe, type ModelGeometryStats } from '../domain/modelAssetTypes'
import type { ModelArtifact } from '../generator/createModelArtifact'
import { checkAbort, MODEL_INPUT_LIMITS } from '../geometry/modelQualityBudget'
import { captureModelPreview } from './modelViewportBridge'
export interface PreviewModel { group: Group; stats: ModelGeometryStats; dispose(): void }
export type ModelSaveOutcome = { ok: true; id: string; version: number } | { ok: false }
export interface ModelEditorState extends ModelMetadata {
  id: string | null; sessionKey: number; sourceMediaId: string | null; asset: ModelAsset | null
  activeVersion: number; versions: ModelAssetVersion[]; libraryRevision: number
  source: Blob | null; sourceInfo: ModelGeometryStats['source'] | null; recipe: ModelGeneratorRecipe | null
  savedRecipe: ModelGeneratorRecipe | null; savedMetadata: ModelMetadata | null
  model: PreviewModel | null; artifact: ModelArtifact | null; preview: Blob | null
  dirty: boolean; generationPending: boolean
  status: 'idle' | 'loading-source' | 'preparing' | 'generating' | 'loading-model' | 'ready' | 'error' | 'saving' | 'deleting'
  saveFailure: boolean
  error: string | null; progress: string | null; warnings: string[]; needsConfirmation: boolean; confirmed: boolean
  saveTarget: ModelAsset | null; publishedVersion: ModelAssetVersion | null; pendingOperationId: string | null
  begin(source: UploadedMedia): string
  load(asset: ModelAsset, version?: number): void
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
const baseline = () => ({ id: null, sessionKey: 0, sourceMediaId: null, name: '', description: null, favorite: false, tags: [], collectionIds: [],
  asset: null, activeVersion: 0, versions: [], source: null, sourceInfo: null, recipe: null, savedRecipe: null, savedMetadata: null, model: null, artifact: null, preview: null,
  dirty: false, generationPending: false, status: 'idle' as const, saveFailure: false, error: null, progress: null, warnings: [], needsConfirmation: false, confirmed: false,
  saveTarget: null, publishedVersion: null, pendingOperationId: null })
function message(error: unknown) { return error instanceof Error ? error.message : 'The model operation failed.' }
const metadata = (state: ModelMetadata): ModelMetadata => ({ name: state.name, description: state.description, favorite: state.favorite, tags: [...state.tags], collectionIds: [...state.collectionIds] })
const geometryKey = (recipe: ModelGeneratorRecipe) => JSON.stringify({ ...recipe, preview: undefined })
const traceKey = (recipe: ModelGeneratorRecipe) => JSON.stringify([recipe.foreground, recipe.trace, recipe.quality])
const busy = (state: ModelEditorState) => state.status === 'saving' || state.status === 'deleting'
export const selectModelEditorNeedsGuard = (state: ModelEditorState) => state.dirty || busy(state)
export const selectModelCanSave = (state: ModelEditorState) => !!state.name.trim() && state.dirty && !busy(state) && !state.generationPending && !!state.model && !!state.recipe && (state.artifact ? geometryKey(state.artifact.recipe) === geometryKey(state.recipe) : JSON.stringify(state.recipe) === JSON.stringify(state.savedRecipe)) && (!state.needsConfirmation || state.confirmed) && (!state.error || state.saveFailure || !!state.saveTarget || !!state.pendingOperationId || !!state.publishedVersion)
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
  function dirty() { const s = get(); return !s.asset?.currentVersion || JSON.stringify(metadata(s)) !== JSON.stringify(s.savedMetadata) || JSON.stringify(s.recipe) !== JSON.stringify(s.savedRecipe) }
  function disposeCurrent() { const s = get(); s.model?.dispose(); if (s.artifact && s.artifact !== s.model) s.artifact.dispose() }
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
    setMetadata(patch) { if (busy(get())) return; set(patch); set({ dirty: dirty(), error: null, saveFailure: false }) },
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
      stopTimer()
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
